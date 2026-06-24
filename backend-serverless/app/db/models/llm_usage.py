"""Persisted LLM token usage telemetry."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models._helpers import utcnow, uuid7


class LLMUsageEvent(Base):
    __tablename__ = "llm_usage_events"
    __table_args__ = (
        Index("ix_llm_usage_events_created", "created_at"),
        Index("ix_llm_usage_events_user_created", "user_id", "created_at"),
        Index("ix_llm_usage_events_task_created", "task_id", "created_at"),
        Index("ix_llm_usage_events_model_created", "provider", "model", "created_at"),
        Index("ix_llm_usage_events_operation_created", "operation", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid7)
    operation: Mapped[str] = mapped_column(String(60), nullable=False)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)

    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    task_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="SET NULL"))
    resource_type: Mapped[str | None] = mapped_column(String(40))
    resource_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)

    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_write_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    requests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    cost_usd: Mapped[float | None] = mapped_column(Numeric(12, 6))
    pricing_status: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens + self.cache_write_tokens + self.cache_read_tokens
