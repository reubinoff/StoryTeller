"""Test fixtures: in-memory aiosqlite DB, LLM stub, AsyncClient."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from typing import Any, TypeVar

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Make sure the app reads the right env BEFORE we import anything from `app`.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-please-do-not-use-in-prod")
os.environ.setdefault("ANTHROPIC_API_KEY", "test")
os.environ.setdefault("SEED_ON_STARTUP", "false")
os.environ.setdefault("AUTO_CREATE_SCHEMA", "false")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault(
    "LLM_TOKEN_PRICING",
    '{"test:llm-stub":{"input_per_million":1.0,"output_per_million":2.0}}',
)

from app.db import models  # noqa: F401, E402  (registers tables)
from app.db import session as db_session_module  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_session  # noqa: E402
from app.llm.client import LLMClient, LLMRunMetadata, LLMUsage, set_llm_client  # noqa: E402
from app.main import create_app  # noqa: E402
from app.seed import seed_static_catalog  # noqa: E402
from app.services.evaluation_queue import (  # noqa: E402
    InMemoryEvaluationQueueClient,
    set_evaluation_queue_client,
)
from app.services.task_prewarm_queue import (  # noqa: E402
    InMemoryTaskPrewarmQueueClient,
    set_task_prewarm_queue_client,
)
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


OutputT = TypeVar("OutputT", bound=BaseModel)


# ----- LLM stub -----


def _stub_metadata(
    latency_ms: int, *, input_tokens: int, output_tokens: int
) -> LLMRunMetadata:
    return LLMRunMetadata(
        latency_ms=latency_ms,
        usage=LLMUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            requests=1,
        ),
    )


class StubClaudeClient(LLMClient):
    """Deterministic stand-in for the configured LLM during tests."""

    def __init__(self) -> None:  # noqa: D401  (override base init)
        self._model = "llm-stub"
        self._model_label = "test:llm-stub"
        self._max_tokens = 4096
        self.calls: list[dict[str, Any]] = []
        self.next_response: dict[str, Any] | None = None

    @property
    def model(self) -> str:
        return self._model_label

    async def generate_structured(
        self,
        *,
        prompt: str,
        output_type: type[OutputT],
        system: str | None = None,
        max_retries: int = 1,
    ) -> tuple[OutputT, LLMRunMetadata]:
        self.calls.append({"prompt": prompt, "system": system})
        if self.next_response is not None:
            payload, self.next_response = self.next_response, None
            return output_type.model_validate(payload), _stub_metadata(
                12, input_tokens=1000, output_tokens=250
            )
        if "comprehension questions" in prompt or "reading passage" in prompt:
            return output_type.model_validate(READING_RESPONSE), _stub_metadata(
                12, input_tokens=1200, output_tokens=220
            )
        if "writing prompt" in prompt or "short-answer writing prompt" in prompt:
            return output_type.model_validate(WRITING_PROMPT_RESPONSE), _stub_metadata(
                8, input_tokens=800, output_tokens=160
            )
        if "evaluating a short writing answer" in prompt or "score the answer" in prompt.lower():
            return output_type.model_validate(WRITING_EVAL_RESPONSE), _stub_metadata(
                17, input_tokens=1000, output_tokens=300
            )
        return output_type.model_validate(READING_RESPONSE), _stub_metadata(
            12, input_tokens=1200, output_tokens=220
        )


@pytest_asyncio.fixture
async def claude_stub() -> AsyncIterator[StubClaudeClient]:
    stub = StubClaudeClient()
    set_llm_client(stub)
    try:
        yield stub
    finally:
        set_llm_client(None)


@pytest_asyncio.fixture
async def evaluation_queue() -> AsyncIterator[InMemoryEvaluationQueueClient]:
    queue = InMemoryEvaluationQueueClient()
    set_evaluation_queue_client(queue)
    try:
        yield queue
    finally:
        set_evaluation_queue_client(None)


@pytest_asyncio.fixture
async def task_prewarm_queue() -> AsyncIterator[InMemoryTaskPrewarmQueueClient]:
    queue = InMemoryTaskPrewarmQueueClient()
    set_task_prewarm_queue_client(queue)
    try:
        yield queue
    finally:
        set_task_prewarm_queue_client(None)


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

    # The queue worker calls ``get_sessionmaker()`` directly to open its own
    # session — point that at the in-memory test DB too.
    monkeypatch.setattr(db_session_module, "_engine", engine)
    monkeypatch.setattr(db_session_module, "_sessionmaker", sm)

    try:
        yield engine, sm
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def app(
    db_engine,
    claude_stub,  # noqa: ARG001  (registered for side-effect)
    evaluation_queue,  # noqa: ARG001  (registered for side-effect)
    task_prewarm_queue,  # noqa: ARG001  (registered for side-effect)
):
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
