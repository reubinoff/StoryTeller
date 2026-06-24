"""Async writing evaluation result."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base
from app.db.models._helpers import utcnow, uuid7


class TaskEvaluation(Base):
    __tablename__ = "task_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid7)
    task_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(20), nullable=False, default="v1")

    score_overall: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    score_grammar: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    score_vocabulary: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    score_structure: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    score_relevance: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)

    feedback_summary: Mapped[str] = mapped_column(Text, nullable=False)
    feedback_detail: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    focus_next: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    highlights: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    raw_response: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float | None] = mapped_column(Numeric(10, 6))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
