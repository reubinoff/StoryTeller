# StoryTeller Codex Instructions

Durable guidance for Codex in this repository. Keep prompts focused on the task; put repeatable rules here. When Codex makes the same mistake twice, update this file.

## Repository layout

```
StoryTeller/
├── client/                 # React Router 7 SPA (mock backend by default)
├── backend-serverless/     # Azure Functions + FastAPI + queue worker
├── client/API_CONTRACT.md  # Shared API contract — source of truth for /api/v1
└── .codex/
    ├── instructions/       # Long-form reference docs (read when relevant)
    └── skills/             # Project skills; also linked from .agents/skills/
```

Nested `AGENTS.md` files in `client/` and `backend-serverless/` add package-specific rules. Closer files override earlier guidance.

## Skills

Invoke project skills explicitly when they fit:

| Skill | Use when |
|-------|----------|
| `$azure-cli` | Any `az` command, infra inspection, deployment troubleshooting |
| `$storyteller-logs` | Production logs, App Insights, HTTP 4xx/5xx, exceptions |

Skills live in `.codex/skills/` and are discoverable via `.agents/skills/`. Before Azure or prod-debug work, read `.codex/instructions/azure-resources.md`.

## Run and verify

### Frontend (`client/`)

```bash
cd client
npm install
npm run dev              # http://localhost:5174, mock backend on by default
npm run typecheck
npm run test:run         # CI-style Vitest
npx vitest run app/routes/__tests__/login.test.tsx   # single file
```

### Backend (`backend-serverless/`)

```bash
cd backend-serverless
uv sync
uv run --no-sync func start                    # http://localhost:7071
uv run --no-sync alembic upgrade head
uv run --no-sync pytest -v tests/              # full suite (coverage gate)
uv run --no-sync pytest -v tests/unit/test_foo.py::test_bar   # single test
```

Use `uv run --no-sync` for Python commands. Do not use poetry.

### Full stack

See root `README.md` for Docker (PostgreSQL, Azurite), `client/.env.local`, and pointing the client at `http://localhost:7071/api/v1`.

## Done when

A task is complete only when:

1. The requested behavior works for the stated scope (include mobile + desktop for UI changes).
2. Relevant tests pass (`npm run test:run` and/or `uv run --no-sync pytest`).
3. API changes stay aligned with `client/API_CONTRACT.md`.
4. No secrets, tokens, or credentials are committed or printed.
5. For Azure writes: subscription and resource group were confirmed first.

Partial pytest runs often fail coverage thresholds; that is expected until the full suite runs.

## Engineering conventions

### General

- Minimize diff scope — change only what the task requires.
- Match existing naming, types, and patterns in the touched package.
- Do not commit unless the user explicitly asks.
- Do not create markdown docs the user did not request.

### Backend (Python 3.13)

- Use typing; docstrings are optional and minimal when used.
- In `except` blocks, log with `LOGGER.exception` (no f-strings in LOGGER calls).
- When adding pytest tests, write and run one test at a time; continue only after it passes.
- Raise exceptions deliberately; chain with `from` when wrapping.

### Frontend

- Default dev uses the localStorage mock (`VITE_USE_MOCK=true`); no server required.
- Design tokens and atoms live in `client/app/app.css` — reuse `btn-*`, `card`, `chip-*`, `field-*`, `app-shell`.
- Path alias `~` maps to `client/app/`.
- For UI work: consider mobile/responsive behavior and verify at mobile and desktop widths before finishing.

### API contract

- All endpoints are under `/api/v1`; health is `/healthz`.
- Frontend wire types use snake_case in `client/app/lib/api/types.ts`.
- Backend and frontend must agree on `client/API_CONTRACT.md` before merging contract changes.

## Azure and production

- Read `.codex/instructions/azure-resources.md` before Azure CLI work.
- Use `$azure-cli` for CLI operations and `$storyteller-logs` for telemetry.
- In Codex non-interactive shells, plain `az` may be missing; use `/opt/homebrew/bin/az` when `command -v az` returns nothing.
- Treat Azure as production by default. Confirm subscription and resource group before writes.
- Never print or commit secrets, storage keys, connection strings, tokens, or app setting values.
- Avoid `az keyvault secret show`, `az storage account keys list`, and full appsettings dumps; list names only when needed.

## Prompting tips (for humans using Codex)

Include in each task: **goal**, **context** (files/endpoints), **constraints**, and **done when**. Use `/plan` for multi-step or ambiguous work. Use `/review` before opening a PR.

## Extended reference

| Topic | Location |
|-------|----------|
| Azure inventory & safe commands | `.codex/instructions/azure-resources.md` |
| Full-stack quick start | `README.md` |
| Backend local debug, deploy, migrations | `backend-serverless/README.md` |
| Frontend architecture & env | `client/CLAUDE.md` (fallback when working in `client/`) |
