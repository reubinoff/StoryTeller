"""Task ORM model."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models._helpers import utcnow, uuid7


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_user_status", "user_id", "status", "created_at"),
        Index("ix_tasks_user_course_completed", "user_id", "course_type", "completed_at"),
        Index("ix_tasks_status_updated", "status", "updated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_slug: Mapped[str] = mapped_column(
        String(40), ForeignKey("courses.slug", ondelete="RESTRICT"), nullable=False
    )
    course_type: Mapped[str] = mapped_column(String(20), nullable=False)
    interest_slug: Mapped[str] = mapped_column(
        String(40), ForeignKey("interests.slug", ondelete="RESTRICT"), nullable=False
    )
    grade_level_at_roll: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_started")
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    topic_label: Mapped[str] = mapped_column(String(80), nullable=False)

    content_passage_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("content_passages.id", ondelete="SET NULL")
    )
    writing_prompt_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("writing_prompts.id", ondelete="SET NULL")
    )

    score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    xp_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    writing_draft: Mapped[str | None] = mapped_column(Text)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fail_reason: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )
