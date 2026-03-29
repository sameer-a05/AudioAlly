"""
AudioAlly — FastAPI Story Engine API
======================================
POST /api/generate-story    → Generate interactive story from content/topic/document
POST /api/evaluate-answer   → Evaluate child's spoken answer
GET  /api/health            → Health check
"""

from pathlib import Path

from dotenv import load_dotenv

# Load .env before any code reads os.environ (must run before `from app.story_engine import …`).
_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env")
load_dotenv(_ROOT.parent / ".env")
load_dotenv()

import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    GenerateStoryRequest,
    GeneratedStory,
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    EvaluationResult,
)
from app.story_engine import StoryEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AudioAlly Story Engine", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_engine: StoryEngine | None = None


def get_engine() -> StoryEngine:
    global _engine
    if _engine is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set in .env")
        _engine = StoryEngine(gemini_api_key=api_key)
    return _engine


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "mongodb_configured": bool(os.getenv("MONGODB_URI")),
        "version": "0.2.0",
    }


@app.post("/api/generate-story", response_model=GeneratedStory)
async def generate_story(request: GenerateStoryRequest):
    if not request.content and not request.topic and not request.document_id:
        raise HTTPException(status_code=400, detail="Provide content, topic, or document_id")
    try:
        story = await get_engine().generate_story(request)
        return story
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logger.exception("Story generation failed")
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")


@app.post("/api/evaluate-answer", response_model=EvaluateAnswerResponse)
async def evaluate_answer(request: EvaluateAnswerRequest):
    if not request.child_answer_text.strip():
        return EvaluateAnswerResponse(
            result=EvaluationResult.UNCLEAR,
            encouragement="I didn't hear anything — try tapping the microphone and speaking up!",
            explanation=None,
        )
    try:
        return await get_engine().evaluate_answer(request)
    except Exception as e:
        logger.exception("Evaluation failed")
        # NEVER let a technical failure punish the child
        return EvaluateAnswerResponse(
            result=EvaluationResult.UNCLEAR,
            encouragement="Hmm, I had trouble hearing that. Can you try one more time?",
            explanation=None,
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)