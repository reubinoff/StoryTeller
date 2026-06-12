"""init schema

Revision ID: 0001_init
Revises:
Create Date: 2026-05-06

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_init"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_name", sa.String(length=40), nullable=False),
        sa.Column("last_name", sa.String(length=40), nullable=False),
        sa.Column("year_of_birth", sa.Integer(), nullable=False),
        sa.Column("grade_level", sa.Integer(), nullable=False),
        sa.Column("phone_number", sa.String(length=20), nullable=True),
        sa.Column("avatar_url", sa.String(length=1024), nullable=True),
        sa.Column("display_locale", sa.String(length=10), nullable=False, server_default="en"),
        sa.Column("theme_preference", sa.String(length=10), nullable=False, server_default="auto"),
        sa.Column("text_size_preference", sa.String(length=10), nullable=False, server_default="md"),
        sa.Column("reduce_motion", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notif_email_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notif_inapp_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_status", "users", ["status"])

    op.create_table(
        "auth_credentials",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("password_updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "interests",
        sa.Column("slug", sa.String(length=40), nullable=False),
        sa.Column("display_name", sa.String(length=60), nullable=False),
        sa.Column("emoji", sa.String(length=8), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("slug"),
    )

    op.create_table(
        "user_interests",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("interest_slug", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["interest_slug"], ["interests.slug"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("user_id", "interest_slug"),
    )

    op.create_table(
        "courses",
        sa.Column("slug", sa.String(length=40), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("subtitle", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("min_grade", sa.Integer(), nullable=False),
        sa.Column("max_grade", sa.Integer(), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("illustration", sa.String(length=40), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("slug"),
    )

    op.create_table(
        "content_passages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("interest_slug", sa.String(length=40), nullable=False),
        sa.Column("grade_level", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("paragraphs", sa.JSON(), nullable=False),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["interest_slug"], ["interests.slug"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_content_passages_lookup", "content_passages", ["interest_slug", "grade_level"])

    op.create_table(
        "writing_prompts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("interest_slug", sa.String(length=40), nullable=False),
        sa.Column("grade_level", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("hints", sa.JSON(), nullable=False),
        sa.Column("min_words", sa.Integer(), nullable=False),
        sa.Column("max_words", sa.Integer(), nullable=False),
        sa.Column("model", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["interest_slug"], ["interests.slug"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_writing_prompts_lookup", "writing_prompts", ["interest_slug", "grade_level"])

    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("course_slug", sa.String(length=40), nullable=False),
        sa.Column("course_type", sa.String(length=20), nullable=False),
        sa.Column("interest_slug", sa.String(length=40), nullable=False),
        sa.Column("grade_level_at_roll", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="not_started"),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("topic_label", sa.String(length=80), nullable=False),
        sa.Column("content_passage_id", sa.Uuid(), nullable=True),
        sa.Column("writing_prompt_id", sa.Uuid(), nullable=True),
        sa.Column("score", sa.Numeric(5, 2), nullable=True),
        sa.Column("xp_awarded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("writing_draft", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fail_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["course_slug"], ["courses.slug"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["interest_slug"], ["interests.slug"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["content_passage_id"], ["content_passages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["writing_prompt_id"], ["writing_prompts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tasks_user_id", "tasks", ["user_id"])
    op.create_index("ix_tasks_user_status", "tasks", ["user_id", "status", "created_at"])
    op.create_index("ix_tasks_user_course_completed", "tasks", ["user_id", "course_type", "completed_at"])
    op.create_index("ix_tasks_status_updated", "tasks", ["status", "updated_at"])

    op.create_table(
        "task_questions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("question_type", sa.String(length=20), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("options", sa.JSON(), nullable=True),
        sa.Column("correct_answer", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("max_points", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "position", name="uq_task_questions_position"),
    )
    op.create_index("ix_task_questions_task_id", "task_questions", ["task_id"])

    op.create_table(
        "task_answers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("question_id", sa.Uuid(), nullable=True),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("points_awarded", sa.Integer(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["task_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "question_id", name="uq_task_answers_question"),
    )
    op.create_index("ix_task_answers_task_id", "task_answers", ["task_id"])

    op.create_table(
        "task_evaluations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("model", sa.String(length=80), nullable=False),
        sa.Column("prompt_version", sa.String(length=20), nullable=False, server_default="v1"),
        sa.Column("score_overall", sa.Numeric(5, 2), nullable=False),
        sa.Column("score_grammar", sa.Numeric(5, 2), nullable=False),
        sa.Column("score_vocabulary", sa.Numeric(5, 2), nullable=False),
        sa.Column("score_structure", sa.Numeric(5, 2), nullable=False),
        sa.Column("score_relevance", sa.Numeric(5, 2), nullable=False),
        sa.Column("feedback_summary", sa.Text(), nullable=False),
        sa.Column("feedback_detail", sa.JSON(), nullable=False),
        sa.Column("focus_next", sa.JSON(), nullable=False),
        sa.Column("highlights", sa.JSON(), nullable=False),
        sa.Column("raw_response", sa.JSON(), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(10, 6), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id"),
    )

    op.create_table(
        "achievements",
        sa.Column("slug", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=240), nullable=False),
        sa.Column("icon", sa.String(length=8), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("slug"),
    )

    op.create_table(
        "user_achievements",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("achievement_slug", sa.String(length=40), nullable=False),
        sa.Column("earned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["achievement_slug"], ["achievements.slug"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("user_id", "achievement_slug"),
    )

    op.create_table(
        "streaks",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_date", sa.Date(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_notifications_user_created", table_name="notifications")
    op.drop_table("notifications")
    op.drop_table("streaks")
    op.drop_table("user_achievements")
    op.drop_table("achievements")
    op.drop_table("task_evaluations")
    op.drop_index("ix_task_answers_task_id", table_name="task_answers")
    op.drop_table("task_answers")
    op.drop_index("ix_task_questions_task_id", table_name="task_questions")
    op.drop_table("task_questions")
    op.drop_index("ix_tasks_status_updated", table_name="tasks")
    op.drop_index("ix_tasks_user_course_completed", table_name="tasks")
    op.drop_index("ix_tasks_user_status", table_name="tasks")
    op.drop_index("ix_tasks_user_id", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index("ix_writing_prompts_lookup", table_name="writing_prompts")
    op.drop_table("writing_prompts")
    op.drop_index("ix_content_passages_lookup", table_name="content_passages")
    op.drop_table("content_passages")
    op.drop_table("courses")
    op.drop_table("user_interests")
    op.drop_table("interests")
    op.drop_table("auth_credentials")
    op.drop_index("ix_users_status", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
