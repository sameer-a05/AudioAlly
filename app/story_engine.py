"""
StoryPath Story Engine — with MongoDB Integration
===================================================
The _fetch_document_content method now reads from the `documents` collection
that the Node.js PDF upload server populates.
"""

import glob
import os

from dotenv import load_dotenv

# `__file__` is `.../files/app/story_engine.py` — project `.env` lives in `files/`, not `app/`.
_APP_DIR = os.path.dirname(os.path.abspath(__file__))
_FILES_ROOT = os.path.abspath(os.path.join(_APP_DIR, ".."))

print("DEBUG [story_engine]: os.getcwd() =", os.getcwd())
print("DEBUG [story_engine]: __file__ =", __file__)
print("DEBUG [story_engine]: _FILES_ROOT =", _FILES_ROOT)
try:
    print("DEBUG [story_engine]: listdir(_FILES_ROOT) =", os.listdir(_FILES_ROOT))
except OSError as e:
    print("DEBUG [story_engine]: listdir(_FILES_ROOT) failed:", e)
print(
    "DEBUG [story_engine]: glob .env* in _FILES_ROOT =",
    glob.glob(os.path.join(_FILES_ROOT, ".env*")),
)

# Explicit path: `files/.env` (using `dirname(__file__)+'.env'` would wrongly mean `app/.env`).
_ENV_PATH = os.path.join(_FILES_ROOT, ".env")
print(
    "DEBUG [story_engine]: load_dotenv explicit path =",
    os.path.abspath(_ENV_PATH),
    "(exists:",
    os.path.isfile(_ENV_PATH),
    ")",
)
load_dotenv(_ENV_PATH)
load_dotenv(os.path.join(os.path.dirname(_FILES_ROOT), ".env"))
load_dotenv()

_m = os.getenv("MONGODB_URI")
if _m:
    print(f"DEBUG [story_engine]: MONGODB_URI found: {_m[:15]}...")
else:
    print("DEBUG [story_engine]: MONGODB_URI found: <None> (check filename is `.env` not `.env.txt`)")

import asyncio
import json
import logging
import os
import re
from typing import Optional

import certifi
import google.genai as genai
from google.api_core import exceptions as google_exceptions
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId

from app.models import (
    GeneratedStory,
    GenerateStoryRequest,
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    EvaluationResult,
)
from app.prompts.story_prompts import (
    get_story_generation_prompt,
    get_answer_evaluation_prompt,
    get_topic_expansion_prompt,
)

logger = logging.getLogger(__name__)


# ─── Shared MongoDB connection ───────────────────────────────────────────────

_mongo_client: Optional[MongoClient] = None


def _mask_mongodb_uri(uri: str) -> str:
    """Redact credentials for logs (never print full Atlas passwords)."""
    if not uri or "@" not in uri:
        return (uri[:24] + "…") if uri and len(uri) > 24 else (uri or "(empty)")
    try:
        scheme, rest = uri.split("://", 1)
        hostpart = rest.rsplit("@", 1)[-1]
        return f"{scheme}://***:***@{hostpart}"
    except Exception:
        return "***"


def get_mongo_db():
    """
    Return the shared pymongo database handle.
    Uses MONGODB_URI and MONGODB_DB (default ``audioally``) — same as ``pdf_upload_server.js``.
    """
    global _mongo_client
    db_name = os.getenv("MONGODB_DB", "audioally")

    if _mongo_client is None:
        uri = os.getenv("MONGODB_URI")
        if not uri:
            raise RuntimeError(
                "MONGODB_URI not set. Add it to .env — must match the Node server's connection."
            )
        masked = _mask_mongodb_uri(uri.strip())
        logger.info("MongoDB: connecting (db=%s, uri=%s)", db_name, masked)
        try:
            _mongo_client = MongoClient(
                uri.strip(),
                tlsCAFile=certifi.where(),
                serverSelectionTimeoutMS=15_000,
                connectTimeoutMS=15_000,
            )
            _mongo_client.admin.command("ping")
            logger.info("MongoDB: ping OK (db=%s)", db_name)
        except Exception as e:
            _mongo_client = None
            logger.error(
                "MongoDB: connection failed (db=%s, uri=%s): %s",
                db_name,
                masked,
                e,
            )
            raise RuntimeError(
                f"MongoDB connection failed for database '{db_name}'. "
                f"Check MONGODB_URI, IP allowlist, and that MONGODB_DB matches the Node PDF server. "
                f"Attempted URI (masked): {masked}"
            ) from e

    return _mongo_client[db_name]


class StoryEngine:
    def __init__(self, gemini_api_key: str):
        genai.configure(api_key=gemini_api_key)
        self.model = genai.GenerativeModel("gemini-2.5-flash")
        self.eval_model = genai.GenerativeModel("gemini-2.5-flash")

    # ─── Public API ──────────────────────────────────────────────────────

    async def generate_story(self, request: GenerateStoryRequest) -> GeneratedStory:
        content = await self._resolve_content(request)

        if not content or len(content.strip()) < 20:
            raise ValueError("Not enough educational content to generate a story.")

        learning_needs = [need.value for need in request.learning_needs]
        system_prompt, user_prompt = get_story_generation_prompt(
            content=content,
            child_age=request.child_age,
            learning_needs=learning_needs,
            num_questions=request.num_questions,
        )

        logger.info(f"Generating story for age={request.child_age}, needs={learning_needs}")

        max_retries = 3
        last_error = None

        for attempt in range(max_retries):
            temp = max(0.4, 0.8 - (attempt * 0.2))
            if attempt > 0:
                logger.info(f"Retry {attempt}/{max_retries - 1}, temp={temp}")

            response = await self._call_gemini(
                self.model,
                [{"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}],
                generation_config=genai.GenerationConfig(
                    temperature=temp,
                    top_p=0.95,
                    max_output_tokens=8192,
                    response_mime_type="application/json",
                ),
            )

            try:
                story = self._parse_story_response(response.text)
                self._validate_story_graph(story)
                logger.info(f"Generated '{story.title}' — {len(story.segments)} segments (attempt {attempt + 1})")
                return story
            except (ValueError, json.JSONDecodeError) as e:
                last_error = e
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
                continue

        raise ValueError(f"Story generation failed after {max_retries} attempts. Last error: {last_error}")

    async def evaluate_answer(self, request: EvaluateAnswerRequest) -> EvaluateAnswerResponse:
        learning_needs = [need.value for need in request.learning_needs]
        system_prompt, user_prompt = get_answer_evaluation_prompt(
            question_text=request.question_segment.question_text,
            acceptable_explanation=request.question_segment.acceptable_explanation,
            correct_keywords=request.question_segment.correct_answer_keywords,
            child_answer=request.child_answer_text,
            child_age=request.child_age,
            learning_needs=learning_needs,
        )

        response = await self._call_gemini(
            self.eval_model,
            [{"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}],
            generation_config=genai.GenerationConfig(
                temperature=0.3,
                max_output_tokens=512,
                response_mime_type="application/json",
            ),
        )
        return self._parse_evaluation_response(response.text, request)

    async def expand_topic(self, topic: str, child_age: int) -> str:
        system_prompt, user_prompt = get_topic_expansion_prompt(topic, child_age)
        response = await self._call_gemini(
            self.model,
            [{"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}],
            generation_config=genai.GenerationConfig(temperature=0.5, max_output_tokens=1024),
        )
        return response.text

    # ─── Private: Gemini call wrapper ────────────────────────────────────

    async def _call_gemini(self, model, contents, generation_config, max_rate_retries=3):
        for i in range(max_rate_retries):
            try:
                return model.generate_content(contents, generation_config=generation_config)
            except google_exceptions.ResourceExhausted as e:
                wait_time = 20
                match = re.search(r'retry in (\d+\.?\d*)', str(e), re.IGNORECASE)
                if match:
                    wait_time = float(match.group(1)) + 1
                if i < max_rate_retries - 1:
                    logger.warning(f"Rate limited. Waiting {wait_time:.0f}s ({i + 1}/{max_rate_retries})")
                    await asyncio.sleep(wait_time)
                else:
                    raise ValueError(f"Gemini rate limit exceeded after {max_rate_retries} waits.") from e

    # ─── Private: Content resolution ─────────────────────────────────────

    async def _resolve_content(self, request: GenerateStoryRequest) -> str:
        if request.content:
            return request.content
        if request.topic:
            logger.info(f"Expanding topic: {request.topic}")
            return await self.expand_topic(request.topic, request.child_age)
        if request.document_id:
            return await self._fetch_document_content(request.document_id)
        raise ValueError("Must provide content, topic, or document_id")

    async def _fetch_document_content(self, document_id: str) -> str:
        """
        Fetch extracted text from MongoDB `documents` collection.
        This collection is populated by the Node.js PDF upload server.
        ``document_id`` must be the hex string from Node (``insertedId.toString()``), valid for ``ObjectId``.
        """
        raw = (document_id or "").strip()
        if not raw:
            raise ValueError("document_id is empty.")

        try:
            oid = ObjectId(raw)
        except InvalidId as e:
            raise ValueError(
                f"Invalid document_id {raw!r}. "
                "Expected a 24-character hex MongoDB ObjectId string from the PDF upload response."
            ) from e

        try:
            db = get_mongo_db()
        except RuntimeError as e:
            raise ValueError(str(e)) from e

        doc = db["documents"].find_one({"_id": oid})

        if doc is None:
            raise ValueError(
                f"Document '{document_id}' not found. "
                f"Upload a PDF at http://localhost:3000 first."
            )

        text = doc.get("extracted_text", "")
        if not text or len(text.strip()) < 20:
            raise ValueError(
                f"Document '{document_id}' ({doc.get('filename', '?')}) "
                f"has no extractable text. The PDF might be scanned/image-only."
            )

        logger.info(f"Fetched document '{doc.get('filename')}': {len(text)} chars")
        return text

    # ─── Private: JSON parsing ───────────────────────────────────────────

    def _repair_json(self, text: str) -> str:
        text = text.strip()
        for prefix in ("```json", "```"):
            if text.startswith(prefix):
                text = text[len(prefix):]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        text = re.sub(r',\s*([}\]])', r'\1', text)
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)

        if text and text[-1] not in ('}', ']'):
            open_braces = text.count('{') - text.count('}')
            open_brackets = text.count('[') - text.count(']')
            quote_count = text.count('"')
            if quote_count % 2 == 1:
                last_quote = text.rfind('"')
                text = text[:last_quote] + '"'
            text += ']' * max(0, open_brackets)
            text += '}' * max(0, open_braces)
        return text

    def _parse_story_response(self, raw_response: str) -> GeneratedStory:
        clean = raw_response.strip()
        for prefix in ("```json", "```"):
            if clean.startswith(prefix):
                clean = clean[len(prefix):]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()

        data = None
        try:
            data = json.loads(clean)
        except json.JSONDecodeError:
            logger.info("Direct parse failed, attempting repair…")
            repaired = self._repair_json(raw_response)
            try:
                data = json.loads(repaired)
                logger.info("JSON repair succeeded")
            except json.JSONDecodeError as e:
                raise ValueError(f"Gemini returned invalid JSON: {e}")

        try:
            return GeneratedStory(**data)
        except Exception as e:
            raise ValueError(f"Gemini output didn't match story schema: {e}")

    def _parse_evaluation_response(self, raw_response: str, request) -> EvaluateAnswerResponse:
        text = raw_response.strip()
        for prefix in ("```json", "```"):
            if text.startswith(prefix):
                text = text[len(prefix):]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            logger.warning("Eval parse failed → defaulting to 'unclear'")
            return EvaluateAnswerResponse(
                result=EvaluationResult.UNCLEAR,
                encouragement="I didn't quite catch that — can you try one more time?",
                explanation=None,
            )

        result_str = data.get("result", "unclear").lower()
        try:
            result = EvaluationResult(result_str)
        except ValueError:
            result = EvaluationResult.UNCLEAR

        return EvaluateAnswerResponse(
            result=result,
            encouragement=data.get("encouragement", "Great effort! Let's keep going!"),
            explanation=data.get("explanation"),
        )

    # ─── Private: Graph validation ───────────────────────────────────────

    def _validate_story_graph(self, story: GeneratedStory) -> None:
        segment_ids = {seg.id for seg in story.segments}
        voice_keys = set(story.voices.keys())

        if story.first_segment_id not in segment_ids:
            raise ValueError(f"first_segment_id '{story.first_segment_id}' not in segments")

        for seg in story.segments:
            if seg.speaker not in voice_keys:
                raise ValueError(f"Segment '{seg.id}' speaker '{seg.speaker}' not in voices")
            if seg.type in ("narration", "intro") and seg.next and seg.next not in segment_ids:
                raise ValueError(f"Segment '{seg.id}' next='{seg.next}' doesn't exist")
            if seg.type == "question":
                if seg.correct_next and seg.correct_next not in segment_ids:
                    raise ValueError(f"Question '{seg.id}' correct_next doesn't exist")
                if seg.incorrect_next and seg.incorrect_next not in segment_ids:
                    raise ValueError(f"Question '{seg.id}' incorrect_next doesn't exist")

        # Orphan check (warning only)
        reachable = set()
        to_visit = [story.first_segment_id]
        while to_visit:
            cid = to_visit.pop()
            if cid in reachable:
                continue
            reachable.add(cid)
            seg = next((s for s in story.segments if s.id == cid), None)
            if not seg:
                continue
            for ref in (seg.next, seg.correct_next, seg.incorrect_next):
                if ref:
                    to_visit.append(ref)

        orphaned = segment_ids - reachable
        if orphaned:
            logger.warning(f"Unreachable segments: {orphaned}")