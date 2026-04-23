from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import uuid
import base64
import json
import logging
import audioop
import asyncio
import time
import tempfile
import os
import wave
import numpy as np

from src.services.conversational_call_handler import ConversationalCallManager
from src.auth.constants import ACCESS_TOKEN_COOKIE
from src.auth.jwt_utils import safe_decode

router = APIRouter()
logger = logging.getLogger(__name__)

# Use the ServamService instance from ConversationalCallManager to avoid duplication
conv_manager = ConversationalCallManager()
sarvam = conv_manager.sarvam  # Reuse the same instance


def is_real_speech(audio_bytes: bytes, sample_rate: int, threshold: float = 80.0) -> bool:
    """
    Heuristic VAD for full captured utterance.
    Uses short-window RMS so trailing silence doesn't zero out the overall RMS.
    """
    try:
        if not audio_bytes:
            return False
        sr = int(sample_rate or 16000)
        audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
        if audio.size < 400:
            return False

        # 20ms windows (scaled by sample rate)
        win = max(160, int(sr * 0.02))
        if audio.size < win:
            rms = float(np.sqrt(np.mean(audio**2)))
            return rms > threshold

        n = (audio.size // win) * win
        frames = audio[:n].reshape((-1, win))
        rms = np.sqrt(np.mean(frames**2, axis=1))
        # Require a few windows above threshold to avoid clicks/taps.
        voiced = int(np.sum(rms > threshold))
        return voiced >= 3
    except Exception:
        return False


@router.websocket("/api/v1/stream/web/ws")
async def web_voice_ws(websocket: WebSocket):
    token = websocket.cookies.get(ACCESS_TOKEN_COOKIE) or websocket.query_params.get("token")
    if not token or not safe_decode(token):
        await websocket.close(code=1008, reason="Authentication required")
        return

    await websocket.accept()

    # Session create (like socket.id)
    conv_id = f"web_{uuid.uuid4().hex[:8]}"
    customer_id = f"web_{uuid.uuid4().hex[:6]}"

    logger.info(f"🌐 Web client connected: {conv_id}")

    # VAD (voice activity detection) — ignore light taps / HVAC / far noise
    audio_buffer = bytearray()
    voice_active = False
    silence_count = 0
    voice_streak = 0

    # audioop.rms on int16: silence/noise often <70; speech usually clears ~100+ on chunks
    # For browsers/laptops with aggressive noise suppression, RMS can be lower, so keep threshold modest.
    VOICE_THRESHOLD = 80
    # Consecutive loud chunks before marking speech (reduces taps / faint noise)
    MIN_VOICE_STREAK = 2
    # If this is too large, we wait too long before we start STT/LLM/TTS.
    # Keep moderate; we still have max_buffer_bytes as a safety cap.
    # Important: browser worklet chunks are tiny (~8ms at 16k). Too-low values cut users mid-sentence.
    SILENCE_LIMIT = 32       # ~250ms of quiet after speech before end-of-utterance
    # Base thresholds at 16 kHz; scaled by actual client sample rate below
    _BASE_MIN_BYTES = 4096   # ~0.13s at 16 kHz — accept short real utterances like "yes", "no"
    _BASE_MAX_BYTES = 140000 # ~4.4s at 16 kHz — allow longer sentences before forcing flush

    # STT hallucination prevention
    last_transcript = ""
    same_count = 0

    # Actual PCM sample rate from client (init); WAV header must match for accurate STT
    client_sample_rate = 16000
    # Drop STT briefly after TTS (backup if client still buffered a frame)
    post_tts_cooldown_until = 0.0

    try:
        mode = "hotel"  # default mode
        conv_initialized = False

        while True:
            # Receive data
            data = await websocket.receive_text()
            payload = json.loads(data)

            # INIT MESSAGE — initialize conversation (context-driven)
            if payload.get("type") == "init":
                mode = payload.get("mode", "hotel")
                context_type = payload.get("context_type") or payload.get("contextType")
                context_data = payload.get("context_data") or payload.get("contextData") or {}
                sr = payload.get("sample_rate") or payload.get("sampleRate")
                if isinstance(sr, (int, float)) and 8000 <= int(sr) <= 96000:
                    client_sample_rate = int(sr)
                    logger.info(f"🎚️ Client sample rate: {client_sample_rate} Hz")
                conv_manager.init_conversation(
                    conv_id,
                    customer_id,
                    "en",
                    context_type=context_type,
                    context_data=context_data,
                    mode=mode or "hotel",
                )
                conv_initialized = True
                logger.info(f"🎯 Context selected: {context_type or 'none'} (mode={mode})")
                continue

            # Skip audio if conversation not initialized yet
            if not conv_initialized:
                logger.warning("⚠️ Audio received before init — skipping")
                continue

            audio_base64 = payload.get("audio")
            if not audio_base64:
                continue

            # Decode PCM audio bytes
            try:
                audio_bytes = base64.b64decode(audio_base64)
            except Exception:
                continue

            audio_buffer.extend(audio_bytes)

            scale = client_sample_rate / 16000.0
            min_audio_bytes = max(2000, int(_BASE_MIN_BYTES * scale))
            max_buffer_bytes = int(_BASE_MAX_BYTES * scale)

            # Never started "speech" — don't accumulate unbounded pre-roll / fan noise
            if len(audio_buffer) > max_buffer_bytes and not voice_active:
                logger.info("⚠️ VAD: discarding buffer — no sustained speech detected")
                audio_buffer.clear()
                voice_streak = 0
                continue

            # Voice Activity Detection via RMS
            try:
                rms = audioop.rms(audio_bytes, 2)  # 2 = 16-bit samples
            except Exception:
                continue

            if rms > VOICE_THRESHOLD:
                voice_streak += 1
                if voice_streak >= MIN_VOICE_STREAK:
                    voice_active = True
                    silence_count = 0
            else:
                voice_streak = 0
                if voice_active:
                    silence_count += 1

            # End of speech: silence after confirmed voice OR hard cap while speaking
            end_of_speech = (
                (voice_active and silence_count >= SILENCE_LIMIT)
                or (voice_active and len(audio_buffer) > max_buffer_bytes)
            )

            if not end_of_speech:
                continue

            logger.info(f"🛑 Speech ended → processing ({len(audio_buffer)} bytes)")

            # If we just played TTS, ignore any buffered echo/noise and reset fast.
            if time.monotonic() < post_tts_cooldown_until:
                audio_buffer.clear()
                voice_active = False
                silence_count = 0
                voice_streak = 0
                logger.info("🔇 Dropping buffer — post-TTS cooldown")
                continue

            # Skip if buffer too small (background noise, not real speech)
            if len(audio_buffer) < min_audio_bytes:
                logger.info("⚠️ Buffer too small, skipping")
                audio_buffer.clear()
                voice_active = False
                silence_count = 0
                voice_streak = 0
                continue

            # Capture buffer snapshot and reset immediately
            captured_audio = bytes(audio_buffer)
            audio_buffer.clear()
            voice_active = False
            silence_count = 0
            voice_streak = 0

            # Check for real speech (not silence/noise)
            if not is_real_speech(captured_audio, sample_rate=client_sample_rate):
                logger.info("🔇 Skipping STT — silence/noise detected")
                continue

            # STT — run in thread executor (non-blocking)
            loop = asyncio.get_running_loop()

            sr_for_wav = client_sample_rate
            stt_lang = conv_manager.get_stt_language_code(conv_id)

            def convert_and_transcribe():
                wav_path = None
                try:
                    # 1️⃣ Write raw PCM bytes into a proper WAV container
                    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                        wav_path = f.name

                    with wave.open(wav_path, 'wb') as wf:
                        wf.setnchannels(1)       # mono
                        wf.setsampwidth(2)       # 16-bit PCM
                        wf.setframerate(sr_for_wav)  # must match browser AudioContext.sampleRate
                        wf.writeframes(captured_audio)

                    # 2️⃣ Read WAV back as bytes for STT
                    with open(wav_path, "rb") as f:
                        wav_audio = f.read()

                    # 3️⃣ Send to Sarvam STT (language locked to session to reduce wrong-script errors)
                    return sarvam.speech_to_text(
                        audio_data=wav_audio,
                        language=stt_lang,
                    )

                except Exception as e:
                    logger.error(f"❌ STT error: {str(e)}")
                    return None

                finally:
                    # clean up temp file
                    if wav_path and os.path.exists(wav_path):
                        os.unlink(wav_path)

            stt_result = await loop.run_in_executor(None, convert_and_transcribe)

            user_text = (stt_result or {}).get("text", "").strip()

            if not user_text:
                logger.info("⚠️ Empty STT result")
                continue

            ctx = conv_manager.get_conversation_context(conv_id)
            if ctx and ctx.get("conversation_done"):
                logger.info("🔇 Ignoring utterance — conversation already ended")
                continue

            # Check for duplicate transcripts (hallucination on silence/noise)
            if user_text == last_transcript:
                same_count += 1
                if same_count >= 2:
                    logger.info(f"🔁 Duplicate transcript ignored: '{user_text}'")
                    continue
            else:
                last_transcript = user_text
                same_count = 0

            logger.info(f"🗣️ User: {user_text}")

            # Tell client to mute mic before LLM/TTS (reduces echo into buffer)
            try:
                await websocket.send_json({"type": "assistant_reply_pending"})
            except Exception:
                pass

            # Add to conversation history
            conv_manager.append_user_message(conv_id, user_text)

            # Generate LLM response (prefer Gemini if configured; fallback to Sarvam)
            # Run in executor so the websocket loop doesn't stall.
            loop = asyncio.get_running_loop()
            agent_text = await loop.run_in_executor(
                None,
                lambda: conv_manager.generate_next_response(
                    conv_id,
                    prefer_gemini=True,
                    max_tokens=192,
                    temperature=0.25,
                    history_limit=6,
                ),
            )

            if not agent_text:
                logger.info("⏹️ No agent response — conversation ended or empty")
                continue

            conv_manager.append_agent_message(conv_id, agent_text)

            logger.info(f"🤖 AI: {agent_text}")

            # TTS — get audio URL and fetch audio bytes
            audio_out = sarvam.text_to_speech(agent_text)

            if not audio_out:
                logger.warning("⚠️ TTS failed")
                continue
                
            # Send audio response back to browser
            await websocket.send_bytes(audio_out)
            # Dynamic cooldown: browser resumes mic after audio ends, but we don't have an explicit signal.
            # Approximate from payload size to reduce echo-driven empty STT calls.
            now = time.monotonic()
            approx_play_s = len(audio_out) / 50000.0  # heuristic
            post_tts_cooldown_until = now + max(0.7, min(2.2, approx_play_s))
            logger.info(f"✅ Sent {len(audio_out)} bytes of audio to client")

    except WebSocketDisconnect:
        logger.info(f"❌ Web client disconnected: {conv_id}")
        # Clean up conversation history on disconnect
        try:
            conv_manager.end_conversation(conv_id)
        except Exception as e:
            logger.warning(f"Failed to cleanup conversation {conv_id}: {e}")

    except Exception as e:
        logger.error(f"❌ WebSocket error: {str(e)}")
        try:
            await websocket.close()
        except Exception:
            pass