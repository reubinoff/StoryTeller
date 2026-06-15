"""Task DTOs (mirrors client/app/lib/api/types.ts exactly)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_serializer

from app.api.v1.schemas.common import ApiModel
from app.api.v1.schemas.content import GeneratedWritingEvaluation

QuestionType = Literal["multiple_choice", "true_false", "fill_blank"]
TaskStatus = Literal[
    "not_started",
    "in_progress",
    "submitted",
    "processing",
    "completed",
    "needs_retry",
    "failed",
]
CourseType = Literal["unseen_text", "short_writing"]
CourseId = Literal["reading", "writing"]
PASSING_SCORE = 70


class TaskQuestionOut(ApiModel):
    id: UUID
    position: int
    question_type: QuestionType
    prompt: str
    options: list[str] | None = None
    correct_answer: str | None = None
    explanation: str | None = None
    max_points: int

    @model_serializer(mode="wrap")
    def _drop_hidden_fields(self, handler):  # type: ignore[no-untyped-def]
        data = handler(self)
        if data.get("correct_answer") is None:
            data.pop("correct_answer", None)
        if data.get("explanation") is None:
            data.pop("explanation", None)
        return data


class ReadingPayloadOut(ApiModel):
    title: str
    passage_text: str
    passage_paragraphs: list[str]
    passage_word_count: int
    questions: list[TaskQuestionOut]


class WritingPayloadOut(ApiModel):
    title: str
    prompt: str
    hints: list[str]
    min_words: int
    max_words: int
    draft: str | None = None


class TaskOut(ApiModel):
    id: UUID
    user_id: UUID
    course_id: CourseId
    course_type: CourseType
    interest_id: str
    grade_level_at_roll: int
    status: TaskStatus
    title: str
    topic_label: str
    reading: ReadingPayloadOut | None = None
    writing: WritingPayloadOut | None = None
    score: float | None = None
    xp_awarded: int
    started_at: datetime | None = None
    submitted_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    fail_reason: str | None = None
    passed: bool | None = None
    passing_score: int = PASSING_SCORE
    created_at: datetime
    updated_at: datetime


class RollTaskRequest(ApiModel):
    interest_id: str | None = None


class AnswerQuestionRequest(ApiModel):
    question_id: UUID
    answer: str | int


class AnswerAccepted(ApiModel):
    accepted: bool = True


class ReadingSubmitItem(ApiModel):
    question_id: UUID
    answer: str | int


class ReadingSubmitRequest(ApiModel):
    answers: list[ReadingSubmitItem] = Field(default_factory=list)


class WritingSubmitRequest(ApiModel):
    full_text: str = Field(min_length=1)


class WritingDraftRequest(ApiModel):
    text: str = ""


class WritingDraftResponse(ApiModel):
    saved_at: datetime


class ReadingSubmitResponse(TaskOut):
    correct_count: int
    total: int


class WritingSubmitAccepted(ApiModel):
    id: UUID
    status: TaskStatus
    submitted_at: datetime | None = None


class ReadingResultQuestion(TaskQuestionOut):
    user_answer: str | int | None = None
    is_correct: bool


class ReadingResultOut(ApiModel):
    task_id: UUID
    mode: Literal["reading"] = "reading"
    score: int
    total: int
    percentage: int
    duration_seconds: int
    xp_earned: int
    passed: bool
    passing_score: int = PASSING_SCORE
    questions: list[ReadingResultQuestion]


class WritingEvaluationOut(GeneratedWritingEvaluation):
    """The shape exposed on the wire (alias of the validated content schema)."""


class WritingResultOut(ApiModel):
    task_id: UUID
    mode: Literal["writing"] = "writing"
    status: TaskStatus
    answer_text: str
    evaluation: WritingEvaluationOut | None
    fail_reason: str | None = None
    xp_earned: int
    passed: bool | None
    passing_score: int = PASSING_SCORE
    submitted_at: datetime | None
    completed_at: datetime | None
