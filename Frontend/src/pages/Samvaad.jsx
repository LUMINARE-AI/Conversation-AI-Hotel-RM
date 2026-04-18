import { useCallback, useRef, useState } from "react";
import { api } from "../services/api";

const CALL_MAX_SECONDS = 120;
const USER_SILENCE_SECONDS = 45;
const VOICE_RMS_THRESHOLD = 0.014;

function pcm16BufferRms(arrayBuffer) {
  const v = new Int16Array(arrayBuffer);
  if (v.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const x = v[i] / 32768;
    s += x * x;
  }
  return Math.sqrt(s / v.length);
}

function formatClock(totalSec) {
  const t = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Mandala / scallop blob shape via SVG clip-path ────────────────────────────
// Each card gets its own gradient theme in Beacon's indigo-violet palette
const MODES = [
  {
    id: "hotel",
    label: "Hotel Concierge",
    sublabel: "Room service, bookings & guest queries",
    gradient: ["#6366f1", "#a78bfa", "#818cf8"], // indigo → violet
    glow: "rgba(99,102,241,0.45)",
    btnBg: "rgba(255,255,255,0.22)",
  },
  {
    id: "election",
    label: "Election Campaigns",
    sublabel: "Post-stay surveys & sentiment capture",
    gradient: ["#8b5cf6", "#c084fc", "#6366f1"], // violet → purple
    glow: "rgba(139,92,246,0.45)",
    btnBg: "rgba(255,255,255,0.22)",
  },
  {
    id: "feedback",
    label: "Hospital Feedback",
    sublabel: "Healthcare surveys & patient interactions",
    gradient: ["#4f46e5", "#7c3aed", "#a78bfa"], // deep indigo → violet
    glow: "rgba(79,70,229,0.45)",
    btnBg: "rgba(255,255,255,0.22)",
  },
];

// SVG scallop / mughal arch blob — same silhouette as screenshot
function BlobShape({ gradient, glow, id, children }) {
  const gradId = `grad-${id}`;
  const filterId = `glow-${id}`;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 280, height: 280 }}
    >
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          filter: `drop-shadow(0 0 28px ${glow})`,
        }}
      >
        <defs>
          <radialGradient id={gradId} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor={gradient[1]} stopOpacity="1" />
            <stop offset="55%" stopColor={gradient[0]} stopOpacity="1" />
            <stop offset="100%" stopColor={gradient[2]} stopOpacity="0.85" />
          </radialGradient>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Scalloped mandala path — 8-pointed with concave arcs */}
        <path
          fill={`url(#${gradId})`}
          d="
            M100,8
            C108,8 114,20 114,28
            C122,18 134,14 140,20
            C146,26 142,38 134,44
            C144,46 154,54 154,62
            C154,70 144,76 134,76
            C142,84 144,96 138,100
            C144,104 142,116 134,124
            C144,128 146,140 140,146
            C134,152 122,148 114,138
            C114,146 108,158 100,158
            C92,158 86,146 86,138
            C78,148 66,152 60,146
            C54,140 58,128 66,124
            C58,118 54,106 60,100
            C54,94 58,84 66,76
            C56,76 46,70 46,62
            C46,54 56,46 66,44
            C58,38 54,26 60,20
            C66,14 78,18 86,28
            C86,20 92,8 100,8Z
          "
        />
        {/* Inner soft highlight */}
        <ellipse
          cx="100"
          cy="90"
          rx="42"
          ry="38"
          fill="white"
          fillOpacity="0.10"
        />
      </svg>
      {/* Content on top */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        {children}
      </div>
    </div>
  );
}

export default function Samvaad() {
  const wsRef = useRef(null);
  const [activeMode, setActiveMode] = useState(null); // which card is recording
  const audioCtxRef = useRef(null);
  const workletRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  /** Pause mic→server while assistant audio plays (avoids echo / false STT). */
  const sendingEnabledRef = useRef(true);
  const lastBlobUrlRef = useRef(null);
  const sessionStartMsRef = useRef(0);
  const lastUserVoiceMsRef = useRef(0);
  const callTimerRef = useRef(null);
  const [callElapsedSec, setCallElapsedSec] = useState(0);
  const [endedNote, setEndedNote] = useState(null);

  const clearCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(
    (endKind) => {
      clearCallTimer();
      sendingEnabledRef.current = true;
      if (lastBlobUrlRef.current) {
        URL.revokeObjectURL(lastBlobUrlRef.current);
        lastBlobUrlRef.current = null;
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());

      workletRef.current?.disconnect();
      audioCtxRef.current?.close();
      wsRef.current?.close();

      audioRef.current = null;

      streamRef.current = null;
      audioCtxRef.current = null;
      workletRef.current = null;
      wsRef.current = null;

      setActiveMode(null);
      setCallElapsedSec(0);
      if (endKind === "max") {
        setEndedNote("Session ended: 2:00 limit reached.");
      } else if (endKind === "idle") {
        setEndedNote(
          `Session ended: no speech for ${USER_SILENCE_SECONDS} seconds.`
        );
      } else {
        setEndedNote(null);
      }
    },
    [clearCallTimer]
  );

  const startRecording = async (modeId) => {
  try {
    clearCallTimer();
    setEndedNote(null);
    sendingEnabledRef.current = true;
    sessionStartMsRef.current = Date.now();
    lastUserVoiceMsRef.current = Date.now();
    setCallElapsedSec(0);

    const USER_SILENCE_MS = USER_SILENCE_SECONDS * 1000;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;

    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;

    await audioCtx.resume();

    const source = audioCtx.createMediaStreamSource(stream);

    await audioCtx.audioWorklet.addModule('/pcm-processor.js');
    const worklet = new AudioWorkletNode(audioCtx, 'pcm-processor');
    workletRef.current = worklet;

    // ✅ Audio instance
    audioRef.current = new Audio();
    audioRef.current.autoplay = true;

    // 🔥 WebSocket
    const ws = new WebSocket(api.getSamvaadStreamURL());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ Connected");

      ws.binaryType = "arraybuffer"; // 🔥 CRITICAL FIX

      ws.send(JSON.stringify({
        type: "init",
        mode: modeId,
        sample_rate: audioCtx.sampleRate,
      }));
    };

    // Text control frames (mute mic before binary TTS arrives)
    ws.onmessage = async (event) => {
      if (typeof event.data === "string") {
        try {
          const p = JSON.parse(event.data);
          if (p.type === "assistant_reply_pending") {
            sendingEnabledRef.current = false;
          }
        } catch (_) {
          /* ignore */
        }
        return;
      }

      try {
        console.log("🎧 Audio bytes:", event.data.byteLength);

        sendingEnabledRef.current = false;

        const audioBlob = new Blob([event.data], { type: 'audio/mpeg' }); // 🔥 ADD MIME TYPE
        if (lastBlobUrlRef.current) {
          URL.revokeObjectURL(lastBlobUrlRef.current);
          lastBlobUrlRef.current = null;
        }
        const audioUrl = URL.createObjectURL(audioBlob);
        lastBlobUrlRef.current = audioUrl;

        const resumeMic = () => {
          setTimeout(() => {
            sendingEnabledRef.current = true;
            lastUserVoiceMsRef.current = Date.now();
          }, 280);
        };

        if (audioRef.current) {
          audioRef.current.onended = null;
          audioRef.current.onerror = null;
          audioRef.current.pause();
          audioRef.current.currentTime = 0;

          audioRef.current.src = audioUrl;
          audioRef.current.onended = () => {
            if (lastBlobUrlRef.current === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              lastBlobUrlRef.current = null;
            }
            resumeMic();
          };
          audioRef.current.onerror = () => {
            if (lastBlobUrlRef.current === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              lastBlobUrlRef.current = null;
            }
            resumeMic();
          };
          await audioRef.current.play();
        }

      } catch (err) {
        console.error("❌ Audio play failed:", err);
        sendingEnabledRef.current = true;
        lastUserVoiceMsRef.current = Date.now();
      }
    };

    ws.onerror = (e) => console.error("WS error:", e);
    ws.onclose = () => console.log("WS closed");

    // 🔥 IMPORTANT: ONLY mic → worklet (NO speaker loop)
    source.connect(worklet);

    // 🔥 send audio (skipped while assistant TTS is playing)
    worklet.port.onmessage = (e) => {
      if (!sendingEnabledRef.current) return;
      if (pcm16BufferRms(e.data) > VOICE_RMS_THRESHOLD) {
        lastUserVoiceMsRef.current = Date.now();
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const bytes = new Uint8Array(e.data);

        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }

        const base64 = btoa(binary);

        wsRef.current.send(JSON.stringify({
          type: "audio_chunk",
          audio: base64,
        }));
      }
    };

    callTimerRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - sessionStartMsRef.current) / 1000
      );
      setCallElapsedSec(Math.min(elapsed, CALL_MAX_SECONDS));
      if (elapsed >= CALL_MAX_SECONDS) {
        stopRecording("max");
        return;
      }
      if (
        sendingEnabledRef.current &&
        wsRef.current?.readyState === WebSocket.OPEN &&
        Date.now() - lastUserVoiceMsRef.current > USER_SILENCE_MS
      ) {
        stopRecording("idle");
      }
    }, 1000);

    setActiveMode(modeId);

  } catch (err) {
    console.error("Mic error:", err);
    clearCallTimer();
  }
};

  const handleClick = (modeId) => {
    if (activeMode === modeId) {
      stopRecording();
    } else {
      if (activeMode) stopRecording();
      startRecording(modeId);
    }
  };

  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-[26px] font-extrabold text-slate-900 tracking-tight leading-tight">
            Experience Samvaad
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Samvaad-style voice — Luminare AI & Sarvam · natural two-way conversation
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span
            className="w-2 h-2 rounded-full bg-emerald-500"
            style={{
              boxShadow: "0 0 6px rgba(16,185,129,0.7)",
              animation: "ping 1.5s ease-in-out infinite",
            }}
          />
          <span className="text-sm font-semibold text-slate-700">LIVE</span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-200 mb-12" />

      {/* Blob cards */}
      <div className="flex items-start justify-center gap-16 flex-wrap">
        {MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <div key={mode.id} className="flex flex-col items-center gap-5">
              <BlobShape gradient={mode.gradient} glow={mode.glow} id={mode.id}>
                {/* Pulse ring when active */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: "2px solid rgba(255,255,255,0.4)",
                      animation: "ping 1s ease-in-out infinite",
                      borderRadius: "50%",
                      margin: "10%",
                    }}
                  />
                )}

                {/* CTA button */}
                <button
                  onClick={() => handleClick(mode.id)}
                  className="px-7 py-3 text-white rounded-full text-[14px] font-semibold tracking-wide transition-all duration-300 select-none cursor-pointer transform hover:scale-105"
                  style={{
                    background: isActive
                      ? "rgba(255,255,255,0.35)"
                      : "rgba(255,255,255,0.20)",
                    backdropFilter: "blur(8px)",
                    border: "1.5px solid rgba(255,255,255,0.35)",
                    boxShadow: isActive
                      ? "0 0 20px rgba(255,255,255,0.3)"
                      : "0 2px 12px rgba(0,0,0,0.12)",
                    letterSpacing: "0.02em",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.color = "#000000";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isActive
                      ? "rgba(255,255,255,0.35)"
                      : "rgba(255,255,255,0.20)";
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  {isActive ? "■ Stop" : "Start Speaking"}
                </button>

                {/* Mic icon when active */}
                {isActive && (
                  <div className="flex gap-0.5 items-end h-4">
                    {[2, 4, 3, 5, 2, 4, 3].map((h, i) => (
                      <div
                        key={i}
                        className="w-0.5 rounded-full bg-white/70"
                        style={{
                          height: `${h * 3}px`,
                          animation: `barBounce 0.6s ease-in-out ${i * 0.08}s infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </BlobShape>

              {/* Label */}
              <div className="text-center">
                <p className="text-[15px] font-semibold text-slate-800">
                  {mode.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 max-w-45 leading-relaxed">
                  {mode.sublabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active session banner */}
      {activeMode && (
        <div className="mt-14 mx-auto max-w-md bg-white border border-indigo-100 rounded-2xl px-6 py-4 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Session Active</p>
            <p className="text-xs text-slate-400">
              {MODES.find((m) => m.id === activeMode)?.label} — listening…
            </p>
            <p className="text-xs font-mono text-indigo-600 font-semibold mt-1.5 tabular-nums">
              {formatClock(callElapsedSec)} / {formatClock(CALL_MAX_SECONDS)}
              <span className="text-slate-400 font-normal ml-2 font-sans">
                (auto-ends at 2:00)
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => stopRecording()}
            className="px-4 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-500 hover:text-white transition-all shrink-0"
          >
            End
          </button>
        </div>
      )}

      {endedNote && !activeMode && (
        <p className="mt-6 text-center text-sm text-slate-600 max-w-md mx-auto">
          {endedNote}
        </p>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes barBounce {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }
        @keyframes ping {
          0%   { opacity: 1;   transform: scale(1); }
          80%  { opacity: 0;   transform: scale(1.4); }
          100% { opacity: 0;   transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
