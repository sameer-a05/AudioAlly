"""
AudioAlly — Integration Test Suite
====================================
Run: python test_engine.py

Tests:
  1. Validate example story JSON (no API needed)
  2. Test MongoDB connection + document fetch
  3. Generate story from topic (needs GEMINI_API_KEY)
  4. Generate story from raw content (needs GEMINI_API_KEY)
  5. Evaluate child answers (needs GEMINI_API_KEY)
"""

import glob
import os
import sys

# ── Debug: working directory & what files exist (before dotenv) ─────────────
print("DEBUG [test_engine]: os.getcwd() =", os.getcwd())
try:
    print("DEBUG [test_engine]: listdir(cwd) =", os.listdir(os.getcwd()))
except OSError as e:
    print("DEBUG [test_engine]: listdir(cwd) failed:", e)

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
print("DEBUG [test_engine]: __file__ =", __file__)
print("DEBUG [test_engine]: _SCRIPT_DIR =", _SCRIPT_DIR)
try:
    print("DEBUG [test_engine]: listdir(_SCRIPT_DIR) =", os.listdir(_SCRIPT_DIR))
except OSError as e:
    print("DEBUG [test_engine]: listdir(_SCRIPT_DIR) failed:", e)

print(
    "DEBUG [test_engine]: glob .env* in _SCRIPT_DIR =",
    glob.glob(os.path.join(_SCRIPT_DIR, ".env*")),
)

from dotenv import load_dotenv

# Explicit path: `files/.env` next to this script (not cwd-dependent).
_ENV_PATH = os.path.join(_SCRIPT_DIR, ".env")
print(
    "DEBUG [test_engine]: load_dotenv explicit path =",
    os.path.abspath(_ENV_PATH),
    "(exists:",
    os.path.isfile(_ENV_PATH),
    ")",
)
load_dotenv(_ENV_PATH)
load_dotenv(os.path.join(os.path.dirname(_SCRIPT_DIR), ".env"))
load_dotenv()

_m = os.getenv("MONGODB_URI")
if _m:
    print(f"DEBUG [test_engine]: MONGODB_URI found: {_m[:15]}...")
else:
    print("DEBUG [test_engine]: MONGODB_URI found: <None> (check filename is `.env` not `.env.txt`)")

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, _SCRIPT_DIR)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from app.story_engine import StoryEngine, get_mongo_db
from app.models import (
    GenerateStoryRequest,
    GeneratedStory,
    EvaluateAnswerRequest,
    QuestionSegment,
    LearningNeed,
    SegmentType,
)


async def test_validate_example_story():
    print("\n" + "=" * 60)
    print("TEST 1: Validate example story JSON")
    print("=" * 60)

    with open("examples/boston_tea_party.json") as f:
        data = json.load(f)

    try:
        story = GeneratedStory(**data)
        print(f"  Parsed OK: '{story.title}'")
        print(f"  {len(story.segments)} segments, {len(story.voices)} voices")
        print(f"  Questions: {sum(1 for s in story.segments if s.type == 'question')}")

        engine_cls = StoryEngine.__new__(StoryEngine)
        engine_cls._validate_story_graph(story)
        print("  Graph validation: PASSED ✅")
    except Exception as e:
        print(f"  FAILED ❌: {e}")


async def test_mongodb_connection():
    print("\n" + "=" * 60)
    print("TEST 2: MongoDB connection")
    print("=" * 60)

    uri = os.getenv("MONGODB_URI")
    if not uri:
        print("  SKIP — no MONGODB_URI in .env")
        return

    try:
        db = get_mongo_db()
        count = db["documents"].count_documents({})
        print(f"  Connected to database {db.name!r} ✅ (must match Node MONGODB_DB / default audioally)")
        print(f"  Documents collection: {count} document(s)")

        if count > 0:
            latest = db["documents"].find_one(sort=[("uploaded_at", -1)])
            print(f"  Latest: '{latest.get('filename', '?')}' ({latest.get('text_length', 0)} chars)")
    except Exception as e:
        print(f"  FAILED ❌: {e}")


async def test_topic_generation():
    print("\n" + "=" * 60)
    print("TEST 3: Generate story from topic")
    print("=" * 60)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("  SKIP — no GEMINI_API_KEY")
        return

    engine = StoryEngine(gemini_api_key=api_key)
    request = GenerateStoryRequest(
        topic="Photosynthesis — how plants make food from sunlight",
        child_age=9,
        learning_needs=[LearningNeed.ADHD],
        num_questions=1,
    )

    story = await engine.generate_story(request)
    print(f"  Title: {story.title}")
    print(f"  Segments: {len(story.segments)}, Voices: {list(story.voices.keys())}")
    print(f"  Duration: ~{story.estimated_duration_minutes} min")
    print("  PASSED ✅")


async def test_content_generation():
    print("\n" + "=" * 60)
    print("TEST 4: Generate story from raw content")
    print("=" * 60)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("  SKIP — no GEMINI_API_KEY")
        return

    engine = StoryEngine(gemini_api_key=api_key)
    content = """
    The water cycle describes how water moves through Earth's systems.
    Water evaporates from oceans when heated by the sun, turning into
    water vapor. This vapor rises, cools, and condenses into clouds.
    When enough droplets gather, they fall as rain, snow, or hail.
    This water flows into rivers and back to the ocean to start again.
    """

    request = GenerateStoryRequest(
        content=content,
        child_age=8,
        learning_needs=[LearningNeed.ESL],
        num_questions=2,
    )

    story = await engine.generate_story(request)
    print(f"  Title: {story.title}")
    print(f"  Segments: {len(story.segments)}")
    print(f"  Questions: {sum(1 for s in story.segments if s.type == 'question')}")

    with open("examples/water_cycle_generated.json", "w") as f:
        json.dump(story.model_dump(), f, indent=2)
    print("  Saved to examples/water_cycle_generated.json")
    print("  PASSED ✅")


async def test_answer_evaluation():
    print("\n" + "=" * 60)
    print("TEST 5: Evaluate child answers")
    print("=" * 60)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("  SKIP — no GEMINI_API_KEY")
        return

    engine = StoryEngine(gemini_api_key=api_key)

    question = QuestionSegment(
        id="q_1",
        type="question",
        speaker="samuel_adams",
        question_text="Why were the colonists so upset about the taxes?",
        correct_answer_keywords=["no vote", "no say", "unfair", "no representation"],
        acceptable_explanation="The child understands the colonists had no say in tax decisions.",
        correct_next="seg_3_correct",
        incorrect_next="seg_3_incorrect",
        hint_text="Think about what makes a rule REALLY unfair.",
        fallback_choices=["They had no say", "Tea was expensive", "They didn't like the King"],
    )

    test_cases = [
        ("Because nobody asked them! They didn't get to vote.", "CORRECT"),
        ("um they were mad because it wasn't fair", "CORRECT"),
        ("because tea is yucky", "INCORRECT"),
        ("asdfghjkl", "UNCLEAR"),
    ]

    for answer, expected in test_cases:
        request = EvaluateAnswerRequest(
            question_segment=question,
            child_answer_text=answer,
            child_age=10,
            learning_needs=[LearningNeed.ADHD],
        )
        result = await engine.evaluate_answer(request)
        status = "✅" if result.result.upper() == expected else "⚠️"
        print(f"  {status} \"{answer[:40]}…\" → {result.result} (expected {expected})")
        print(f"     {result.encouragement}")


async def test_golden_path_document_flow():
    """
    Simulates: MongoDB insert (upload) → generate_story(document_id) → evaluate_answer.
    Requires MONGODB_URI + GEMINI_API_KEY.
    """
    print("\n" + "=" * 60)
    print("TEST 6: Golden path — document → generate → evaluate")
    print("=" * 60)

    if not os.getenv("MONGODB_URI"):
        print("  SKIP — no MONGODB_URI")
        return
    if not os.getenv("GEMINI_API_KEY"):
        print("  SKIP — no GEMINI_API_KEY")
        return

    from bson import ObjectId

    db = get_mongo_db()
    extracted = """
    The water cycle describes how water moves through Earth's systems.
    Water evaporates from oceans when heated by the sun, turning into
    water vapor. This vapor rises, cools, and condenses into clouds.
    When enough droplets gather, they fall as rain, snow, or hail.
    This water flows into rivers and back to the ocean to start again.
    """
    inserted = db["documents"].insert_one(
        {
            "filename": "golden_path_synthetic.pdf",
            "extracted_text": extracted.strip(),
            "text_length": len(extracted.strip()),
            "text_preview": extracted.strip()[:200],
            "uploaded_at": datetime.now(timezone.utc),
        }
    )
    doc_id = str(inserted.inserted_id)
    print(f"  Inserted synthetic document {doc_id}")

    try:
        engine = StoryEngine(gemini_api_key=os.environ["GEMINI_API_KEY"])
        story = await engine.generate_story(
            GenerateStoryRequest(
                document_id=doc_id,
                child_age=9,
                learning_needs=[LearningNeed.NONE],
                num_questions=1,
            )
        )
        print(f"  Generated: '{story.title}' ({len(story.segments)} segments)")

        q_seg = next((s for s in story.segments if s.type == SegmentType.QUESTION), None)
        if not q_seg:
            print("  FAILED ❌ — no question segment in generated story")
            return

        question = QuestionSegment(**q_seg.model_dump())
        ev = await engine.evaluate_answer(
            EvaluateAnswerRequest(
                question_segment=question,
                child_answer_text="Water evaporates and then rains back down.",
                child_age=9,
                learning_needs=[LearningNeed.NONE],
            )
        )
        enc = ev.encouragement or ""
        tail = enc[:80] + ("…" if len(enc) > 80 else "")
        print(f"  Evaluation: {ev.result.value} — {tail}")
        print("  PASSED ✅")
    except Exception as e:
        print(f"  FAILED ❌: {e}")
        raise
    finally:
        db["documents"].delete_one({"_id": ObjectId(doc_id)})
        print(f"  Cleaned up document {doc_id}")


async def main():
    print("AudioAlly — Integration Test Suite")
    print("=" * 60)

    await test_validate_example_story()
    await test_mongodb_connection()

    if os.getenv("GEMINI_API_KEY"):
        await test_topic_generation()
        await test_content_generation()
        await test_answer_evaluation()
        await test_golden_path_document_flow()
    else:
        print("\n⏭  Set GEMINI_API_KEY in .env to run AI tests (3-6)")

    print("\n" + "=" * 60)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())