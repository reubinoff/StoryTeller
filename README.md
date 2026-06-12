# LinguaQuest

Gamified English-learning web app with reading and writing tasks, progress tracking, and AI-generated content. The repo is a monorepo with a React Router 7 frontend and a FastAPI backend.

## Repository layout

```
StoryTeller/
├── client/          # React Router 7 SPA (SSR)
├── backend/         # FastAPI + PostgreSQL + Anthropic Claude
└── client/API_CONTRACT.md   # Shared API contract
```

| Package | Stack | Docs |
|---------|-------|------|
| [`client/`](client/) | React 19, React Router 7, Tailwind CSS 4, TanStack Query | [client/README.md](client/README.md) |
| [`backend/`](backend/) | Python 3.13, FastAPI, SQLAlchemy 2 async, PostgreSQL 17, Claude | [backend/README.md](backend/README.md) |

## Quick start (frontend only)

The client runs against a localStorage-backed mock backend by default — no server required.

```bash
cd client
npm install
npm run dev          # http://localhost:5174
```

## Quick start (full stack)

**1. Backend**

```bash
cd backend
cp .env.example .env
# Set ANTHROPIC_API_KEY, JWT_SECRET, DATABASE_URL in .env

docker run -d --name lq-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=linguaquest postgres:17

uv sync
uv run --no-sync alembic upgrade head
uv run --no-sync uvicorn app.main:app --reload --port 8000
```

**2. Frontend (point at the real API)**

Create `client/.env.local`:

```
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Then start the dev server:

```bash
cd client
npm install
npm run dev
```

## Features

- **Auth & onboarding** — sign-up, login, grade selection, interest topics
- **Dashboard** — metrics, recent tasks, course recommendations, achievements preview
- **Reading tasks** — AI-generated passages, TTS, multiple question types, scored results
- **Writing tasks** — prompts, auto-save, async AI evaluation with annotated feedback
- **Gamification** — streaks, achievements, course catalog

## API contract

The frontend and backend share a single contract: [`client/API_CONTRACT.md`](client/API_CONTRACT.md). All endpoints live under `/api/v1`.

## Tests

```bash
# Backend
cd backend
uv run --no-sync pytest -v tests/

# Frontend
cd client
npm run test:run
```

## Deployment

The client includes a `Dockerfile` for production SSR (`npm run build` → `npm run start`). The backend runs as a standard Uvicorn ASGI app.
