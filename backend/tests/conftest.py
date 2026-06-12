"""Test fixtures: in-memory aiosqlite DB, Claude stub, AsyncClient."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Make sure the app reads the right env BEFORE we import anything from `app`.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-please-do-not-use-in-prod")
os.environ.setdefault("ANTHROPIC_API_KEY", "test")
os.environ.setdefault("SEED_ON_STARTUP", "false")
os.environ.setdefault("AUTO_CREATE_SCHEMA", "false")
os.environ.setdefault("ENVIRONMENT", "test")

from app.db.base import Base  # noqa: E402
from app.db import models  # noqa: F401, E402  (registers tables)
from app.db.session import get_session  # noqa: E402
from app.llm.claude_client import ClaudeClient, set_claude_client  # noqa: E402
from app.main import create_app  # noqa: E402
from app.seed import seed_static_catalog  # noqa: E402
from app.db import session as db_session_module  # noqa: E402
from tests.__conftest_helpers__ import (  # noqa: E402
    READING_RESPONSE,
    WRITING_EVAL_RESPONSE,
    WRITING_PROMPT_RESPONSE,
)


pytest_plugins = ("pytest_asyncio",)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ----- Claude stub -----


class StubClaudeClient(ClaudeClient):
    """Deterministic stand-in for Anthropic's client during tests."""

    def __init__(self) -> None:  # noqa: D401  (override base init)
        self._model = "claude-stub"
        self._max_tokens = 4096
        self._client = None  # type: ignore[assignment]
        self.calls: list[dict[str, Any]] = []
        self.next_response: dict[str, Any] | None = None

    @property
    def model(self) -> str:  # type: ignore[override]
        return self._model

    async def generate_json(  # type: ignore[override]
        self,
        *,
        prompt: str,
        system: str | None = None,
        max_retries: int = 1,
    ) -> tuple[dict[str, Any], int]:
        self.calls.append({"prompt": prompt, "system": system})
        if self.next_response is not None:
            payload, self.next_response = self.next_response, None
            return payload, 12
        if "comprehension questions" in prompt or "reading passage" in prompt:
            return READING_RESPONSE, 12
        if "writing prompt" in prompt or "short-answer writing prompt" in prompt:
            return WRITING_PROMPT_RESPONSE, 8
        if "evaluating a short writing answer" in prompt or "score the answer" in prompt.lower():
            return WRITING_EVAL_RESPONSE, 17
        return READING_RESPONSE, 12


@pytest_asyncio.fixture
async def claude_stub() -> AsyncIterator[StubClaudeClient]:
    stub = StubClaudeClient()
    set_claude_client(stub)
    try:
        yield stub
    finally:
        set_claude_client(None)


# ----- DB / app -----


@pytest_asyncio.fixture
async def db_engine(monkeypatch):
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sm = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with sm() as s:
        await seed_static_catalog(s)

    # Background tasks (writing eval) call ``get_sessionmaker()`` directly to
    # open their own session — point that at the in-memory test DB too.
    monkeypatch.setattr(db_session_module, "_engine", engine)
    monkeypatch.setattr(db_session_module, "_sessionmaker", sm)

    try:
        yield engine, sm
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def app(db_engine, claude_stub):  # noqa: ARG001  (claude_stub registered for side-effect)
    _engine, sm = db_engine
    fastapi_app = create_app()

    async def _override_session() -> AsyncIterator[AsyncSession]:
        async with sm() as session:
            yield session

    fastapi_app.dependency_overrides[get_session] = _override_session
    return fastapi_app


@pytest_asyncio.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test/api/v1", follow_redirects=False
    ) as c:
        yield c
