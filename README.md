# Luminare AI

## 📋 Project Overview

**LuminareAI** is an AI-powered voice agent that makes outbound phone calls to hotel customers for relationship management. The system uses **LiveKit SIP** for real-time voice communication, **Sarvam AI** (via `SERVAM_*` env configuration) for Speech-to-Text, LLM reasoning, and Text-to-Speech, and **Twilio** for PSTN connectivity. The AI agent "Raj" calls customers, checks in on their experience, and offers personalized loyalty discounts.

A **React (Vite) + Tailwind** web dashboard provides login, customer and call workflows, reports, and **admin-only user management**. Voice-Labs HTTP APIs under `/api/v1/` are protected by **JWT** (httpOnly cookie or `Authorization: Bearer`).

### 🎯 Key Features

- **Outbound AI Voice Calls**: Automated phone calls via Twilio SIP → LiveKit → AI Agent
- **Real-time STT/TTS Pipeline**: Sarvam saaras:v3 (STT) → sarvam-m (LLM) → bulbul:v3 (TTS)
- **Personalized Conversations**: Agent "Raj" speaks naturally with customer context (visits, loyalty score, preferences)
- **Tiered Discount Strategy**: 20% (5+ visits), 15% (2–4 visits), 10% (new customers)
- **Automatic Call Ending**: Goodbye detection + max turn limit with SIP hangup
- **Audio Recording**: Records both caller and agent audio as WAV files (served under `/audio`)
- **Multilingual Support**: English and Hindi (en-IN / hi-IN) in the voice agent; additional languages selectable in the Call UI where supported
- **Churn Risk Analysis**: Customer analysis with engagement scoring (`RelationshipManagerAgent`)
- **REST API**: FastAPI with automatic OpenAPI docs (`/docs`)
- **Think-Tag Stripping**: Robust handling of LLM reasoning output (sarvam-m emits `<redacted_thinking>` blocks)
- **Web Dashboard**: JWT authentication, role-based **admin** / **user** access, Voice-Labs API integration
- **Voice Labs** (in-browser demo, `Frontend/src/pages/Samvaad.jsx`): **two-way voice** in the browser over **`WebSocket`** (`/api/v1/stream/web/ws`) to the same Sarvam pipeline — **AudioWorklet** (`Frontend/public/pcm-processor.js`) streams **PCM16** mic audio as **base64 JSON**; assistant replies as **MPEG** audio; **mic muted during TTS** to reduce echo; **2:00 max session** and **45s idle** auto-end; three scenario cards (**Hotel Concierge**, **Election Campaigns**, **Hospital Feedback**) send `mode`: `hotel` | `election` | `feedback` on session `init`

---

## 🎙️ Voice Labs (browser)

The **Voice Labs** page is the **Voice Labs** experience: natural **browser ↔ server** voice chat (no PSTN), backed by **`src/api/web_ws.py`** on **`/api/v1/stream/web/ws`**.

| Aspect | Implementation |
|--------|------------------|
| **Auth** | JWT required (cookie or token — WebSocket reads `ACCESS_TOKEN_COOKIE` / `token` query; same user gate as other Voice-Labs pages). |
| **Mic capture** | `navigator.mediaDevices.getUserMedia` with echo cancellation / noise suppression / AGC. |
| **Processing** | `AudioContext` (16 kHz) + **AudioWorklet** (`pcm-processor`) → PCM16 buffers. |
| **Upstream** | JSON frames: `{ type: "init", mode, sample_rate }`, then `{ type: "audio_chunk", audio: "<base64>" }`. |
| **Downstream** | Text control (e.g. `assistant_reply_pending`); binary **MPEG** TTS played via `HTMLAudioElement`. |
| **Echo / barge-in** | Mic send path disabled while assistant audio is pending/playing; resumes after playback. |
| **Session limits** | **120 s** max call duration; end if **no speech** for **45 s** (configurable constants in `Samvaad.jsx`). |
| **UI** | Three **mandala-style** gradient cards (theme presets); **LIVE** badge; session timer **0:00 / 2:00**; Start/Stop per card. |

In development, Vite proxies **`/api`** (including WebSockets) to **`http://localhost:8000`** — connect from the same origin so cookies work.

---

## 🏗️ Architecture

```
┌──────────────┐     SIP/PSTN      ┌──────────────┐    WebRTC     ┌──────────────────────┐
│   Customer   │ ◄──────────────── │    Twilio     │ ◄──────────► │   LiveKit Cloud      │
│   Phone      │                   │  SIP Trunk    │              │   (India South)      │
└──────────────┘                   └──────────────┘              └──────────┬───────────┘
                                                                           │
                                                                    WebRTC │ Audio
                                                                           │
                                                                 ┌─────────▼───────────┐
                                                                 │   AI Agent (Python)  │
                                                                 │                      │
                                                                 │  Caller Audio ──►   │
                                                                 │  Sarvam STT ──►     │
                                                                 │  Sarvam LLM ──►     │
                                                                 │  Sarvam TTS ──►     │
                                                                 │  ──► LiveKit Audio   │
                                                                 └──────────────────────┘
```

**Call Flow:**

1. Authenticated client calls FastAPI → outbound LiveKit SIP endpoint (`/api/v1/calls/test-livekit-sip`)
2. LiveKit room is created, AI agent dispatched (`run_agent.py` worker)
3. SIP call placed via Twilio to customer's phone
4. Customer audio → Sarvam STT (saaras:v3) → text
5. Text → Sarvam LLM (sarvam-m, `reasoning_effort="low"`) → response (think-tags stripped)
6. Response → Sarvam TTS (bulbul:v3, speaker "aditya") → audio
7. Audio played back to customer via LiveKit → SIP → Twilio → PSTN
8. Goodbye detected → SIP participant removed → call ends

---

## 🛠️ Technology Stack

### Core (backend)

- **Python 3.11+**
- **FastAPI** (see `requirements.txt` for pinned/minimum versions) with automatic OpenAPI docs
- **Uvicorn**: ASGI server (port **8000**)
- **SQLAlchemy**: ORM
- **SQLite** (default; configurable via `DATABASE_URL`)

### Frontend

- **React 19**, **Vite**, **Tailwind CSS** (`Frontend/`)
- Dev server proxies `/api` and WebSockets to `http://localhost:8000` (`Frontend/vite.config.js`)

### Voice & AI Services

- **Sarvam AI** (`sarvamai` package; credentials via `SERVAM_API_KEY` in `.env`):
  - **STT**: `saaras:v3` — Speech-to-Text (REST API, e.g. en-IN / hi-IN)
  - **TTS**: `bulbul:v3` — Text-to-Speech (speaker `"aditya"`, linear16, 16kHz)
  - **LLM**: `sarvam-m` — Reasoning model with `reasoning_effort="low"` and streaming support

### Real-time Communication

- **LiveKit** (`livekit`, `livekit-agents`, `livekit-api`):
  - LiveKit Cloud (e.g. India South region)
  - SIP service for PSTN bridging
  - WebRTC rooms for real-time audio
- **Twilio**: Elastic SIP Trunking for PSTN connectivity

### Analysis & Reporting

- **Pandas**, **NumPy**

### Authentication

- **JWT** (`python-jose`) stored in **httpOnly** cookies (or `Authorization: Bearer` header)
- **bcrypt** password hashes (`src/auth/passwords.py`)

---

## 📁 Project Structure

```
Conversation-AI-Hotel-RM/
├── Frontend/                         # React + Vite + Tailwind SPA
│   ├── src/                          # Pages (incl. Samvaad.jsx), components, AuthContext, api client
│   ├── public/
│   │   └── pcm-processor.js          # AudioWorklet for 16 kHz PCM capture (Voice Labs)
│   ├── vite.config.js                # Proxies /api (+ WS) → localhost:8000
│   └── package.json
├── src/
│   ├── main_fastapi.py               # FastAPI app (port 8000); uvicorn entrypoint
│   ├── main.py                       # Legacy Flask application
│   ├── api/
│   │   ├── auth_routes.py            # Login, logout, /me, admin user CRUD
│   │   └── web_ws.py                 # Browser voice WebSocket (/api/v1/stream/web/ws)
│   ├── auth/
│   │   ├── api_middleware.py         # JWT required for /api/v1/* HTTP routes
│   │   ├── jwt_utils.py              # JWT create/decode
│   │   ├── bootstrap.py              # seed_default_admin()
│   │   └── passwords.py
│   ├── agents/
│   │   └── relationship_manager_agent.py
│   ├── services/
│   │   ├── livekit_sip_agent.py      # Main SIP voice agent (STT→LLM→TTS)
│   │   ├── livekit_streaming_service.py
│   │   ├── servam_service.py         # Sarvam / Servam API wrapper (config uses SERVAM_*)
│   │   ├── twilio_service.py
│   │   ├── audio_service.py
│   │   ├── conversational_call_handler.py
│   │   └── dify_agent.py
│   ├── models/
│   │   └── database.py               # Customer, CallHistory, User, etc.
│   └── utils/
│       ├── call_logger.py
│       └── dummy_data_generator.py
├── config/
│   └── config.py                     # Environment-based configuration
├── docs/
│   └── INTERNSHIP_INTERVIEW_PREP.md  # Study notes (optional)
├── run_agent.py                      # LiveKit agent worker launcher
├── audio/                            # Recorded WAV files (mounted at /audio)
├── logs/
│   └── agent_session.log
├── data/                             # SQLite DB path default, Excel exports
├── scripts/
├── examples/
├── tests/
├── requirements.txt
├── setup.bat / setup.sh
└── README.md
```

---

## ⚙️ Installation & Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ (for the Frontend)
- Twilio account with Elastic SIP Trunking
- Sarvam AI API key
- LiveKit Cloud account (or self-hosted LiveKit server)

### Step 1: Clone and virtual environment

```bash
git clone <repository_url>
cd Conversation-AI-Hotel-RM
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
```

### Step 2: Backend dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Configure environment

Create a `.env` file in the project root. The app reads Sarvam-related settings via **`SERVAM_*`** variable names (see `config/config.py`):

```bash
# Sarvam AI (env prefix SERVAM_* in code)
SERVAM_API_KEY=your-sarvam-api-key
SERVAM_API_URL=https://api.servam.com
SERVAM_STT_MODEL=saaras:v3
SERVAM_TTS_MODEL=bulbul:v3
SERVAM_LLM_MODEL=sarvam

# LiveKit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_SIP_TRUNK_ID=your-sip-trunk-id

# Twilio
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

# Public URL for Twilio webhooks (use ngrok in dev)
NGROK_BASE_URL=http://localhost:8000

# Database
DATABASE_URL=sqlite:///beacon_hotel.db

# JWT auth (Voice-Labs + /api/v1)
JWT_SECRET=use-a-long-random-string-in-production
JWT_EXPIRE_DAYS=7
AUTH_COOKIE_SECURE=false
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000

# Default admin (created on startup if no users exist)
AUTH_ADMIN_EMAIL=admin@luminare.local
AUTH_ADMIN_PASSWORD=changeme123

ENVIRONMENT=development
DEBUG=True
```

Copy values from `.env.example` where applicable and adjust secrets. Never commit real `.env` files.

### Step 4: Initialize database and seed data

On first **FastAPI** startup, `init_db()`, `seed_default_admin()`, and dummy customer data run via **lifespan** handlers. You can also run manually:

```bash
python -c "from src.models.database import init_db; init_db()"
python -c "from src.utils.dummy_data_generator import initialize_dummy_data; initialize_dummy_data()"
```

Or after logging in, call `POST /api/v1/init/dummy-data` (requires JWT).

### Step 5: Frontend dependencies

```bash
cd Frontend
npm install
```

---

## 🚀 Running the Application

### 1. Start FastAPI

From the **repository root**:

```bash
python src/main_fastapi.py
```

Equivalent:

```bash
uvicorn src.main_fastapi:app --reload --host 0.0.0.0 --port 8000
```

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 2. Start the LiveKit agent worker (voice calls)

Separate terminal, repository root:

```bash
python run_agent.py dev
```

Use `python run_agent.py start` for production-style runs (see `run_agent.py`).

### 3. Start the web dashboard (optional)

```bash
cd Frontend
npm run dev
```

Opens the Vite dev server (default **http://localhost:5173**); `/api` requests proxy to the backend. **Log in** with the seeded admin (`AUTH_ADMIN_EMAIL` / `AUTH_ADMIN_PASSWORD`) or a user created by an admin.

Open **Voice Labs** from the nav after login to try **in-browser** two-way voice: allow **microphone** access when prompted.

### 4. Authenticated API usage

Almost all **`/api/v1/*`** routes require a valid JWT:

- **Browser**: login via `POST /api/auth/login` sets an **httpOnly** cookie; `credentials: "include"` from the SPA sends it automatically.
- **curl**: log in, save cookies, then call protected routes:

```bash
curl -c cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@luminare.local\",\"password\":\"changeme123\"}"

curl -b cookies.txt -X POST http://localhost:8000/api/v1/calls/test-livekit-sip \
  -H "Content-Type: application/json" \
  -d "{\"customer_id\": \"CUST1052\", \"language\": \"en\"}"
```

Alternatively, pass `Authorization: Bearer <jwt>` if you have a valid JWT (the login response does **not** include the token in JSON—only the httpOnly cookie—so for scripts you typically reuse the cookie file or mint a test token with the same `JWT_SECRET`).

### 5. Monitor logs

```powershell
# Windows
Get-Content logs/agent_session.log -Tail 50 -Wait

# Linux/macOS
tail -f logs/agent_session.log
```

---

## 🔐 Authentication & API Access

| Area | Behavior |
|------|----------|
| `/api/auth/*` | Public (login, logout, register-style flows) |
| `/`, `/health`, `/docs`, `/openapi.json`, `/redoc` | Public |
| `/audio/*` | Public static files |
| `/api/v1/*` | **JWT required** — cookie `access_token` or `Authorization: Bearer` (`VoiceLabsAPIMiddleware`) |
| Admin APIs | `GET/POST/PATCH/DELETE /api/auth/users*` require **admin** role (`require_admin`) |

On startup, if no users exist, **`seed_default_admin()`** creates an admin from `AUTH_ADMIN_EMAIL` / `AUTH_ADMIN_PASSWORD`.

---

## 📡 API Endpoints (summary)

See **`/docs`** for the live schema. Notable routes:

### Health & system

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API info |
| `GET` | `/health` | Health check |

### Auth (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login; sets httpOnly JWT cookie |
| `POST` | `/api/auth/logout` | Clears cookie |
| `GET` | `/api/auth/me` | Current user or `null` |
| `GET` | `/api/auth/users` | List users (**admin**) |
| `POST` | `/api/auth/users` | Create user (**admin**) |
| `PATCH` | `/api/auth/users/{user_id}` | Change role (**admin**) |
| `DELETE` | `/api/auth/users/{user_id}` | Delete user (**admin**) |

### Customers (`/api/v1` — JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/customers` | List customers |
| `GET` | `/api/v1/customers/{id}` | Detail |
| `PUT` | `/api/v1/customers/{id}` | Update |
| `DELETE` | `/api/v1/customers/{id}` | Delete |
| `GET` | `/api/v1/customers/{id}/analysis` | Relationship analysis |
| `GET` | `/api/v1/customers/{id}/call-history` | Call history |
| `POST` | `/api/v1/customers/create` | Create customer |
| `POST` | `/api/v1/customers/create-bulk` | Bulk create |
| `GET` | `/api/v1/customers/test-data/list` | List test customers |

### Calls & streaming

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/calls/test-livekit-sip` | **Outbound AI voice call** (LiveKit SIP) |
| `POST` | `/api/v1/calls/test` | Test call helper (see OpenAPI) |
| `POST` | `/api/v1/calls/schedule` | Schedule calls |
| `POST` | `/api/v1/calls/make` | Initiate call |
| `POST` | `/api/v1/calls/log` | Log completed call |
| `GET` | `/api/v1/calls/conversational-demo` | Conversational demo |
| `POST` | `/api/v1/stream/livekit/session` | LiveKit streaming session |
| `WS` | `/api/v1/stream/livekit/ws/{session_id}` | LiveKit WebSocket |
| `WS` | `/api/v1/stream/twilio/ws` | Twilio media WebSocket |
| `WS` | `/api/v1/stream/web/ws` | Browser voice (JWT) |

### Audio & reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/audio/generate` | Generate TTS audio |
| `GET` | `/api/v1/metrics/summary` | Metrics |
| `GET` | `/api/v1/reports/export` | Export reports |
| `POST` | `/api/v1/init/dummy-data` | Initialize dummy data |

---

## 🧠 How It Works

### 1. Outbound Call Flow

```
API Request (customer_id) → Create LiveKit Room → Dispatch AI Agent → Place SIP Call via Twilio
                                                                            │
Customer Answers ──► Audio streams to LiveKit Room ──► AI Agent receives audio
                                                                            │
                    Sarvam STT (saaras:v3) ◄──── Buffered audio chunks (1s)   │
                            │                                                 │
                            ▼                                                 │
                    Sarvam LLM (sarvam-m) ◄── Conversation history + prompt   │
                            │                                                 │
                            ▼                                                 │
                    Strip <think> tags ──► Split into sentences   │
                            │                                                 │
                            ▼                                                 │
                    Sarvam TTS (bulbul:v3) ──► Sentence-level pipelining      │
                            │                                                 │
                            ▼                                                 │
                    Play audio via LiveKit ──► SIP ──► Twilio ──► Phone
```

### 2. Agent Persona — "Raj"

- Warm, friendly male relationship manager at Beacon Hotel
- Uses speaker `"aditya"` (male Indian voice) for TTS
- Outbound calls to check in and offer loyalty discounts
- English or Hindi per configuration
- Short replies (1–2 sentences)
- Graceful end after discount and acknowledgement

### 3. LLM Think-Tag Handling

The Sarvam `sarvam-m` model can emit `<redacted_thinking>` blocks. The agent uses `_strip_think_tags()` (multiple edge cases), `reasoning_effort="low"`, and a fallback chain: streaming LLM → non-streaming → retry → hardcoded contextual fallback.

### 4. Discount Strategy

| Customer Visits | Discount Offered |
|----------------|------------------|
| 5+ visits | 20% loyalty discount |
| 2–4 visits | 15% loyalty discount |
| &lt; 2 visits | 10% welcome discount |
| Bad experience | 30% recovery discount |

### 5. Call Ending

- Agent / user **goodbye** keywords
- **Max turn limit** (e.g. 8 turns)
- Remove SIP participant via LiveKit API

---

## 📊 Latency Breakdown

Example measurements from a real test call (see logs):

| Stage | Latency |
|-------|---------|
| Greeting TTS | ~4.7s (example) |
| STT per chunk | ~300–750ms per 1s audio |
| LLM streaming | ~3–4s |
| TTS per sentence | ~1.2–3.0s |
| **First audio to user** | **~few seconds** after user stops speaking |
| **Full turn** | **~10–20s** (varies) |

**Bottlenecks**: LLM latency, TTS REST round-trips per sentence.

---

## 📝 Logging

`logs/agent_session.log` includes timing lines such as:

```
[TIMING] STT: 753ms for 1000ms audio → 'Right.'
[TIMING] LLM streaming: 3880ms, raw=1818 chars, clean=155 chars
[TIMING] TTS: 1173ms for 19 chars → 1.5s audio
```

The LiveKit agent worker may spawn child processes; rely on file logging for reliability.

---

## 🔒 Security Considerations

- Do not commit `.env`; rotate keys if leaked
- Set **`JWT_SECRET`** to a long random value in production
- Use **`HTTPS`**, **`AUTH_COOKIE_SECURE=true`**, and strict **`CORS_ORIGINS`** in production
- Validate inputs; phone numbers in **E.164** where possible
- **Audio** under `/audio` is local static serving — restrict in production if needed

---

## 🧪 Testing

```bash
python -m pytest tests/ -v
python -m pytest tests/ --cov=src --cov-report=html
```

---

## 🚨 Troubleshooting

| Issue | Suggestion |
|-------|------------|
| `livekit-agents` not installed | `pip install livekit livekit-agents livekit-api` |
| LiveKit SIP errors | Verify `LIVEKIT_*` and `LIVEKIT_SIP_TRUNK_ID` in `.env` |
| No agent console logs | Use `logs/agent_session.log` |
| Agent speaks thinking text | Ensure `_strip_think_tags()` path runs; check `servam_service` / agent code |
| `No module named 'src'` | Run from project root with venv active |
| Twilio call failed | E.164 numbers; check SIP trunk in Twilio console |
| `401` on `/api/v1/*` | Log in first; send cookie or `Authorization: Bearer` |
| LLM empty / think-only | Fallback chain in `livekit_sip_agent` |

Metrics:

```http
GET /api/v1/metrics/summary
```
(requires JWT)

---

## 🤝 Contributing

1. Fork the repository  
2. Create a branch (`git checkout -b feature/your-feature`)  
3. Commit with clear messages  
4. Open a Pull Request  

---

## 📄 License

This project is proprietary to Beacon Hotel. All rights reserved.

---

## 👥 Support

- Documentation: `/docs` (OpenAPI), `docs/` folder, this README  
- Issues: GitHub Issues (if applicable)  

---

## 🎯 Roadmap

- [ ] Dify workflow integration for advanced orchestration  
- [ ] WhatsApp / SMS outreach  
- [ ] ML or rules engine for optimal call timing  
- [ ] Deeper real-time **monitoring** and analytics in the dashboard  
- [ ] Broader language coverage in the voice agent  
- [ ] Hotel PMS (Property Management System) integration  

---

**Made with ❤️ for LuminareAI**
