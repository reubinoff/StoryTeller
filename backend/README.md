# StoryTeller Backend

FastAPI backend for the StoryTeller English-learning app. Implements the API contract consumed by the React Router 7 SPA in `../client`.

## Stack

- Python 3.13, FastAPI
- SQLAlchemy 2.x async + PostgreSQL 17 (asyncpg)
- Alembic migrations
- Anthropic Claude for content generation + writing evaluation
- Jinja2 prompt templates
- JWT (HS256) bearer auth, Argon2id password hashing
- pytest + pytest-asyncio + httpx for tests (in-memory aiosqlite for hermeticity)

## Setup

```bash
cp .env.example .env
# edit .env: set ANTHROPIC_API_KEY, JWT_SECRET, DATABASE_URL

# Local Postgres via docker (one-liner):
docker run -d --name storyteller-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=storyteller postgres:17

uv sync
uv run --no-sync alembic upgrade head
uv run --no-sync uvicorn app.main:app --reload --port 8000
```

The static catalog (15 interests, 2 courses, achievements) is auto-seeded on startup if missing.

## Tests

```bash
uv run --no-sync pytest -v tests/
uv run --no-sync pytest --cov=app --cov-report=term-missing tests/
```

Tests run against in-memory SQLite and patch the Anthropic client with a deterministic stub — no network access required.

## Layout

```
app/
  main.py              FastAPI factory, middleware, lifespan
  config.py            Pydantic Settings
  deps.py              get_db, get_current_user
  api/v1/
    routers/           HTTP route handlers (no SQL here)
    schemas/           Pydantic DTOs (snake_case wire format)
  core/
    errors.py          RFC 7807 problem details
    middleware.py      X-Request-Id middleware
    security.py        Argon2id + JWT
    grading.py         Reading task scoring
  db/
    base.py            DeclarativeBase
    session.py         async engine + session factory
    models/            ORM tables
  services/            Domain logic (auth, tasks, content, evaluation, dashboard)
  llm/
    claude_client.py   Anthropic SDK wrapper
    prompts/           Jinja templates (reading_passage, writing_prompt, writing_evaluation)
  seed.py              Idempotent static catalog seeder
alembic/
  versions/            DB migrations
tests/
  unit/                Pure-python tests (no DB)
  integration/         Router tests via httpx.AsyncClient
```

## Endpoint surface

All under `/api/v1`. Mirrors `client/API_CONTRACT.md` exactly: auth, /me, catalog, tasks, dashboard, notifications, health. Out of scope in v1: Google OAuth, password reset, refresh-token rotation, WebSocket — those endpoints return 501.
