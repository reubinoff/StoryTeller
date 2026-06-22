"""llm usage events

Revision ID: 0005_llm_usage_events
Revises: 0004_admin_console
Create Date: 2026-06-22 00:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_llm_usage_events"
down_revision: str | None = "0004_admin_console"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "llm_usage_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("operation", sa.String(length=60), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("resource_type", sa.String(length=40), nullable=True),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cache_write_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cache_read_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("requests", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(12, 6), nullable=True),
        sa.Column("pricing_status", sa.String(length=20), nullable=False, server_default="unknown"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_llm_usage_events_created", "llm_usage_events", ["created_at"])
    op.create_index(
        "ix_llm_usage_events_model_created",
        "llm_usage_events",
        ["provider", "model", "created_at"],
    )
    op.create_index(
        "ix_llm_usage_events_operation_created",
        "llm_usage_events",
        ["operation", "created_at"],
    )
    op.create_index(
        "ix_llm_usage_events_task_created",
        "llm_usage_events",
        ["task_id", "created_at"],
    )
    op.create_index(
        "ix_llm_usage_events_user_created",
        "llm_usage_events",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_llm_usage_events_user_created", table_name="llm_usage_events")
    op.drop_index("ix_llm_usage_events_task_created", table_name="llm_usage_events")
    op.drop_index("ix_llm_usage_events_operation_created", table_name="llm_usage_events")
    op.drop_index("ix_llm_usage_events_model_created", table_name="llm_usage_events")
    op.drop_index("ix_llm_usage_events_created", table_name="llm_usage_events")
    op.drop_table("llm_usage_events")
