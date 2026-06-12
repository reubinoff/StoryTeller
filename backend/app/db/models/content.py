"""Generated-content cache: reading passages and writing prompts shared across users."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base
from app.db.models._helpers import utcnow, uuid7


class ContentPassage(Base):
    """A reading passage produced by Claude (or seeded). Reusable across users."""

    __tablename__ = "content_passages"
    __table_args__ = (
        Index("ix_content_passages_lookup", "interest_slug", "grade_level"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid7)
    interest_slug: Mapped[str] = mapped_column(
        String(40), ForeignKey("interests.slug", ondelete="RESTRICT"), nullable=False
    )
    grade_level: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    paragraphs: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    questions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )


class WritingPrompt(Base):
    """A writing prompt produced by Claude (or seeded). Reusable across users."""

    __tablename__ = "writing_prompts"
    __table_args__ = (
        Index("ix_writing_prompts_lookup", "interest_slug", "grade_level"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid7)
    interest_slug: Mapped[str] = mapped_column(
        String(40), ForeignKey("interests.slug", ondelete="RESTRICT"), nullable=False
    )
    grade_level: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    hints: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    min_words: Mapped[int] = mapped_column(Integer, nullable=False)
    max_words: Mapped[int] = mapped_column(Integer, nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
