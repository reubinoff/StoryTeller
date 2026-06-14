"""Health and readiness tests."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import AsyncClient

from app.db.session import get_session


class BrokenSession:
    async def execute(self, *_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("db offline")


async def broken_session() -> AsyncIterator[BrokenSession]:
    yield BrokenSession()


@pytest.mark.asyncio
async def test_healthz_returns_ok(client: AsyncClient) -> None:
    resp = await client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_readyz_with_db_up_returns_ready(client: AsyncClient) -> None:
    resp = await client.get("/readyz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}


@pytest.mark.asyncio
async def test_readyz_with_db_down_returns_503(client: AsyncClient, app) -> None:
    original_override = app.dependency_overrides.get(get_session)
    app.dependency_overrides[get_session] = broken_session
    try:
        resp = await client.get("/readyz")
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_session, None)
        else:
            app.dependency_overrides[get_session] = original_override

    assert resp.status_code == 503
    body = resp.json()
    assert body["code"] == "unavailable"
    assert body["detail"] == "db offline"
