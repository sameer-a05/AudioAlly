# StoryPath — Person 1: Story Engine

## What This Does
Takes educational content (raw text, a topic, or a PDF reference) and generates
interactive branching audio stories via Gemini. Also evaluates children's spoken
answers with generous, encouraging scoring.

## Quick Start

```bash
cd storypath
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run tests (test 4 works without API key)
python test_engine.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

## Endpoints

### `POST /api/generate-story`
Generate an interactive story from educational content.

```json
{
  "topic": "The American Revolution",
  "child_age": 10,
  "learning_needs": ["adhd"],
  "num_questions": 2
}
```

Or with raw content:
```json
{
  "content": "The water cycle describes how water moves...",
  "child_age": 8,
  "learning_needs": ["esl"],
  "num_questions": 1
}
```

Returns: `GeneratedStory` JSON (see `examples/boston_tea_party.json` for shape).

### `POST /api/evaluate-answer`
Evaluate a child's spoken answer.

```json
{
  "question_segment": {
    "id": "q_1",
    "type": "question",
    "speaker": "samuel_adams",
    "question_text": "Why were the colonists upset about taxes?",
    "correct_answer_keywords": ["no vote", "no say", "unfair"],
    "acceptable_explanation": "Child understands colonists had no representation",
    "correct_next": "seg_3_correct",
    "incorrect_next": "seg_3_incorrect",
    "hint_text": "Think about what makes a rule really unfair.",
    "fallback_choices": ["They had no say", "Tea was expensive"]
  },
  "child_answer_text": "because nobody asked them about it",
  "child_age": 10,
  "learning_needs": ["adhd"]
}
```

Returns:
```json
{
  "result": "correct",
  "encouragement": "That's exactly right! You're thinking like a true historian!",
  "explanation": null
}
```

### `GET /api/health`
Health check.

## Project Structure

```
storypath/
├── app/
│   ├── __init__.py
│   ├── main.py              ← FastAPI routes (the API)
│   ├── models.py            ← Pydantic models (THE SHARED CONTRACT)
│   ├── story_engine.py      ← Core Gemini logic
│   └── prompts/
│       ├── __init__.py
│       └── story_prompts.py ← All prompt templates (edit these to tune output)
├── examples/
│   └── boston_tea_party.json ← Example story for team development
├── test_engine.py           ← Test suite
├── requirements.txt
├── .env.example
└── README.md
```

## Integration Notes for Team

### Person 2 (Voice Engine)
- Consume `GeneratedStory.segments` and `GeneratedStory.voices`
- Map voice descriptions to ElevenLabs voice IDs
- Call `POST /api/evaluate-answer` after transcribing child speech
- Pre-generate both correct/incorrect branch audio while child listens

### Person 3 (Backend/DB)
- Store `GeneratedStory` JSON in MongoDB `stories` collection
- Implement document upload → text extraction → store in `documents` collection
- Fill in `story_engine.py → _fetch_document_content()` to query your DB
- Store evaluation results in `sessions` collection

### Person 4 (Frontend)
- Call `POST /api/generate-story` from the "Create Story" page
- Use `examples/boston_tea_party.json` to build UI before API is ready
- Display `fallback_choices` as button alternatives to voice input
- `first_segment_id` tells you where to start playback
- Follow `next` / `correct_next` / `incorrect_next` to traverse the story graph

## Tuning Tips
- Story quality off? Edit `app/prompts/story_prompts.py` — that's where all the magic is
- Gemini returning bad JSON? Bump to `gemini-2.0-pro` in `story_engine.py`
- Stories too long? Reduce max words in the prompt (currently 75 per segment)
- Evaluation too strict/loose? Adjust temperature in `evaluate_answer` (currently 0.3)
