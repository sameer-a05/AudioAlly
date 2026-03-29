"""
StoryPath Data Models — THE SHARED CONTRACT
=============================================
Every team member depends on these schemas.
DO NOT change these without telling the whole team.
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


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


class VoiceConfig(BaseModel):
    character_name: str = Field(description="Display name")
    description: str = Field(description="Voice personality")
    gender: str = Field(default="neutral")
    age: str = Field(default="adult")


class NarrationSegment(BaseModel):
    id: str
    type: SegmentType = SegmentType.NARRATION
    speaker: str
    text: str
    next: str


class QuestionSegment(BaseModel):
    id: str
    type: SegmentType = SegmentType.QUESTION
    speaker: str
    question_text: str
    correct_answer_keywords: list[str]
    acceptable_explanation: str
    correct_next: str
    incorrect_next: str
    hint_text: str
    fallback_choices: list[str] = Field(default_factory=list)


class StorySegment(BaseModel):
    id: str
    type: SegmentType
    speaker: str
    text: Optional[str] = None
    next: Optional[str] = None
    question_text: Optional[str] = None
    correct_answer_keywords: Optional[list[str]] = None
    acceptable_explanation: Optional[str] = None
    correct_next: Optional[str] = None
    incorrect_next: Optional[str] = None
    hint_text: Optional[str] = None
    fallback_choices: Optional[list[str]] = None


class GeneratedStory(BaseModel):
    title: str
    topic: str
    target_age: int
    learning_needs: list[LearningNeed] = Field(default_factory=list)
    estimated_duration_minutes: int = Field(default=5)
    voices: dict[str, VoiceConfig]
    segments: list[StorySegment]
    first_segment_id: str


class GenerateStoryRequest(BaseModel):
    content: Optional[str] = None
    topic: Optional[str] = None
    document_id: Optional[str] = None
    child_age: int = Field(default=10, ge=5, le=16)
    learning_needs: list[LearningNeed] = Field(
        default_factory=lambda: [LearningNeed.NONE])
    num_questions: int = Field(default=2, ge=1, le=5)


class EvaluateAnswerRequest(BaseModel):
    question_segment: QuestionSegment
    child_answer_text: str
    child_age: int = Field(default=10)
    learning_needs: list[LearningNeed] = Field(
        default_factory=lambda: [LearningNeed.NONE])


class EvaluateAnswerResponse(BaseModel):
    result: EvaluationResult
    encouragement: str
    explanation: Optional[str] = None
