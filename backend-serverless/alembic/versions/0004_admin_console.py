"""admin console audit trail

Revision ID: 0004_admin_console
Revises: 0003_default_light_theme
Create Date: 2026-06-15 00:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_admin_console"
down_revision: str | None = "0003_default_light_theme"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "admin_audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("target_user_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_admin_audit_events_actor_created",
        "admin_audit_events",
        ["actor_user_id", "created_at"],
    )
    op.create_index(
        "ix_admin_audit_events_target_created",
        "admin_audit_events",
        ["target_user_id", "created_at"],
    )
    op.create_index(
        "ix_admin_audit_events_created", "admin_audit_events", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_admin_audit_events_created", table_name="admin_audit_events")
    op.drop_index("ix_admin_audit_events_target_created", table_name="admin_audit_events")
    op.drop_index("ix_admin_audit_events_actor_created", table_name="admin_audit_events")
    op.drop_table("admin_audit_events")
