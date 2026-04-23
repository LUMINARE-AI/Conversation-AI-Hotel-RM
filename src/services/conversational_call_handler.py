"""
Conversational Call Handler - Dynamic LLM-driven multi-turn conversation

Uses Sarvam AI for:
  - STT (speech_to_text): Convert user speech to text
  - LLM (generate_response): Dynamic dialogue based on conversation history
  - TTS (text_to_speech): Convert responses to natural audio

Flow (repeating loop):
  1. User speaks
  2. STT: Speech → Text
  3. Append user message to conversation history
  4. LLM: Generate next response based on ENTIRE history
  5. TTS: Response → Audio
  6. Play audio to user
  7. Loop back to step 1

CRITICAL: NOT using hardcoded flow (handle-response → handle-response-experience → handle-visit-plans)
Instead: Single webhook handles all steps, LLM drives conversation dynamically
"""
import logging
import json
import re
import os
import time
from datetime import datetime
from statistics import mode
from typing import Optional, Dict, List, Tuple
from src.models.database import get_session, CallHistory, Customer
from src.services.servam_service import get_servam_service
from src.agents.relationship_manager_agent import RelationshipManagerAgent
from config.config import get_config

logger = logging.getLogger(__name__)
config = get_config()

# Optional: Google Gemini (preferred LLM in some flows)
try:
    from google import genai
    from google.genai import types as genai_types
    GOOGLE_GENAI_AVAILABLE = True
except Exception:
    GOOGLE_GENAI_AVAILABLE = False

# Voice LLM: keep low for fast spoken turns
LLM_VOICE_MAX_TOKENS = 256
LLM_VOICE_TEMPERATURE = 0.35

# Samvaad / branding — spoken in first turn templates
BRAND_LUMINARE_AI = "Luminare AI"

# Global conversation history storage (in production, use Redis/database)
# Key: call_sid, Value: {customer_id, language, messages: [{role, content}], turn_count, start_time}
CONVERSATION_HISTORY = {}


class ConversationalCallManager:
    """
    Manages LLM-driven multi-turn conversations with dynamic flow
    """
    
    def __init__(self):
        self.sarvam = get_servam_service()
        self.agent = RelationshipManagerAgent()
        self.session = get_session()
        self._gemini_client = None

    def _get_gemini_client(self):
        """Lazily initialize a Google Gemini client if configured."""
        if self._gemini_client is not None:
            return self._gemini_client

        google_api_key = getattr(config, "GOOGLE_API_KEY", "") or ""
        if not google_api_key or not GOOGLE_GENAI_AVAILABLE:
            self._gemini_client = None
            return None

        try:
            self._gemini_client = genai.Client(api_key=google_api_key)
            return self._gemini_client
        except Exception as e:
            logger.warning(f"[LLM] Failed to init Gemini client: {type(e).__name__}: {e}")
            self._gemini_client = None
            return None

    def _convert_messages_for_gemini(self, messages: list):
        """Convert OpenAI-style messages to Gemini format."""
        system_instruction = None
        contents = []
        for msg in messages:
            role = msg.get("role")
            text = msg.get("content", "")
            if not text:
                continue
            if role == "system":
                system_instruction = text
            elif role == "user":
                contents.append(
                    genai_types.Content(
                        role="user",
                        parts=[genai_types.Part(text=text)],
                    )
                )
            elif role == "assistant":
                contents.append(
                    genai_types.Content(
                        role="model",
                        parts=[genai_types.Part(text=text)],
                    )
                )
        return system_instruction, contents

    def _call_gemini_llm(self, messages: list, max_tokens: int, temperature: float) -> Optional[str]:
        """Call Gemini for a short spoken reply (fallback to Sarvam if this fails)."""
        client = self._get_gemini_client()
        if not client:
            return None

        gemini_model = os.getenv("GOOGLE_GEMINI_MODEL", "gemini-2.5-flash")
        try:
            t0 = time.perf_counter()
            system_instruction, contents = self._convert_messages_for_gemini(messages)
            resp = client.models.generate_content(
                model=gemini_model,
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    max_output_tokens=max_tokens,
                    temperature=temperature,
                ),
            )
            dt_ms = (time.perf_counter() - t0) * 1000
            text = (getattr(resp, "text", "") or "").strip()
            logger.info(f"[TIMING] LLM (Gemini {gemini_model}): {dt_ms:.0f}ms, out_chars={len(text)}")
            return text or None
        except Exception as e:
            logger.warning(f"[LLM] Gemini error: {type(e).__name__}: {e}")
            return None
    
    def _should_switch_language(self, current_language: str, detected_language: str, text: str) -> bool:
        """
        Decide whether to switch conversation language for this turn.

        Prevent abrupt switches on short/ambiguous utterances like "ok", "haan".
        Keep one language per call unless the user clearly switches.
        """
        if not detected_language or detected_language == current_language:
            return False

        stripped_text = (text or "").strip()
        if not stripped_text:
            return False

        # Avoid switching on fillers/acknowledgements.
        if self._is_filler_utterance(stripped_text):
            return False

        words = stripped_text.split()
        text_len = len(stripped_text)
        latin_letters = sum(1 for c in stripped_text if c.isascii() and c.isalpha())
        devanagari_chars = sum(1 for c in stripped_text if 0x0900 <= ord(c) <= 0x097F)

        # Require strong evidence + enough text (STT/script detection can be noisy).
        if text_len < 16 or len(words) < 3:
            return False

        if detected_language == "en":
            return latin_letters >= 10
        if detected_language == "hi":
            return devanagari_chars >= 10
        # For other Indian languages, be extra conservative.
        return text_len >= 28 and len(words) >= 6

    def _ensure_complete_spoken_response(self, text: str, language: str) -> str:
        """
        Normalize LLM output so TTS doesn't speak clipped mid-clause responses.
        """
        normalized = (text or "").strip()
        if not normalized:
            return normalized

        terminal_marks = (".", "!", "?", "।")
        if normalized.endswith(terminal_marks):
            return normalized

        lang = (language or "en").lower()

        if lang == "en":
            dangling_endings = (
                "to", "and", "or", "but", "because", "so", "with", "for", "of", "that",
                "which", "ensure", "ensure that", "make sure", "help"
            )
            lower = normalized.lower().rstrip()
            for ending in dangling_endings:
                if lower.endswith(f" {ending}") or lower == ending:
                    return f"{normalized} your next stay is even better."
            return f"{normalized}."

        if lang == "hi":
            return f"{normalized}।"

        return f"{normalized}."

    def _tighten_voice_reply(self, text: str, language: str, max_words: int = 12) -> str:
        """
        Hard cap for WebSocket voice: keep responses short + human-like.
        This reduces TTS latency and prevents long "written" answers.
        """
        t = (text or "").strip()
        if not t:
            return ""

        # Keep at most the first two sentence-ish chunks (still voice-friendly, less robotic).
        parts = re.split(r"(?<=[.!?।])\s+", t)
        parts = [p.strip() for p in parts if p and p.strip()]
        first = " ".join(parts[:2]).strip() if parts else t

        # Word cap (works acceptably for en/hi; whitespace-tokenization is OK here).
        words = first.split()
        if max_words and len(words) > max_words:
            first = " ".join(words[:max_words]).rstrip()

        return first

    def _is_filler_utterance(self, text: str) -> bool:
        """True if the user only said filler / deictic words (e.g. 'Just', 'This') with no substance."""
        t = (text or "").strip().lower()
        if not t:
            return True
        words = re.findall(r"[a-zA-Z']+", t)
        if not words:
            return len(t) <= 4
        # Only non-semantic noise / deictics — not "good", "yes", "nice" (those can be real answers)
        fillers = {
            "just", "this", "that", "um", "uh", "hmm", "mm", "mmm", "okay", "ok",
            "well", "so", "hi", "hey", "hello", "bye", "thanks", "thank", "you",
            "got", "it",
        }
        if len(words) > 4:
            return False
        return all(w in fillers for w in words)

    # ==================== Samvaad Detection ====================  
    def get_system_prompt(self, mode: str) -> str:
        identity = {
            "hotel": f"You are {BRAND_LUMINARE_AI} calling from Luminare Hotels.",
            "election": f"You are {BRAND_LUMINARE_AI} calling on behalf of Luminare Party.",
            "feedback": f"You are {BRAND_LUMINARE_AI} calling from Luminare Hospitals for quick feedback.",
        }.get(mode, f"You are {BRAND_LUMINARE_AI}.")

        return "\n".join(
            [
                identity,
                "Speak like a real human on a phone call.",
                "Be short, clear, and friendly (1–2 short sentences).",
                "Avoid repetition and scripted phrasing.",
                "Output only what you would say aloud (no tags, no hidden reasoning).",
            ]
        )

    # ==================== CONTEXT ENGINE ====================
    def get_context_opening_message(self, context_type: Optional[str], context_data: Optional[Dict], language: str = "en") -> str:
        """
        Purpose-driven first line for the call, based on a real-world scenario.
        Falls back to a simple greeting if context_type is missing or unknown.
        """
        ct = (context_type or "").strip().lower()
        data = context_data or {}
        lang = (language or "en").lower()

        if ct == "report_ready":
            report_name = (data.get("report_name") or "your report").strip()
            msg = f"Hi, I'm calling from Luminare Hospital — your {report_name} reports are ready. When would you like to collect them?"
            return msg if lang == "en" else f"नमस्ते, मैं Luminare Hospital से बोल रहा/रही हूँ — आपके {report_name} की रिपोर्ट तैयार है। आप कब लेना चाहेंगे?"

        if ct == "follow_up_reminder":
            msg = "Hi, the doctor recommended a follow‑up visit — have you scheduled it yet?"
            return msg if lang == "en" else "नमस्ते, डॉक्टर ने फॉलो‑अप विज़िट की सलाह दी थी — क्या आपने अपॉइंटमेंट ले लिया है?"

        if ct == "appointment_reminder":
            msg = "Hi, quick reminder about your appointment — are you still able to make it?"
            return msg if lang == "en" else "नमस्ते, आपकी अपॉइंटमेंट की एक छोटी याद दिलाना था — क्या आप आ पाएँगे?"

        if ct == "billing_pending":
            amount = data.get("amount")
            bill_ref = data.get("bill_ref") or data.get("invoice_id")
            if amount and bill_ref:
                msg = f"Hi, I'm calling from Luminare Hospital — there’s a pending bill of {amount} for {bill_ref}. Would you like me to share the payment link?"
            elif amount:
                msg = f"Hi, I'm calling from Luminare Hospital — there’s a pending bill of {amount}. Would you like me to share the payment link?"
            else:
                msg = "Hi, I'm calling from Luminare Hospital — there’s a pending bill. Would you like me to share the payment link?"
            return msg if lang == "en" else "नमस्ते, मैं Luminare Hospital से बोल रहा/रही हूँ — एक बिल पेंडिंग है। क्या मैं पेमेंट लिंक भेज दूँ?"

        if ct == "repeat_visit_trigger":
            msg = "Hi, it’s been a while since your last stay — are you planning a trip anytime soon?"
            return msg if lang == "en" else "नमस्ते, आपकी पिछली स्टे को काफ़ी समय हो गया — क्या आप जल्द कहीं ट्रिप प्लान कर रहे हैं?"

        if ct == "seasonal_offer":
            season = (data.get("season") or "this season").strip()
            msg = f"Hi — we have a limited offer for {season}. Would you like the details?"
            return msg if lang == "en" else f"नमस्ते — {season} के लिए एक लिमिटेड ऑफ़र है। क्या आप डिटेल्स चाहेंगे?"

        if ct == "loyalty_offer":
            msg = "Hi — as a loyal guest, you have a special offer available. Want the details?"
            return msg if lang == "en" else "नमस्ते — हमारे लॉयल गेस्ट के लिए एक खास ऑफ़र है। क्या मैं डिटेल्स बता दूँ?"

        if ct == "abandoned_booking":
            msg = "Hi — you started a booking recently but didn’t complete it. Want me to help you finish it?"
            return msg if lang == "en" else "नमस्ते — आपने हाल ही में बुकिंग शुरू की थी, लेकिन पूरी नहीं हुई। क्या मैं आपको पूरा करने में मदद कर दूँ?"

        if ct == "local_issue":
            issue = (data.get("issue") or "a local issue").strip()
            msg = f"Hi — I’m calling about {issue} in your area. Can I share a quick update?"
            return msg if lang == "en" else f"नमस्ते — आपके इलाके के {issue} के बारे में कॉल कर रहा/रही हूँ। क्या मैं एक छोटा अपडेट साझा करूँ?"

        if ct == "scheme_awareness":
            scheme = (data.get("scheme") or "a government scheme").strip()
            msg = f"Hi — quick call to share details about {scheme}. Would you like to hear it?"
            return msg if lang == "en" else f"नमस्ते — {scheme} के बारे में जानकारी साझा करने के लिए कॉल है। क्या आप सुनना चाहेंगे?"

        if ct == "event_invite":
            event = (data.get("event_name") or "an event").strip()
            when = (data.get("when") or "this weekend").strip()
            msg = f"Hi — there’s {event} happening in your area {when}. Would you like details?"
            return msg if lang == "en" else f"नमस्ते — आपके इलाके में {when} {event} हो रहा है। क्या आप डिटेल्स चाहेंगे?"

        if ct == "voter_followup":
            msg = "Hi — quick follow‑up from our side. Do you have a minute to talk?"
            return msg if lang == "en" else "नमस्ते — हमारी तरफ़ से एक छोटा फॉलो‑अप था। क्या आपके पास एक मिनट है?"

        # Fallback
        return (
            f"Hi — this is {BRAND_LUMINARE_AI}. Is this a good time to talk?"
            if lang == "en"
            else f"नमस्ते — मैं {BRAND_LUMINARE_AI} हूँ। क्या अभी बात करने का समय है?"
        )

    def get_context_prompt(self, context_type: Optional[str], context_data: Optional[Dict]) -> Tuple[str, str]:
        """
        Returns (context_label, purpose) for system prompt injection.
        Keeps the conversation focused and actionable.
        """
        ct = (context_type or "").strip().lower()
        data = context_data or {}

        mapping = {
            # Hospital
            "report_ready": ("report_ready", f"Inform the user their {(data.get('report_name') or 'report').strip()} is ready and help them decide pickup/delivery timing."),
            "follow_up_reminder": ("follow_up_reminder", "Remind the user about a doctor-recommended follow-up and help schedule/confirm next steps."),
            "appointment_reminder": ("appointment_reminder", "Confirm an upcoming appointment and handle rescheduling if needed."),
            "billing_pending": ("billing_pending", "Resolve a pending bill by offering a payment link or clarifying billing details."),
            # Hotel
            "repeat_visit_trigger": ("repeat_visit_trigger", "Re-engage the guest about planning a trip and help with dates/booking next step."),
            "seasonal_offer": ("seasonal_offer", "Share a relevant seasonal offer and help the user decide if they want details/booking."),
            "loyalty_offer": ("loyalty_offer", "Offer a loyalty benefit and move toward an actionable next step (dates/booking)."),
            "abandoned_booking": ("abandoned_booking", "Help the user complete a booking they started and resolve friction (dates/room/payment)."),
            # Campaign
            "local_issue": ("local_issue", "Share a concise update about the local issue and answer questions without drifting topics."),
            "scheme_awareness": ("scheme_awareness", "Explain the scheme clearly and check eligibility/next steps if the user is interested."),
            "event_invite": ("event_invite", "Invite the user to the event and share only essential details (what/when/where/how to join)."),
            "voter_followup": ("voter_followup", "Follow up respectfully and address questions/concerns briefly, then close politely."),
        }

        if ct in mapping:
            return mapping[ct]
        return ("none", "Have a simple, helpful phone conversation and respond to what the user says.")

    def handle_identity_check(self, context: Dict, last_user_text: str) -> str:
        """
        Identity confirmation gate for EVERY conversation.
        Does not allow the call to proceed until identity is confirmed.
        """
        customer_id = (context.get("customer_id") or "").strip()
        is_web_user = customer_id.startswith("web")
        # Per requirement: if web_user, always use "Ramesh ji" in the identity question.
        customer_name = "Ramesh" if is_web_user else (context.get("customer_name") or "aap")
        customer_name = str(customer_name).strip() or "aap"
        lang = (context.get("language") or "en").lower()
        ct = context.get("context_type")
        cd = context.get("context_data") or {}

        def ask_identity() -> str:
            # Always lead with the requested Hinglish identity intro.
            # Keep it short and natural for voice.
            if lang == "hi":
                return f"Me Priya baat kr rhi hu Luminare AI se. Kya meri {customer_name} ji se baat ho rhi h?"
            return f"I'm Priya from Luminare AI. Am I speaking with {customer_name}?"

        t = (last_user_text or "").strip().lower()
        if not t:
            return ask_identity()

        # Clear confirmations (Hinglish/Hindi + English)
        confirm_markers = (
            "yes", "yep", "yeah", "haan", "han", "ha", "ji", "ji haan",
            "speaking", "bol raha", "bol rahi", "main", "mein", "this is", "i am",
        )
        deny_markers = (
            "no", "nah", "wrong", "wrong person", "galat", "galat number",
            "not me", "nahi", "nahi ji",
        )
        unclear_markers = ("kaun", "kaun?", "kya", "kya?", "who", "what", "sorry?")

        if any(m in t for m in deny_markers):
            context["conversation_done"] = True
            context["state"] = "closing"
            return "Sorry, shayad galat number hai. Dhanyavaad!"

        if any(m in t for m in unclear_markers):
            context["state"] = "identity_check"
            return ask_identity()

        if any(m in t for m in confirm_markers):
            context["state"] = "active_conversation"
            # Move immediately into the context-driven purpose (keep it short).
            opening = self.get_context_opening_message(ct, cd, language=lang)
            if lang == "hi":
                return self._ensure_complete_spoken_response(f"Ji haan. {opening}", lang)
            return self._ensure_complete_spoken_response(f"Yes. {opening}", lang)

        # Unclear: re-ask without progressing.
        context["state"] = "identity_check"
        return ask_identity()
      
    # ==================== LANGUAGE DETECTION (Script-based) ====================
    
    def detect_language_from_script(self, text: str) -> str:
        """
        Detect language based on Unicode script ranges.
        Returns language code: 'en', 'hi', 'ta', 'te', 'ml', etc.
        
        Script ranges:
        - Devanagari (Hindi, Marathi): U+0900–U+097F
        - Tamil: U+0B80–U+0BFF
        - Telugu: U+0C00–U+0C7F
        - Malayalam: U+0D00–U+0D7F
        """
        if not text:
            return "en"
        
        devanagari_count = sum(1 for c in text if 0x0900 <= ord(c) <= 0x097F)
        tamil_count = sum(1 for c in text if 0x0B80 <= ord(c) <= 0x0BFF)
        telugu_count = sum(1 for c in text if 0x0C00 <= ord(c) <= 0x0C7F)
        malayalam_count = sum(1 for c in text if 0x0D00 <= ord(c) <= 0x0D7F)
        
        # Check if text contains Indian scripts
        if devanagari_count > 2:  # At least 3 Devanagari chars = Hindi
            return "hi"
        elif tamil_count > 2:
            return "ta"
        elif telugu_count > 2:
            return "te"
        elif malayalam_count > 2:
            return "ml"
        else:
            return "en"  # Default to English
    
    # ==================== CONVERSATION HISTORY MANAGEMENT ====================
    
    def init_conversation(
        self,
        call_sid: str,
        customer_id: str,
        language: str = "en",
        context_type: Optional[str] = None,
        context_data: Optional[Dict] = None,
        mode: str = "hotel",
    ) -> Optional[Dict]:
        """
        Initialize conversation history for a new call
        
        Args:
            call_sid: Twilio call ID
            customer_id: Customer ID
            language: Language code (en, hi, ta, etc)
            
        Returns:
            Conversation context dict
        """
        try:
            is_web_user = customer_id.startswith("web")

            if is_web_user:
                customer = type("Customer", (), {
                    "name": "Web User",
                    "total_visits": 0,
                    "loyalty_score": 0,
                    "last_stay_date": None,
                    "preferred_room_type": None
                })()
            else:
                customer = self.session.query(Customer).filter_by(customer_id=customer_id).first()

                if not customer:
                    logger.error(f"Customer {customer_id} not found")
                    return None    
            
            # System prompt - natural conversational style
            customer_context = f"""
Customer Profile:
- Name: {customer.name}
- Total Visits: {customer.total_visits}
- Loyalty Score: {customer.loyalty_score}
- Last Visit: {customer.last_stay_date.strftime('%B %Y') if customer.last_stay_date else 'Unknown'}
- Preferred Room: {customer.preferred_room_type or 'Not specified'}
"""
            system_prompt = self.get_system_prompt(mode)
            ctx_label, ctx_purpose = self.get_context_prompt(context_type, context_data)
            system_message = f"""
{system_prompt}

Customer Details: {customer_context}

Conversation context: {ctx_label}
Purpose of call: {ctx_purpose}

Rules:
- Respond in {language} only.
- Sound like a real person on a live call (not robotic, not scripted).
- Keep replies short and voice-friendly (usually 1–2 short sentences).
- Avoid repeating yourself.
- Focus only on the conversation context above. If the user drifts, gently bring them back to the purpose.
"""
            
            context = {
                "call_sid": call_sid,
                "customer_id": customer_id,
                "customer_name": customer.name,
                "language": language,
                # Legacy field kept for compatibility; do not drive flow from mode.
                "mode": mode,
                "context_type": context_type,
                "context_data": context_data or {},
                "state": "identity_check",
                "intent": "neutral",
                "pending_language": None,
                "pending_language_count": 0,
                "messages": [
                    {"role": "system", "content": system_message}
                ],
                "turn_count": 0,
                "start_time": datetime.utcnow(),
                "sentiment_history": [],
                "conversation_done": False,
            }
            
            CONVERSATION_HISTORY[call_sid] = context
            logger.info(f"✓ Conversation initialized: call_sid={call_sid}, customer={customer_id}, lang={language}")
            return context
        
        except Exception as e:
            logger.error(f"Error initializing conversation: {str(e)}")
            return None
    
    def get_conversation_context(self, call_sid: str) -> Optional[Dict]:
        """Get existing conversation context"""
        return CONVERSATION_HISTORY.get(call_sid)

    def get_stt_language_code(self, call_sid: str) -> str:
        """
        Sarvam STT language_code for the *next* utterance (based on session language so far).
        Uses en-IN for English sessions instead of 'unknown' to reduce wrong-script hallucinations.
        """
        ctx = self.get_conversation_context(call_sid)
        if not ctx:
            return "en-IN"
        raw = (ctx.get("language") or "en").lower()
        if raw.startswith("en"):
            lang = "en"
        elif raw.startswith("hi"):
            lang = "hi"
        elif raw.startswith("ta"):
            lang = "ta"
        elif raw.startswith("te"):
            lang = "te"
        elif raw.startswith("ml"):
            lang = "ml"
        else:
            lang = raw.split("-")[0].split("_")[0] if raw else "en"
        mapping = {
            "en": "en-IN",
            "hi": "hi-IN",
            "ta": "ta-IN",
            "te": "te-IN",
            "ml": "ml-IN",
        }
        return mapping.get(lang, "en-IN")
    
    def append_user_message(self, call_sid: str, user_text: str) -> bool:
        """
        Append user message to conversation history & auto-detect language
        
        Args:
            call_sid: Twilio call ID
            user_text: User's spoken text
            
        Returns:
            True if successful
        """
        try:
            context = self.get_conversation_context(call_sid)
            if not context:
                logger.error(f"Conversation context not found: {call_sid}")
                return False
            
            context["messages"].append({
                "role": "user",
                "content": user_text
            })
            
            # 🌍 AUTO-DETECT LANGUAGE from user's text (script-based)
            # Keep current language on silence/empty/noise placeholders.
            normalized_text = (user_text or "").strip().lower()
            is_silence = normalized_text in ["", "[silence]", "silence", "...", "."]

            if not is_silence:
                detected_lang = self.detect_language_from_script(user_text)

                # Disable aggressive auto-switch: require two consecutive "votes" to change language.
                if self._should_switch_language(context["language"], detected_lang, user_text):
                    pending = context.get("pending_language")
                    if pending == detected_lang:
                        context["pending_language_count"] = int(context.get("pending_language_count") or 0) + 1
                    else:
                        context["pending_language"] = detected_lang
                        context["pending_language_count"] = 1

                    if context["pending_language_count"] >= 2:
                        old = context["language"]
                        context["language"] = detected_lang
                        context["pending_language"] = None
                        context["pending_language_count"] = 0
                        logger.info(f"🌍 Language switched (confirmed): {old} → {detected_lang}")
                else:
                    context["pending_language"] = None
                    context["pending_language_count"] = 0
            
            # Skip sentiment analysis to reduce API calls
            # sentiment_result = self.sarvam.analyze_sentiment(user_text, context["language"])
            # sentiment = sentiment_result.get("sentiment", "neutral") if sentiment_result else "neutral"
            sentiment = "neutral"  # Default sentiment
            context["sentiment_history"].append(sentiment)
            
            logger.info(f"✓ User: {user_text[:50]}... (lang: {context['language']}, sentiment: {sentiment})")
            return True
        
        except Exception as e:
            logger.error(f"Error appending user message: {str(e)}")
            return False
    
    def append_agent_message(self, call_sid: str, agent_text: str) -> bool:
        """
        Append agent message to conversation history
        
        Args:
            call_sid: Twilio call ID
            agent_text: Agent's response text
            
        Returns:
            True if successful
        """
        try:
            context = self.get_conversation_context(call_sid)
            if not context:
                logger.error(f"Conversation context not found: {call_sid}")
                return False
            
            context["messages"].append({
                "role": "assistant",
                "content": agent_text
            })
            
            context["turn_count"] += 1
            logger.info(f"✓ Agent (turn {context['turn_count']}): {agent_text[:50]}...")
            return True
        
        except Exception as e:
            logger.error(f"Error appending agent message: {str(e)}")
            return False
    
    # ==================== LANGUAGE DETECTION (LLM-Based) ====================
    
    def detect_language_llm(self, text: str, current_language: str = "en") -> str:
        """
        Detect the language of user text using LLM
        
        Much more reliable than keyword matching!
        
        Args:
            text: User's text to analyze
            current_language: Current language (fallback if detection fails)
            
        Returns:
            Language code (en, hi, ta, te, ml) or current_language if detection fails
        """
        try:
            if not text or len(text.strip()) < 2:
                return current_language
            
            # Use LLM to detect language (with short timeout via max_tokens=10)
            detection_prompt = f"""Detect language. Return ONLY code: en/hi/ta/te/ml/mixed

Text: "{text[:100]}"

CODE ONLY:"""
            
            response = self.sarvam.client.chat.completions.create(
                model="sarvam-m",
                messages=[{"role": "user", "content": detection_prompt}],
                max_tokens=5,  # VERY short - just the code
                temperature=0.0  # Deterministic
            )
            
            if response and hasattr(response, 'choices') and len(response.choices) > 0:
                detected = response.choices[0].message.content.strip().lower()
                
                # Check if it's a recognized code
                recognized_langs = ["en", "hi", "ta", "te", "ml", "mixed"]
                if detected in recognized_langs:
                    if detected == "mixed":
                        logger.info(f"✓ LLM: Mixed language → using {current_language}")
                        return current_language
                    else:
                        logger.info(f"✓ LLM: Language detected as {detected}")
                        return detected
                else:
                    logger.debug(f"LLM returned unrecognized: {detected}")
                    return current_language
            
            logger.debug(f"LLM language detection empty, using current: {current_language}")
            return current_language
        
        except Exception as e:
            logger.debug(f"LLM language detection error (using {current_language}): {type(e).__name__}")
            return current_language
    
    # ==================== STT (Speech-to-Text) ====================
    
    def speech_to_text(self, call_sid: str, audio_data: bytes) -> Optional[str]:
        """
        Convert speech to text using Sarvam STT
        
        Args:
            call_sid: Twilio call ID
            audio_data: Audio bytes
            
        Returns:
            Transcribed text or None if failed
        """
        try:
            context = self.get_conversation_context(call_sid)
            if not context:
                logger.error(f"Conversation context not found: {call_sid}")
                return None
            
            language = context["language"]
            
            # STT using Sarvam
            logger.debug(f"Calling STT for audio ({len(audio_data)} bytes)...")
            stt_result = self.sarvam.speech_to_text(audio_data, language=language)
            
            if not stt_result:
                logger.warning("STT failed to transcribe audio")
                return None
            
            text = stt_result.get("text", "").strip()
            detected_lang = stt_result.get("language", language)
            confidence = stt_result.get("confidence", 0)
            
            logger.info(f"✓ STT: '{text}' (confidence: {confidence:.2%})")
            
            # Update language only with strong evidence (avoid mid-call flips on noise).
            if (
                detected_lang
                and detected_lang != language
                and confidence >= 0.75
                and len((text or "").strip()) >= 16
                and not self._is_filler_utterance(text)
                and self._should_switch_language(language, detected_lang, text)
            ):
                pending = context.get("pending_language")
                if pending == detected_lang:
                    context["pending_language_count"] = int(context.get("pending_language_count") or 0) + 1
                else:
                    context["pending_language"] = detected_lang
                    context["pending_language_count"] = 1

                if context["pending_language_count"] >= 2:
                    old_lang = context["language"]
                    context["language"] = detected_lang
                    context["pending_language"] = None
                    context["pending_language_count"] = 0
                    logger.info(f"   Language updated (confirmed): {old_lang} → {detected_lang}")
            
            return text
        
        except Exception as e:
            logger.error(f"Error in speech_to_text: {str(e)}")
            return None
    
    # ==================== LLM (Text Generation via Sarvam LLM) ====================
    
    def generate_next_response(
        self,
        call_sid: str,
        prefer_gemini: bool = False,
        max_tokens: int = LLM_VOICE_MAX_TOKENS,
        temperature: float = LLM_VOICE_TEMPERATURE,
        history_limit: int = 8,
    ) -> Optional[str]:
        """
        Generate next response using Sarvam LLM based on conversation history
        
        Smart triggers detect conversation flow without rigid turn logic:
        - Detect if user wants to end call ("bye", "busy", "not interested")
        - Detect if user mentions another visit
        - Detect complaints/concerns
        - Guide LLM to offer discount if engagement is low
        
        Args:
            call_sid: Twilio call ID
            
        Returns:
            Generated response text or None if failed
        """
        try:
            context = self.get_conversation_context(call_sid)
            if not context:
                logger.error(f"Conversation context not found: {call_sid}")
                return None
            
            if context.get("conversation_done"):
                return None

            def _get_last_user_text() -> str:
                for m in reversed(context.get("messages") or []):
                    if isinstance(m, dict) and m.get("role") == "user":
                        return (m.get("content") or "").strip()
                return ""

            def _detect_intent(text: str) -> str:
                t = (text or "").strip().lower()
                if not t:
                    return "neutral"
                if any(p in t for p in ("not interested", "don't call", "dont call", "stop calling", "no thanks", "no thank you")):
                    return "not_interested"
                if any(p in t for p in ("busy", "in a meeting", "call later", "later", "not now", "can't talk", "cant talk")):
                    return "busy"
                if any(p in t for p in ("what", "which", "who", "why", "meaning", "don't understand", "dont understand", "confused", "sorry?", "huh")):
                    return "confused"
                if any(p in t for p in ("complain", "complaint", "problem", "issue", "bad", "worst", "disappointed", "rude", "dirty", "refund")):
                    return "complaint"
                if any(p in t for p in ("yes", "yeah", "yep", "sure", "interested", "tell me", "sounds good", "book", "booking", "visit", "stay", "discount", "offer", "price", "rate")):
                    return "interest"
                return "neutral"

            def _advance_state(prev: str, intent: str, last_user: str) -> str:
                s = (prev or "intro").strip().lower()
                if s == "intro" and (last_user or "").strip():
                    return "explore"
                if s in ("intro", "explore") and intent == "interest":
                    return "offer"
                if s == "offer":
                    return "closing"
                return s

            def _select_history(window: int = 8) -> List[Dict]:
                window = int(window or 8)
                window = max(6, min(10, window))
                tail = list(context.get("messages") or [])[1:]  # exclude system
                if not tail:
                    return []

                # Always include last user message.
                last_user_idx = None
                for i in range(len(tail) - 1, -1, -1):
                    if isinstance(tail[i], dict) and tail[i].get("role") == "user":
                        last_user_idx = i
                        break

                if last_user_idx is None:
                    selected = tail[-window:]
                else:
                    start = max(0, last_user_idx - (window - 1))
                    selected = tail[start:last_user_idx + 1]

                # Provider constraint: first non-system message should be from user.
                while selected and isinstance(selected[0], dict) and selected[0].get("role") != "user":
                    selected = selected[1:]
                return selected

            last_user_text = _get_last_user_text()
            last_user_lc = (last_user_text or "").lower()
            lang = (context.get("language") or "en").lower()
            context_type = context.get("context_type")
            context_data = context.get("context_data") or {}
            ctx_label, ctx_purpose = self.get_context_prompt(context_type, context_data)

            # Identity gate (hard rule): do not proceed until confirmed.
            if (context.get("state") or "identity_check") == "identity_check":
                return self._ensure_complete_spoken_response(
                    self.handle_identity_check(context, last_user_text),
                    lang,
                )

            # End-call / not-interested detection (hard rule).
            end_keywords = (
                "bye", "goodbye", "hang up", "don't call again", "dont call again",
                "not interested", "stop calling", "stop",
            )
            if any(k in last_user_lc for k in end_keywords):
                context["conversation_done"] = True
                context["state"] = "closing"
                closing = {
                    "en": "Got it — thanks for your time. Take care!",
                    "hi": "ठीक है — आपके समय के लिए धन्यवाद। अपना ख्याल रखिए!",
                    "ta": "சரி — உங்கள் நேரத்திற்கு நன்றி. பார்த்துக்கொள்ளுங்கள்!",
                    "te": "సరే — మీ సమయానికి ధన్యవాదాలు. జాగ్రత్తగా ఉండండి!",
                    "ml": "ശരി — നിങ്ങളുടെ സമയത്തിന് നന്ദി. ശ്രദ്ധിക്കുക!",
                }
                return self._ensure_complete_spoken_response(closing.get(lang, closing["en"]), lang)

            # Filler-only responses: short acknowledgement, no LLM call.
            if self._is_filler_utterance(last_user_text):
                acks = {
                    "en": ["Got it — makes sense.", "Okay — understood.", "Alright — got it."],
                    "hi": ["ठीक है — समझ गया।", "अच्छा — ठीक है।", "समझ गया — ठीक है।"],
                }
                choices = acks.get(lang, acks["en"])
                pick = choices[int(context.get("turn_count") or 0) % len(choices)]
                context["intent"] = "neutral"
                context["state"] = _advance_state(context.get("state") or "intro", "neutral", last_user_text)
                return self._ensure_complete_spoken_response(pick, lang)

            # Safety cutoff (not a scripted flow): avoid runaway calls.
            if int(context.get("turn_count") or 0) >= 12:
                context["conversation_done"] = True
                context["state"] = "closing"
                closing = {
                    "en": "Thanks for your time — take care!",
                    "hi": "आपके समय के लिए धन्यवाद — अपना ख्याल रखिए!",
                }
                return self._ensure_complete_spoken_response(closing.get(lang, closing["en"]), lang)

            intent = _detect_intent(last_user_text)
            context["intent"] = intent
            # Post-identity: we keep the main state simple (active_conversation/closing).
            if (context.get("state") or "").lower() not in ("active_conversation", "closing"):
                context["state"] = "active_conversation"

            # Context-driven intent handling (fast, no LLM call).
            if intent == "busy":
                busy_msg = {
                    "en": "No problem — when should I call back?",
                    "hi": "कोई बात नहीं — मैं कब वापस कॉल करूँ?",
                }
                return self._ensure_complete_spoken_response(busy_msg.get(lang, busy_msg["en"]), lang)

            if intent == "confused":
                explain = {
                    "en": f"Quick context — this call is about {ctx_purpose} Would you like me to repeat that slowly?",
                    "hi": "एक छोटा सा संदर्भ — यह कॉल इसी वजह से है। क्या मैं धीरे से दोहरा दूँ?",
                }
                return self._ensure_complete_spoken_response(explain.get(lang, explain["en"]), lang)

            lang_names = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "ml": "Malayalam"}
            system_with_context = "\n".join(
                [
                    context["messages"][0]["content"],
                    f"Conversation context: {ctx_label}",
                    f"Purpose of call: {ctx_purpose}",
                    f"Current conversation stage: {context.get('state', 'active_conversation')}",
                    f"User intent: {intent}",
                    f"Respond in {lang_names.get(lang, 'English')} only.",
                    "Be natural, short, and voice-friendly (1–2 short sentences).",
                    "Stay on the context topic; if the user changes topics, acknowledge briefly and steer back to the purpose.",
                ]
            )

            messages = [{"role": "system", "content": system_with_context}] + _select_history(history_limit or 8)

            # Performance: cap output tokens for real-time voice.
            max_tokens = int(max_tokens or 140)
            max_tokens = max(60, min(150, max_tokens))

            agent_text = None
            if prefer_gemini:
                agent_text = self._call_gemini_llm(messages=messages, max_tokens=max_tokens, temperature=temperature)
            if not agent_text:
                agent_text = self.sarvam.call_llm_safe(
                    messages=messages,
                    model="sarvam",
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
            if not agent_text or not str(agent_text).strip():
                return None

            agent_text = re.sub(r"<think>.*?</think>\s*", "", str(agent_text), flags=re.DOTALL).strip()
            agent_text = self._ensure_complete_spoken_response(agent_text, lang)
            return agent_text
        
        except Exception as e:
            logger.error(f"Error in generate_next_response: {str(e)}")
            return None
    
    # ==================== TTS (Text-to-Speech) ====================
    
    def text_to_speech_url(self, agent_text: str, language: str) -> Optional[str]:
        """
        Convert text to speech and return endpoint URL (on-the-fly, no file storage)
        
        Args:
            agent_text: Text to convert
            language: Language code
            
        Returns:
            URL to audio endpoint or None if failed
        """
        try:
            # Validate text is not empty
            if not agent_text or not isinstance(agent_text, str) or len(agent_text.strip()) == 0:
                logger.error(f"❌ TTS error: Empty or invalid text provided")
                return None
            
            import urllib.parse
            
            tts_lang_map = {
                "en": "en-IN",
                "hi": "hi-IN",
                "ta": "ta-IN",
                "te": "te-IN",
                "ml": "ml-IN"
            }
            tts_language = tts_lang_map.get(language, "en-IN")

            # URL encode the text
            encoded_text = urllib.parse.quote(agent_text.strip())
            # Force female voice for ALL responses (Sarvam TTS).
            voice_gender = "female"
            voice_id = os.getenv("SARVAM_TTS_VOICE_ID_FEMALE", "").strip()
            voice_q = f"&voice_gender={urllib.parse.quote(voice_gender)}"
            if voice_id:
                voice_q += f"&voice_id={urllib.parse.quote(voice_id)}"

            audio_url = f"/api/v1/audio/generate?text={encoded_text}&language={tts_language}{voice_q}"
            
            logger.info(f"✓ TTS URL generated: {tts_language} ({len(agent_text)} chars)")
            return audio_url
        
        except Exception as e:
            logger.error(f"Error in text_to_speech_url: {str(e)}")
            return None
    
    # ==================== CALL MANAGEMENT ====================
    
    def end_conversation(self, call_sid: str) -> Optional[Dict]:
        """
        End conversation and save to database
        
        Args:
            call_sid: Twilio call ID
            
        Returns:
            Conversation summary
        """
        try:
            context = self.get_conversation_context(call_sid)
            if not context:
                logger.warning(f"Conversation context not found: {call_sid}")
                return None
            
            customer_id = context["customer_id"]
            duration = (datetime.utcnow() - context["start_time"]).total_seconds()
            
            # Extract conversation for storage (skip system message)
            conversation_text = "\n".join([
                f"{msg['role'].upper()}: {msg['content']}"
                for msg in context["messages"][1:]  # Skip system message
            ])
            
            # Analyze overall sentiment
            if context["sentiment_history"]:
                positive_count = sum(1 for s in context["sentiment_history"] if s == "positive")
                negative_count = sum(1 for s in context["sentiment_history"] if s == "negative")
                overall_sentiment = "positive" if positive_count > negative_count else ("negative" if negative_count > positive_count else "neutral")
            else:
                overall_sentiment = "neutral"
            
            # Save to database
            call_record = CallHistory(
                customer_id=customer_id,
                call_date=datetime.utcnow(),
                call_duration=int(duration),
                call_status="completed",
                conversation_transcript=conversation_text,
                sentiment=overall_sentiment,
                agent_notes=f"LLM-driven, Turns: {context['turn_count']}, Language: {context['language']}"
            )
            self.session.add(call_record)
            self.session.commit()
            
            # Clean up conversation
            del CONVERSATION_HISTORY[call_sid]
            
            logger.info(f"✓ Call ended: customer={customer_id}, duration={int(duration)}s, turns={context['turn_count']}, sentiment={overall_sentiment}")
            
            return {
                "customer_id": customer_id,
                "duration": int(duration),
                "turns": context["turn_count"],
                "sentiment": overall_sentiment
            }
        
        except Exception as e:
            logger.error(f"Error ending conversation: {str(e)}")
            return None
    
    def get_greeting(self, customer_name: str, language: str = "en") -> str:
        """Get personalized greeting"""
        greetings = {
            "en": f"Hello {customer_name}! This is calling from Beacon Hotel. How are you doing today?",
            "hi": f"नमस्ते {customer_name}! यह बीकन होटल की ओर से कॉल है। आप कैसे हैं?",
            "ta": f"வணக்கம் {customer_name}! பீகன் ஹோட்டலில் இருந்து அழைக்கிறோம்.",
            "te": f"హలో {customer_name}! బీకన్ హోటల్ నుండి కాల్ చేస్తున్నాం.",
            "ml": f"ഹലോ {customer_name}! ബീകൻ ഹോട്ടലിൽ നിന്നുള്ള കോൾ ആണ്.",
        }
        return greetings.get(language, greetings["en"])
    
    def get_next_twiml(self, audio_url: str, webhook_url: str, language: str = "en") -> str:
        """
        Generate TwiML for playing audio and recording user response
        
        Uses Twilio <Record> to capture raw audio → Sarvam STT for transcription
        (NOT Twilio's limited STT)
        
        Args:
            audio_url: URL to audio file to play
            webhook_url: Webhook URL to receive recording URL
            language: Language code (en, hi, ta, te, ml) - passed to webhook
            
        Returns:
            TwiML XML string
        """
        try:
            # Escape URLs for XML
            audio_url_xml = audio_url.replace("&", "&amp;")

            # Add language to callback URL
            separator = "&" if "?" in webhook_url else "?"
            callback_url = f"{webhook_url}{separator}language={language}"
            callback_url_xml = callback_url.replace("&", "&amp;")

            # IMPORTANT:
            # - action: controls call flow and expects TwiML response (used for conversation loop)
            # If action is missing, Twilio can complete the <Record> and then end the call.
            # NOTE: Avoid using recordingStatusCallback here with the same webhook,
            # otherwise the same recording may be processed twice.
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Play>{audio_url_xml}</Play>
                <Record maxLength="30" timeout="5" playBeep="true"
                        action="{callback_url_xml}" method="POST"
                        />
            </Response>"""
            
            logger.debug(f"Generated TwiML with Record (using Sarvam STT for lang={language})")
            return twiml
        
        except Exception as e:
            logger.error(f"Error generating TwiML: {str(e)}")
            return """<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say>Thank you for your time.</Say>
            </Response>"""
    
    def get_greeting_script(self, customer_name: str, detected_language: str = "en") -> str:
        """
        Generate warm greeting based on language and customer info
        IMPORTANT: This returns ONLY the greeting, NOT the prompt!
        The prompt "Please say yes or hi to continue" is added separately in TwiML Gather tag.
        
        Args:
            customer_name: Customer's name
            detected_language: Language code (en, hi, etc)
            
        Returns:
            Greeting script in appropriate language (without prompt)
        """
        greetings = {
            "en": f"Hello {customer_name}! This is calling from Beacon Hotel. How are you doing today?",
            "hi": f"नमस्ते {customer_name}! यह बीकन होटल की ओर से कॉल है। आप कैसे हैं?",
            "ta": f"வணக்கம் {customer_name}! பீகன் ஹோட்டலில் இருந்து அழைக்கிறோம். நீங்கள் எப்படி இருக்கிறீர்கள்?",
            "te": f"హలో {customer_name}! బీకన్ హోటల్ నుండి కాల్ చేస్తున్నాం. మీరు ఎలా ఉన్నారు?",
            "ml": f"ഹലോ {customer_name}! ബീകൻ ഹോട്ടലിൽ നിന്നുള്ള കോൾ ആണ്. നിങ്ങൾ എങ്ങനെയുണ്ട്?"
        }
        return greetings.get(detected_language, greetings["en"])
    
    def get_experience_question(self, customer_name: str, language: str) -> str:
        """Ask about customer's experience at hotel"""
        questions = {
            "en": f"That's wonderful {customer_name}! I'm so glad to hear. How was your last experience with us at Beacon Hotel? Was everything good?",
            "hi": f"बहुत अच्छा {customer_name}! मुझे खुशी है। बीकन होटल में आपका अनुभव कैसा रहा? क्या सब कुछ ठीक था?",
            "ta": f"அருமை {customer_name}! என்னுடைய மகிழ்ச்சி. பீகன் ஹோட்டலில் உங்கள் அனுபவம் எப்படி இருந்தது? நல்லிருந்ததா?",
        }
        return questions.get(language, questions["en"])
    
    def get_visit_plans_question(self, customer_name: str, language: str) -> str:
        """Ask about future visit plans"""
        questions = {
            "en": f"Thank you for sharing that {customer_name}! That's wonderful to hear. Are you planning to visit us again soon? We'd love to see you!",
            "hi": f"वह शेयर करने के लिए धन्यवाद {customer_name}! क्या आप जल्द ही हमसे फिर से मिलने की योजना बना रहे हैं?",
            "ta": f"அதை சொல்லியதற்கு நன்றி {customer_name}! நீங்கள் மீண்டும் வர திட்டம் இருக்கிறதா?",
        }
        return questions.get(language, questions["en"])
    
    def get_loyalty_offer(self, customer_name: str, discount: float, language: str) -> str:
        """Present loyalty offer"""
        offers = {
            "en": f"Since you're such a valued guest {customer_name}, we have an exclusive {int(discount)}% loyalty discount waiting for you! We'd love to welcome you back. Shall I transfer you to our booking team?",
            "hi": f"{customer_name}, आप हमारे मूल्यवान अतिथि हैं। हमारे पास आपके लिए {int(discount)}% की विशेष छूट है! क्या आप बुकिंग टीम से बात करना चाहेंगे?",
            "ta": f"{customer_name}, நீங்கள் எங்களின் மূல்யமான விருந்தினர்! உங்களுக்கு {int(discount)}% ছাড் உள்ளது! புককிங் டீமுடன் பேச விரும்புகிறீர்களா?",
        }
        return offers.get(language, offers["en"])
    
    def create_twiml_with_listen(self, text_to_say: str, action_url: str, 
                                 num_digits: int = 0, hint: str = "speech") -> str:
        """
        Create TwiML that plays text AND listens for response
        
        Args:
            text_to_say: Text for TTS
            action_url: Webhook URL for processing response
            num_digits: If >0, expect keypresses; if 0, expect speech
            hint: For speech recognition ("yes no", "currency", "speech" etc)
            
        Returns:
            TwiML XML string
        """
        if num_digits > 0:
            # Listen for keypress
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say>{text_to_say}</Say>
                <Gather numDigits="{num_digits}" timeout="5" action="{action_url}" method="POST">
                    <Say>Press 1 for yes, 2 for no, or just speak your response.</Say>
                </Gather>
                <Fallback>
                    <Say>Sorry, I didn't catch that. Let me transfer you to our team.</Say>
                </Fallback>
            </Response>"""
        else:
            # Listen for speech (speech recognition)
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say>{text_to_say}</Say>
                <Gather input="speech" speechTimeout="auto" hints="{hint}" 
                        action="{action_url}" method="POST">
                    <Say>Please tell me your response.</Say>
                </Gather>
                <Fallback>
                    <Say>Sorry, I didn't catch that. Please try again.</Say>
                </Fallback>
            </Response>"""
        
        return twiml
