"""
StoryPath Data Models — THE SHARED CONTRACT
=============================================
Every team member depends on these schemas.
Person 1 (Story Engine) produces them.
Person 2 (Voice Engine) consumes segments + voices.
Person 3 (Backend/DB) stores them in MongoDB.
Person 4 (Frontend) renders them.

DO NOT change these without telling the whole team.
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


# ─── Enums ───────────────────────────────────────────────────────────────────

class SegmentType(str, Enum):
    NARRATION = "narration"
    QUESTION = "question"
    INTRO = "intro"
    RECAP = "recap"


class EvaluationResult(str, Enum):
    CORRECT = "correct"
    INCORRECT = "incorrect"
    UNCLEAR = "unclear"


class LearningNeed(str, Enum):
    ADHD = "adhd"
    DYSLEXIA = "dyslexia"
    ESL = "esl"
    NONE = "none"


# ─── Voice Config ────────────────────────────────────────────────────────────

class VoiceConfig(BaseModel):
    """Describes a character voice for ElevenLabs mapping."""
    character_name: str = Field(description="Display name, e.g. 'Ben Franklin'")
    description: str = Field(description="Voice personality, e.g. 'Wise, grandfatherly, humorous'")
    gender: str = Field(default="neutral", description="male, female, or neutral")
    age: str = Field(default="adult", description="child, teen, adult, elderly")


# ─── Story Segments ──────────────────────────────────────────────────────────

class NarrationSegment(BaseModel):
    """A story segment that gets read aloud."""
    id: str = Field(description="Unique segment ID, e.g. 'seg_1'")
    type: SegmentType = SegmentType.NARRATION
    speaker: str = Field(description="Key into the voices dict, e.g. 'narrator'")
    text: str = Field(description="The narration text. Max ~75 words for ~30s of audio.")
    next: str = Field(description="ID of the next segment to play")


class QuestionSegment(BaseModel):
    """A segment where the child is asked a question."""
    id: str = Field(description="Unique segment ID, e.g. 'q_1'")
    type: SegmentType = SegmentType.QUESTION
    speaker: str = Field(description="Key into the voices dict")
    question_text: str = Field(description="The question read aloud to the child")
    correct_answer_keywords: list[str] = Field(
        description="Keywords/phrases that indicate understanding. Be generous."
    )
    acceptable_explanation: str = Field(
        description="A plain-language description of what a correct answer looks like. "
                    "Used by the evaluator to judge semantic meaning, not just keywords."
    )
    correct_next: str = Field(description="Segment ID to play if answer is correct")
    incorrect_next: str = Field(description="Segment ID to play if answer is wrong")
    hint_text: str = Field(
        description="Friendly hint read aloud if the child answers incorrectly. "
                    "Should re-explain the concept in simpler terms."
    )
    fallback_choices: list[str] = Field(
        default_factory=list,
        description="2-3 multiple choice options for button-tap fallback. "
                    "First item should be the correct answer."
    )


# ─── Full Story ──────────────────────────────────────────────────────────────

class StorySegment(BaseModel):
    """Union type — either narration or question."""
    id: str
    type: SegmentType
    speaker: str
    # Narration fields
    text: Optional[str] = None
    next: Optional[str] = None
    # Question fields
    question_text: Optional[str] = None
    correct_answer_keywords: Optional[list[str]] = None
    acceptable_explanation: Optional[str] = None
    correct_next: Optional[str] = None
    incorrect_next: Optional[str] = None
    hint_text: Optional[str] = None
    fallback_choices: Optional[list[str]] = None


class GeneratedStory(BaseModel):
    """The complete story output — this is what the whole system passes around."""
    title: str = Field(description="Story title, e.g. 'The Boston Tea Party Adventure'")
    topic: str = Field(description="The educational topic covered")
    target_age: int = Field(description="Target age of the child")
    learning_needs: list[LearningNeed] = Field(default_factory=list)
    estimated_duration_minutes: int = Field(
        default=5,
        description="Estimated listen time in minutes"
    )
    voices: dict[str, VoiceConfig] = Field(
        description="Map of speaker keys to voice configs. Always includes 'narrator'."
    )
    segments: list[StorySegment] = Field(
        description="Ordered list of story segments"
    )
    first_segment_id: str = Field(
        description="The ID of the first segment to play"
    )


# ─── API Request/Response Models ─────────────────────────────────────────────

class GenerateStoryRequest(BaseModel):
    """Request to generate a new story."""
    content: Optional[str] = Field(
        default=None,
        description="Raw text content to turn into a story. "
                    "Provide either this OR topic OR document_id."
    )
    topic: Optional[str] = Field(
        default=None,
        description="A topic string, e.g. 'The American Revolution for 4th graders'"
    )
    document_id: Optional[str] = Field(
        default=None,
        description="MongoDB document ID of an uploaded PDF (Person 3 handles upload)"
    )
    child_age: int = Field(default=10, ge=5, le=16)
    learning_needs: list[LearningNeed] = Field(default_factory=lambda: [LearningNeed.NONE])
    num_questions: int = Field(
        default=2, ge=1, le=5,
        description="Number of interactive questions to include"
    )


class EvaluateAnswerRequest(BaseModel):
    """Request to evaluate a child's spoken answer."""
    question_segment: QuestionSegment
    child_answer_text: str = Field(description="Transcribed text of what the child said")
    child_age: int = Field(default=10)
    learning_needs: list[LearningNeed] = Field(default_factory=lambda: [LearningNeed.NONE])


class EvaluateAnswerResponse(BaseModel):
    """Result of evaluating a child's answer."""
    result: EvaluationResult
    encouragement: str = Field(
        description="A short, warm message for the child. "
                    "Always positive even if incorrect."
    )
    explanation: Optional[str] = Field(
        default=None,
        description="If incorrect, a gentle re-explanation of the concept"
    )
