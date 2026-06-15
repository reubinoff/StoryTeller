# Storyteller

Gamified English-learning web app with reading and writing tasks, progress tracking, and AI-generated content. The repo is a monorepo with a React Router 7 frontend and an Azure Functions-hosted FastAPI backend.


## Repository layout

```
Storyteller/
├── client/          # React Router 7 SPA with prerendered public pages
├── backend-serverless/ # Azure Functions + FastAPI ASGI + queue worker
└── client/API_CONTRACT.md   # Shared API contract
```

| Package | Stack | Docs |
|---------|-------|------|
| [`client/`](client/) | React 19, React Router 7, Tailwind CSS 4, TanStack Query | [client/README.md](client/README.md) |
| [`backend-serverless/`](backend-serverless/) | Azure Functions, FastAPI ASGI, Storage Queue worker, PostgreSQL, Claude | [backend-serverless/README.md](backend-serverless/README.md) |

## Quick start (local full stack)

Local development requires the backend API at `http://localhost:7071/api/v1`.
Start the backend first, then run the client against it.

**1. Backend**

```bash
cd backend-serverless
cp .env.example .env
cp local.settings.json.example local.settings.json
# Set ANTHROPIC_API_KEY, JWT_SECRET, DATABASE_URL in .env

docker run -d --name storyteller-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=storyteller postgres:17

uv sync
uv run --no-sync alembic upgrade head
uv run --no-sync func start
```

**2. Frontend**

Create `client/.env.local`:

```
VITE_PUBLIC_SITE_URL=http://localhost:5174
VITE_API_BASE_URL=http://localhost:7071/api/v1
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
cd backend-serverless
uv run --no-sync pytest -v tests/

# Frontend
cd client
npm run test:run
```

## Deployment

The serverless backend lives in `backend-serverless/` and deploys to Azure Functions
with a Storage Queue worker for writing evaluations. See
[`backend-serverless/README.md`](backend-serverless/README.md) for local
debugging, Azure provisioning, migrations, and CI/CD.
