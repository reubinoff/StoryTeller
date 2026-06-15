"""default new users to light theme

Revision ID: 0003_default_light_theme
Revises: 0002_auth_identities_onboarding
Create Date: 2026-06-15 00:00:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision: str = "0003_default_light_theme"
down_revision: str | None = "0002_auth_identities_onboarding"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "theme_preference",
            existing_type=sa.String(length=10),
            server_default="light",
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "theme_preference",
            existing_type=sa.String(length=10),
            server_default="auto",
            existing_nullable=False,
        )
