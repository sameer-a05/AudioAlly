"""
Quick test script for Person 1's Story Engine.

Run: python -m test_engine

Prerequisites:
  1. pip install -r requirements.txt
  2. Copy .env.example to .env and add your GEMINI_API_KEY
"""

import asyncio
import json
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.story_engine import StoryEngine
from app.models import (
    GenerateStoryRequest,
    EvaluateAnswerRequest,
    QuestionSegment,
    LearningNeed,
)


async def test_topic_generation():
    """Test generating a story from just a topic string."""
    print("\n" + "=" * 60)
    print("TEST 1: Generate story from topic")
    print("=" * 60)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("SKIP — no GEMINI_API_KEY in .env")
        return None

    engine = StoryEngine(gemini_api_key=api_key)

    request = GenerateStoryRequest(
        topic="Photosynthesis — how plants make food from sunlight",
        child_age=9,
        learning_needs=[LearningNeed.ADHD],
        num_questions=1,  # Keep it simple for testing
    )

    story = await engine.generate_story(request)

    print(f"Title: {story.title}")
    print(f"Segments: {len(story.segments)}")
    print(f"Voices: {list(story.voices.keys())}")
    print(f"First segment: {story.first_segment_id}")
    print(f"Duration: ~{story.estimated_duration_minutes} min")

    # Print the story flow
    print("\nStory flow:")
    for seg in story.segments:
        if seg.type == "question":
            print(f"  [{seg.id}] QUESTION ({seg.speaker}): {seg.question_text[:60]}...")
            print(f"    → correct: {seg.correct_next}, incorrect: {seg.incorrect_next}")
        else:
            print(f"  [{seg.id}] {seg.type.upper()} ({seg.speaker}): {seg.text[:60]}...")
            print(f"    → next: {seg.next}")

    return story


async def test_content_generation():
    """Test generating a story from raw text content."""
    print("\n" + "=" * 60)
    print("TEST 2: Generate story from raw content")
    print("=" * 60)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("SKIP — no GEMINI_API_KEY in .env")
        return None

    engine = StoryEngine(gemini_api_key=api_key)

    content = """
    The water cycle describes how water moves through Earth's systems.
    Water evaporates from oceans and lakes when heated by the sun, 
    turning from liquid into water vapor (a gas). This vapor rises into 
    the atmosphere where it cools and condenses into tiny water droplets, 
    forming clouds. When enough droplets gather, they fall as precipitation 
    — rain, snow, sleet, or hail. This water flows into rivers, lakes, 
    and underground aquifers, eventually making its way back to the ocean 
    where the cycle begins again. The water cycle is essential for all 
    life on Earth and has been running for billions of years.
    """

    request = GenerateStoryRequest(
        content=content,
        child_age=8,
        learning_needs=[LearningNeed.ESL],
        num_questions=2,
    )

    story = await engine.generate_story(request)

    print(f"Title: {story.title}")
    print(f"Segments: {len(story.segments)}")
    print(f"Questions: {sum(1 for s in story.segments if s.type == 'question')}")

    # Save to file for team to inspect
    with open("examples/water_cycle_generated.json", "w") as f:
        json.dump(story.model_dump(), f, indent=2)
    print("Saved to examples/water_cycle_generated.json")

    return story


async def test_answer_evaluation():
    """Test the answer evaluation with various child responses."""
    print("\n" + "=" * 60)
    print("TEST 3: Evaluate child answers")
    print("=" * 60)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("SKIP — no GEMINI_API_KEY in .env")
        return

    engine = StoryEngine(gemini_api_key=api_key)

    # Use the question from our example story
    question = QuestionSegment(
        id="q_1",
        type="question",
        speaker="samuel_adams",
        question_text="Why were the colonists so upset about the taxes?",
        correct_answer_keywords=[
            "no vote", "no say", "unfair", "didn't ask", "no representation",
        ],
        acceptable_explanation="The child understands the colonists had no say in tax decisions.",
        correct_next="seg_3_correct",
        incorrect_next="seg_3_incorrect",
        hint_text="Think about what makes a rule REALLY unfair.",
        fallback_choices=["They had no say", "Tea was expensive", "They didn't like the King"],
    )

    test_answers = [
        ("Because nobody asked them! They didn't get to vote on it.", "Should be CORRECT"),
        ("um they were mad because it wasn't fair they had no say", "Should be CORRECT (messy but right)"),
        ("because tea is yucky", "Should be INCORRECT"),
        ("", "Should be UNCLEAR (empty)"),
        ("asdfghjkl", "Should be UNCLEAR (garbled)"),
    ]

    for answer, expected in test_answers:
        if not answer:
            print(f"\n  Answer: (empty) — {expected}")
            print(f"  → Skipping empty (handled by API route)")
            continue

        request = EvaluateAnswerRequest(
            question_segment=question,
            child_answer_text=answer,
            child_age=10,
            learning_needs=[LearningNeed.ADHD],
        )

        result = await engine.evaluate_answer(request)
        print(f"\n  Answer: \"{answer}\"")
        print(f"  Expected: {expected}")
        print(f"  Got: {result.result}")
        print(f"  Encouragement: {result.encouragement}")
        if result.explanation:
            print(f"  Explanation: {result.explanation}")


async def test_validate_example_story():
    """Validate the hand-crafted example story passes our checks."""
    print("\n" + "=" * 60)
    print("TEST 4: Validate example story JSON")
    print("=" * 60)

    from app.models import GeneratedStory

    with open("examples/boston_tea_party.json") as f:
        data = json.load(f)

    try:
        story = GeneratedStory(**data)
        print(f"Parsed OK: '{story.title}'")
        print(f"  {len(story.segments)} segments")
        print(f"  {len(story.voices)} voices: {list(story.voices.keys())}")
        print(f"  Questions: {sum(1 for s in story.segments if s.type == 'question')}")

        # Run graph validation
        engine_cls = StoryEngine.__new__(StoryEngine)
        engine_cls._validate_story_graph(story)
        print("  Graph validation: PASSED")

    except Exception as e:
        print(f"  FAILED: {e}")


async def main():
    print("StoryPath Story Engine — Test Suite")
    print("=" * 60)

    # Test 4 always runs (no API needed)
    await test_validate_example_story()

    # Tests 1-3 need Gemini API key
    if os.getenv("GEMINI_API_KEY"):
        await test_topic_generation()
        await test_content_generation()
        await test_answer_evaluation()
    else:
        print("\nSet GEMINI_API_KEY in .env to run API tests (tests 1-3)")

    print("\n" + "=" * 60)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
