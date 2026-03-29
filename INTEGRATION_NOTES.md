# AudioAlly Integration — Schema Mismatches & Fixes

## Mismatches Found

| # | Python (Person 1) | JavaScript (Person 2/4) | Fix |
|---|-------------------|------------------------|-----|
| 1 | `segment.speaker` | `segment.voice` | JS AudioEngine now reads `speaker` with `voice` fallback |
| 2 | `segment.question_text` | checks `question_text \|\| text` | OK — JS already handles both |
| 3 | Branching: `next`, `correct_next`, `incorrect_next` | Linear array iteration | JS StoryPlayer now follows graph via segment IDs |
| 4 | `GeneratedStory.voices` → `VoiceConfig` objects | Hardcoded `VOICES` map | AudioEngine dynamically maps voice descriptions to ElevenLabs IDs |
| 5 | `GeneratedStory.first_segment_id` | Assumes `segments[0]` | JS now starts from `first_segment_id` |
| 6 | `pdf_upload_server.js` stores raw PDF in GridFS | Python expects `extracted_text` in `documents` collection | Node server now extracts text via pdf-parse and stores it |
| 7 | Node uses `testdb` database | Python `.env` references `storypath` | Unified to single DB name via env var |
| 8 | `sampleStory.js` uses `voice` field, no branching | Python produces `speaker` + graph structure | Sample story updated to match Python schema |

## Architecture

```
[React Frontend :5173]
    |
    ├── POST /node-api/upload-pdf     →  [Node Server :3000]  →  MongoDB (documents collection)
    ├── POST /api/generate-story      →  [FastAPI :8000]      →  Gemini 2.5 Flash + MongoDB read
    ├── POST /api/evaluate-answer     →  [FastAPI :8000]      →  Gemini 2.5 Flash
    └── POST /elevenlabs-api/v1/...   →  [ElevenLabs API]     →  TTS audio
```

Vite proxies all three backends so the frontend only talks to localhost:5173.
