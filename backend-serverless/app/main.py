"""FastAPI app factory."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import build_v1_router
from app.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.middleware import RequestIdMiddleware
from app.db.base import Base
from app.db.session import get_engine
from app.seed import seed_static_catalog

LOGGER = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
_migration_lock = asyncio.Lock()
_migrations_checked = False


def _run_alembic_upgrade() -> None:
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    command.upgrade(config, "head")


async def run_migrations_if_requested() -> None:
    global _migrations_checked
    settings = get_settings()
    if not settings.run_migrations_on_startup or _migrations_checked:
        return
    async with _migration_lock:
        if _migrations_checked:
            return
        LOGGER.warning("Running database migrations")
        await asyncio.to_thread(_run_alembic_upgrade)
        _migrations_checked = True
        LOGGER.warning("Database migrations completed")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    engine = get_engine()
    await run_migrations_if_requested()
    if settings.auto_create_schema:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    if settings.seed_on_startup:
        try:
            await seed_static_catalog()
        except Exception:
            LOGGER.exception("static catalog seed failed; continuing")
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id"],
    )
    register_exception_handlers(app)
    app.include_router(build_v1_router(), prefix="/api/v1")

    @app.get("/healthz", tags=["health"])
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
