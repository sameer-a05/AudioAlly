"""
StoryPath API Routes — Person 1's Endpoints
=============================================
These are the endpoints the rest of the team calls.

POST /api/generate-story   → Person 4 calls this from the "Create Story" page
POST /api/evaluate-answer  → Person 2 calls this after the child speaks
GET  /api/health           → Sanity check
"""

import os
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.models import (
    GenerateStoryRequest,
    GeneratedStory,
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
)
from app.story_engine import StoryEngine

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App Setup ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="StoryPath Story Engine",
    description="AI-powered interactive story generation for education",
    version="0.1.0",
)

# CORS — wide open for hackathon, lock down in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Engine Initialization ───────────────────────────────────────────────────

_engine: StoryEngine | None = None


def get_engine() -> StoryEngine:
    global _engine
    if _engine is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY not set. Copy .env.example to .env and add your key."
            )
        _engine = StoryEngine(gemini_api_key=api_key)
    return _engine


# ─── Routes ──────────────────────────────────────────────────────────────────


@app.get("/api/health")
async def health_check():
    """Quick check that the server is running and Gemini key is configured."""
    has_key = bool(os.getenv("GEMINI_API_KEY"))
    return {
        "status": "ok",
        "gemini_configured": has_key,
        "version": "0.1.0",
    }


@app.post("/api/generate-story", response_model=GeneratedStory)
async def generate_story(request: GenerateStoryRequest):
    """
    Generate an interactive audio story from educational content.

    Accepts one of:
    - content: raw text to transform
    - topic: a topic string (Gemini will research it first)
    - document_id: reference to an uploaded PDF (Person 3's endpoint)

    Returns a complete GeneratedStory with segments, voices, and branching paths.
    """

    # Validate that at least one content source is provided
    if not request.content and not request.topic and not request.document_id:
        raise HTTPException(
            status_code=400,
            detail="Must provide at least one of: content, topic, or document_id",
        )

    try:
        engine = get_engine()
        story = await engine.generate_story(request)
        return story

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logger.exception("Story generation failed")
        raise HTTPException(
            status_code=500,
            detail=f"Story generation failed: {str(e)}. Try again — Gemini can be flaky.",
        )


@app.post("/api/evaluate-answer", response_model=EvaluateAnswerResponse)
async def evaluate_answer(request: EvaluateAnswerRequest):
    """
    Evaluate a child's spoken answer against a question segment.

    Person 2's voice engine calls this after transcribing the child's speech.
    The evaluation is intentionally generous — we'd rather give credit than
    make a child feel they failed.

    Returns result (correct/incorrect/unclear), encouragement, and optional explanation.
    """

    if not request.child_answer_text.strip():
        # Empty answer — don't send to Gemini, just ask them to try again
        return EvaluateAnswerResponse(
            result="unclear",
            encouragement="I didn't hear anything — try tapping the microphone and speaking up!",
            explanation=None,
        )

    try:
        engine = get_engine()
        result = await engine.evaluate_answer(request)
        return result

    except Exception as e:
        logger.exception("Answer evaluation failed")
        # NEVER let a technical failure result in "incorrect" for the child
        return EvaluateAnswerResponse(
            result="unclear",
            encouragement="Hmm, I had trouble hearing that. Can you try one more time?",
            explanation=None,
        )


# ─── Startup ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
