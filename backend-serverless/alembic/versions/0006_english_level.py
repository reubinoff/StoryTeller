"""english level scale

Revision ID: 0006_english_level
Revises: 0005_llm_usage_events
Create Date: 2026-06-22 00:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_english_level"
down_revision: str | None = "0005_llm_usage_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _level_from_school_grade(column_name: str) -> str:
    content_grade = f"GREATEST(1, LEAST(12, {column_name}) - 1)"
    return f"""
        CASE
            WHEN {content_grade} = 1 THEN 3
            WHEN {content_grade} = 2 THEN 10
            WHEN {content_grade} = 3 THEN 17
            WHEN {content_grade} = 4 THEN 24
            WHEN {content_grade} = 5 THEN 30
            WHEN {content_grade} = 6 THEN 37
            WHEN {content_grade} = 7 THEN 44
            WHEN {content_grade} = 8 THEN 50
            WHEN {content_grade} = 9 THEN 57
            WHEN {content_grade} = 10 THEN 64
            WHEN {content_grade} = 11 THEN 70
            ELSE 77
        END
    """


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("english_level", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tasks",
        sa.Column("english_level_at_roll", sa.Integer(), nullable=False, server_default="0"),
    )

    op.execute(f"UPDATE users SET english_level = {_level_from_school_grade('grade_level')}")
    op.execute(
        "UPDATE tasks SET english_level_at_roll = "
        f"{_level_from_school_grade('grade_level_at_roll')}"
    )

    op.alter_column("users", "english_level", server_default=None)
    op.alter_column("tasks", "english_level_at_roll", server_default=None)


def downgrade() -> None:
    op.drop_column("tasks", "english_level_at_roll")
    op.drop_column("users", "english_level")
