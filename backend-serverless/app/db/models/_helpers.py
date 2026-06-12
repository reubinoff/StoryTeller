"""Shared model helpers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime


def uuid7() -> uuid.UUID:
    """Time-ordered UUID. uuid4 is fine for v1; swap to a real UUIDv7 lib later."""
    return uuid.uuid4()


def utcnow() -> datetime:
    return datetime.now(UTC)
