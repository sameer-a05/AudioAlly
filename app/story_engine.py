"""
StoryPath Story Engine — Person 1's Core Logic
================================================
Handles:
  1. Taking educational content → generating interactive stories via Gemini
  2. Evaluating child answers via Gemini
  3. Expanding bare topics into educational content via Gemini
"""

import asyncio
import json
import logging
import re
import time
from typing import Optional

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

from app.models import (
    GeneratedStory,
    GenerateStoryRequest,
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    EvaluationResult,
    StorySegment,
)
from app.prompts.story_prompts import (
    get_story_generation_prompt,
    get_answer_evaluation_prompt,
    get_topic_expansion_prompt,
)

logger = logging.getLogger(__name__)


class StoryEngine:
    """
    The brain of StoryPath. Takes educational content and produces
    interactive audio story structures.
    """

    def __init__(self, gemini_api_key: str):
        genai.configure(api_key=gemini_api_key)
        # Use Gemini 2.5 Flash — fast, cheap, great for structured generation
        # gemini-2.0-flash is deprecated for new users as of March 2026
        self.model = genai.GenerativeModel("gemini-2.5-flash")
        # Separate model config for evaluation (needs to be fast)
        self.eval_model = genai.GenerativeModel("gemini-2.5-flash")

    async def generate_story(self, request: GenerateStoryRequest) -> GeneratedStory:
        """
        Main entry point. Takes a GenerateStoryRequest and returns a complete
        GeneratedStory ready for the voice engine.

        Flow:
          1. Resolve content (from raw text, topic expansion, or document)
          2. Generate story structure via Gemini
          3. Validate and return
        """

        # Step 1: Get the educational content
        content = await self._resolve_content(request)

        if not content or len(content.strip()) < 20:
            raise ValueError(
                "Could not extract enough educational content. "
                "Provide text, a topic, or a valid document_id."
            )

        # Step 2: Generate the story
        learning_needs = [need.value for need in request.learning_needs]

        system_prompt, user_prompt = get_story_generation_prompt(
            content=content,
            child_age=request.child_age,
            learning_needs=learning_needs,
            num_questions=request.num_questions,
        )

        logger.info(f"Generating story for age={request.child_age}, needs={learning_needs}")

        # Retry up to 3 times — Gemini sometimes returns broken JSON
        max_retries = 3
        last_error = None

        for attempt in range(max_retries):
            # Lower temperature on retries for more predictable JSON
            temp = max(0.4, 0.8 - (attempt * 0.2))

            if attempt > 0:
                logger.info(f"Retry {attempt}/{max_retries - 1}, temp={temp}")

            response = await self._call_gemini(
                self.model,
                [
                    {"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}
                ],
                generation_config=genai.GenerationConfig(
                    temperature=temp,
                    top_p=0.95,
                    max_output_tokens=8192,
                    response_mime_type="application/json",
                ),
            )

            try:
                # Step 3: Parse and validate
                story = self._parse_story_response(response.text)

                # Step 4: Validate story graph integrity
                self._validate_story_graph(story)

                logger.info(
                    f"Generated story '{story.title}' with {len(story.segments)} segments"
                    f" (attempt {attempt + 1})"
                )
                return story

            except (ValueError, json.JSONDecodeError) as e:
                last_error = e
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
                continue

        # All retries exhausted
        raise ValueError(
            f"Story generation failed after {max_retries} attempts. "
            f"Last error: {last_error}"
        )

    async def evaluate_answer(
        self, request: EvaluateAnswerRequest
    ) -> EvaluateAnswerResponse:
        """
        Evaluate a child's spoken answer against a question segment.
        Designed to be GENEROUS — we'd rather false-positive than crush a kid's spirit.
        """

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
            [
                {"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}
            ],
            generation_config=genai.GenerationConfig(
                temperature=0.3,
                max_output_tokens=512,
                response_mime_type="application/json",
            ),
        )

        return self._parse_evaluation_response(response.text, request)

    async def expand_topic(self, topic: str, child_age: int) -> str:
        """
        Takes a bare topic string like "The American Revolution" and
        generates educational content that the story generator can use.
        """

        system_prompt, user_prompt = get_topic_expansion_prompt(topic, child_age)

        response = await self._call_gemini(
            self.model,
            [
                {"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}
            ],
            generation_config=genai.GenerationConfig(
                temperature=0.5,
                max_output_tokens=1024,
            ),
        )

        return response.text

    # ─── Private Helpers ─────────────────────────────────────────────────

    async def _call_gemini(self, model, contents, generation_config, max_rate_retries=3):
        """
        Wrapper around model.generate_content that handles rate limiting.
        Automatically waits and retries on 429 ResourceExhausted errors.
        """
        for i in range(max_rate_retries):
            try:
                return model.generate_content(
                    contents, generation_config=generation_config
                )
            except google_exceptions.ResourceExhausted as e:
                # Extract wait time from error if available, default to 20s
                wait_time = 20
                error_msg = str(e)
                # Try to parse "retry in X.XXXs" from the error
                match = re.search(r'retry in (\d+\.?\d*)', error_msg, re.IGNORECASE)
                if match:
                    wait_time = float(match.group(1)) + 1  # Add 1s buffer

                if i < max_rate_retries - 1:
                    logger.warning(
                        f"Rate limited by Gemini. Waiting {wait_time:.0f}s "
                        f"(attempt {i + 1}/{max_rate_retries})..."
                    )
                    await asyncio.sleep(wait_time)
                else:
                    raise ValueError(
                        f"Gemini rate limit exceeded after {max_rate_retries} waits. "
                        f"You're on the free tier — either wait a minute, get a new API key, "
                        f"or enable billing at https://aistudio.google.com/apikey"
                    ) from e

    async def _resolve_content(self, request: GenerateStoryRequest) -> str:
        """
        Determine where the educational content comes from:
        1. Direct text content (highest priority)
        2. Topic string (expand via Gemini)
        3. Document ID (fetch from Person 3's DB — stubbed for now)
        """

        if request.content:
            return request.content

        if request.topic:
            logger.info(f"Expanding topic: {request.topic}")
            return await self.expand_topic(request.topic, request.child_age)

        if request.document_id:
            # Fetch extracted text from MongoDB
            return await self._fetch_document_content(request.document_id)

        raise ValueError("Must provide content, topic, or document_id")

    async def _fetch_document_content(self, document_id: str) -> str:
        """
        Fetch extracted text for an uploaded document from extracted_texts/{document_id}.txt.
        """
        import os
        import logging
        logger = logging.getLogger("story_engine.fetch_document_content")
        base_dir = os.path.dirname(os.path.abspath(__file__))
        extracted_dir = os.path.join(base_dir, '..', 'extracted_texts')
        file_path = os.path.join(extracted_dir, f"{document_id}.txt")
        logger.info(f"Looking for extracted text at {file_path}")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            logger.info(f"Loaded extracted text for document_id: {document_id}, length={len(text)}")
            return text
        except FileNotFoundError:
            logger.error(f"No extracted text file found for document_id: {document_id}")
            raise ValueError(f"No extracted text found for document_id: {document_id}")
        except Exception as e:
            logger.error(f"Error reading extracted text for document_id {document_id}: {e}")
            raise ValueError(f"Error reading extracted text for document_id: {document_id}")

    def _repair_json(self, text: str) -> str:
        """
        Attempt to fix common JSON issues from Gemini:
        - Trailing commas before } or ]
        - Single quotes instead of double quotes (outside of values)
        - Truncated JSON (try to close open brackets)
        - Control characters inside strings
        - Unescaped newlines in string values
        """

        # Remove markdown fences
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        # Remove trailing commas before } or ] (most common Gemini issue)
        text = re.sub(r',\s*([}\]])', r'\1', text)

        # Remove control characters that aren't whitespace
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)

        # If JSON is truncated (doesn't end with } or ]), try to close it
        if text and text[-1] not in ('}', ']'):
            # Count open vs close braces/brackets
            open_braces = text.count('{') - text.count('}')
            open_brackets = text.count('[') - text.count(']')

            # Try to find last complete segment and close from there
            # First, try to find the last complete string value
            last_quote = text.rfind('"')
            if last_quote > 0:
                # Check if we're inside a truncated string
                # Count quotes — if odd, we have an unclosed string
                quote_count = text.count('"')
                if quote_count % 2 == 1:
                    text = text[:last_quote] + '"'

            # Close brackets and braces
            text += ']' * max(0, open_brackets)
            text += '}' * max(0, open_braces)

        return text

    def _parse_story_response(self, raw_response: str) -> GeneratedStory:
        """
        Parse Gemini's JSON response into our validated model.
        Tries direct parse first, then applies repairs if needed.
        """

        text = raw_response.strip()

        # First, try direct parse (fast path)
        clean = text
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()

        data = None

        try:
            data = json.loads(clean)
        except json.JSONDecodeError:
            # Direct parse failed — try repair
            logger.info("Direct JSON parse failed, attempting repair...")
            repaired = self._repair_json(raw_response)
            try:
                data = json.loads(repaired)
                logger.info("JSON repair succeeded!")
            except json.JSONDecodeError as e:
                # Log the problematic area for debugging
                error_pos = e.pos if hasattr(e, 'pos') else -1
                context_start = max(0, error_pos - 80)
                context_end = min(len(repaired), error_pos + 80)
                logger.error(
                    f"JSON repair also failed at position {error_pos}:\n"
                    f"...{repaired[context_start:context_end]}..."
                )
                raise ValueError(
                    f"Gemini returned invalid JSON that couldn't be auto-repaired. "
                    f"Error near position {error_pos}: {e}"
                )

        # Validate through Pydantic
        try:
            story = GeneratedStory(**data)
        except Exception as e:
            logger.error(f"Gemini JSON didn't match our schema: {e}")
            logger.error(
                f"Parsed data keys: {data.keys() if isinstance(data, dict) else 'not a dict'}"
            )
            raise ValueError(
                f"Gemini's output didn't match the expected story structure: {e}"
            )

        return story

    def _parse_evaluation_response(
        self, raw_response: str, request: EvaluateAnswerRequest
    ) -> EvaluateAnswerResponse:
        """Parse the evaluation result from Gemini."""

        text = raw_response.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # If parsing fails, default to "unclear" — never punish the child
            # for our technical failures
            logger.warning("Failed to parse evaluation response, defaulting to 'unclear'")
            return EvaluateAnswerResponse(
                result=EvaluationResult.UNCLEAR,
                encouragement="I didn't quite catch that — can you try saying it one more time?",
                explanation=None,
            )

        # Map the result string to our enum, defaulting to UNCLEAR on any weirdness
        result_str = data.get("result", "unclear").lower()
        try:
            result = EvaluationResult(result_str)
        except ValueError:
            result = EvaluationResult.UNCLEAR

        return EvaluateAnswerResponse(
            result=result,
            encouragement=data.get(
                "encouragement",
                "Great effort! Let's keep going!"
            ),
            explanation=data.get("explanation"),
        )

    def _validate_story_graph(self, story: GeneratedStory) -> None:
        """
        Verify that the story's segment graph is valid:
        - first_segment_id points to a real segment
        - All 'next', 'correct_next', 'incorrect_next' refs point to real segments
        - All speakers reference voices that exist
        - No orphaned segments (unreachable from first_segment_id)
        """

        segment_ids = {seg.id for seg in story.segments}
        voice_keys = set(story.voices.keys())

        # Check first segment exists
        if story.first_segment_id not in segment_ids:
            raise ValueError(
                f"first_segment_id '{story.first_segment_id}' "
                f"doesn't match any segment. Available: {segment_ids}"
            )

        for seg in story.segments:
            # Check speaker exists in voices
            if seg.speaker not in voice_keys:
                raise ValueError(
                    f"Segment '{seg.id}' references speaker '{seg.speaker}' "
                    f"but available voices are: {voice_keys}"
                )

            # Check next references for narration segments
            if seg.type in ("narration", "intro") and seg.next:
                if seg.next not in segment_ids:
                    raise ValueError(
                        f"Segment '{seg.id}' points to next='{seg.next}' which doesn't exist"
                    )

            # Check branch references for question segments
            if seg.type == "question":
                if seg.correct_next and seg.correct_next not in segment_ids:
                    raise ValueError(
                        f"Question '{seg.id}' correct_next='{seg.correct_next}' doesn't exist"
                    )
                if seg.incorrect_next and seg.incorrect_next not in segment_ids:
                    raise ValueError(
                        f"Question '{seg.id}' incorrect_next='{seg.incorrect_next}' doesn't exist"
                    )

        # Check for orphaned segments (warning only, don't crash)
        reachable = set()
        to_visit = [story.first_segment_id]
        while to_visit:
            current_id = to_visit.pop()
            if current_id in reachable:
                continue
            reachable.add(current_id)

            seg = next((s for s in story.segments if s.id == current_id), None)
            if seg is None:
                continue

            if seg.next:
                to_visit.append(seg.next)
            if seg.correct_next:
                to_visit.append(seg.correct_next)
            if seg.incorrect_next:
                to_visit.append(seg.incorrect_next)

        orphaned = segment_ids - reachable
        if orphaned:
            logger.warning(
                f"Story has {len(orphaned)} unreachable segment(s): {orphaned}. "
                f"These won't be played but won't cause errors."
            )