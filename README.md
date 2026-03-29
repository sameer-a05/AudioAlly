# ⚡ Audio Ally — Interactive Audio Tutor

Turn any school topic into a personalized, interactive audio adventure for children with ADHD, dyslexia, or ESL learners.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Vite :5173)                            │
│  ├── Upload PDF → /node-api/upload-pdf                  │
│  ├── Generate Story → /api/generate-story               │
│  ├── Evaluate Answer → /api/evaluate-answer             │
│  └── TTS Audio → /elevenlabs-api/v1/text-to-speech/...  │
└────────┬──────────────┬─────────────────┬───────────────┘
         │              │                 │
    ┌────▼────┐   ┌─────▼──────┐   ┌──────▼───────┐
    │ Node.js │   │  FastAPI   │   │ ElevenLabs   │
    │  :3000  │   │   :8000    │   │   (cloud)    │
    │ PDF     │   │ Gemini 2.5 │   │   TTS API    │
    │ upload  │   │ Flash      │   └──────────────┘
    └────┬────┘   └─────┬──────┘
         │              │
         └──────┬───────┘
          ┌─────▼──────┐
          │  MongoDB   │
          │   Atlas    │
          │ (shared)   │
          └────────────┘
```

## Quick Start (3 terminals)

### 1. Install dependencies
```bash
npm install
pip install -r requirements.txt
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env and add your keys:
#   GEMINI_API_KEY        — from https://aistudio.google.com/apikey
#   VITE_ELEVENLABS_API_KEY — from https://elevenlabs.io
#   MONGODB_URI           — your Atlas connection string
```

### 3. Start all three servers

**Terminal 1 — Node PDF server:**
```bash
node pdf_upload_server.js
# → http://localhost:3000
```

**Terminal 2 — Python Story Engine:**
```bash
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000
```

**Terminal 3 — React frontend:**
```bash
npm run dev
# → http://localhost:5173  ← OPEN THIS
```

### 4. Run integration tests
```bash
python test_engine.py
```

## How It Works

1. **Parent/teacher** types a topic or uploads a PDF of a boring textbook chapter
2. **Gemini 2.5 Flash** transforms it into an interactive branching story with characters and questions
3. **ElevenLabs** voices each character with distinct personalities
4. **Child listens** to the story and answers questions by speaking into the mic
5. **Gemini evaluates** the answer generously and branches the story accordingly
6. **Wrong answers** get gentle re-explanations, never punishment

## Sponsor Integrations

| Sponsor | Usage | Prize Target |
|---------|-------|-------------|
| **Gemini API** | Story generation + answer evaluation | Best Use of Gemini API |
| **ElevenLabs** | Multi-character voice synthesis | Best Use of ElevenLabs |
| **MongoDB Atlas** | Document storage, story persistence | Best Use of MongoDB Atlas |
| **Vultr** | Deployment hosting (if deployed) | Best Use of Vultr |

## Project Structure

```
audioally/
├── app/                          # Python (FastAPI)
│   ├── main.py                   #   API routes
│   ├── models.py                 #   Pydantic models (SHARED CONTRACT)
│   ├── story_engine.py           #   Gemini + MongoDB logic
│   └── prompts/
│       └── story_prompts.py      #   Prompt templates
├── src/                          # React frontend
│   ├── App.jsx                   #   Routing
│   ├── services/
│   │   ├── api.js                #   API client (Node + Python)
│   │   └── AudioEngine.js        #   TTS + playback + mic + branching
│   └── components/
│       └── StoryAudioPlayer.jsx  #   Full story experience UI
├── pdf_upload_server.js          # Node.js PDF upload server
├── examples/
│   └── boston_tea_party.json      # Example story for offline dev
├── vite.config.js                # Proxy config for 3 backends
├── test_engine.py                # Integration tests
├── requirements.txt              # Python deps
├── package.json                  # Node/React deps
└── .env.example                  # All environment variables
```

## Team Responsibilities

| Person | Owns | Key Files |
|--------|------|-----------|
| **1 — Story Engine** | Gemini prompts, JSON generation, evaluation | `story_engine.py`, `story_prompts.py` |
| **2 — Voice Engine** | ElevenLabs TTS, audio playback, mic | `AudioEngine.js` |
| **3 — Backend/DB** | MongoDB, PDF upload, API server | `pdf_upload_server.js`, `main.py` |
| **4 — Frontend** | React UI, story player, UX | `StoryAudioPlayer.jsx`, `App.jsx` |

## API Endpoints

### Python (FastAPI :8000)
- `POST /api/generate-story` — Generate interactive story
- `POST /api/evaluate-answer` — Evaluate child's spoken answer
- `GET /api/health` — Health check

### Node.js (:3000)
- `POST /api/upload-pdf` — Upload PDF + extract text
- `GET /api/documents` — List uploaded documents
- `GET /api/documents/:id` — Get document text by ID