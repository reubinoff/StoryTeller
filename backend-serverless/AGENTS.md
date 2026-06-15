# Backend Serverless — Codex Instructions

Azure Functions + FastAPI ASGI + Storage Queue worker. Overrides repo-root guidance for this package.

## Layout

```
backend-serverless/
├── function_app.py          # HTTP + queue entrypoints
├── host.json
├── app/                     # FastAPI app, services, models, LLM prompts
├── alembic/                 # Database migrations
├── infra/main.bicep         # Azure resources
└── tests/                   # unit/ and integration/
```

## Commands

```bash
uv sync
uv run --no-sync func start
uv run --no-sync alembic upgrade head
uv run --no-sync pytest -v tests/
```

Local URLs: `http://localhost:7071/healthz`, `http://localhost:7071/api/v1`, `http://localhost:7071/docs`.

Local config: copy `local.settings.json.example` → `local.settings.json` (gitignored). Never commit it.

## Local dependencies

- PostgreSQL: `docker run` per `README.md` or `docker start storyteller-pg`
- Azurite (queues): `docker start storyteller-azurite`
- `AzureWebJobsStorage=UseDevelopmentStorage=true` when using Azurite

## Python dependency files

- `pyproject.toml` is the human-edited source for runtime dependencies, dev dependencies, Python version, and tool config.
- `uv.lock` is the locked dependency resolution used by `uv run --frozen`; update it with `uv lock` after changing dependencies.
- `requirements.txt` is generated from `uv.lock` for Azure Functions remote build compatibility. Do not edit it by hand.
- After changing `pyproject.toml` or `uv.lock`, regenerate Azure's requirements file:

```bash
uv export --frozen --no-dev --format requirements-txt --no-hashes --output-file requirements.txt
```

- Before finishing dependency changes, run `git diff --exit-code -- requirements.txt` after the export, then run the relevant `uv run --frozen ...` test command.

## Conventions

- Python 3.13, strict mypy, ruff (`line-length = 100`).
- Async SQLAlchemy + asyncpg; settings via `app/config.py`.
- Writing evaluations: HTTP returns `202 processing`; `writing_evaluation_worker` processes the `writing-evaluations` queue.
- LLM prompts are Jinja templates in `app/llm/prompts/`.
- `LOGGER.exception` in except blocks; no f-strings in LOGGER calls.
- Add pytest tests one at a time; run each before writing the next.
- Any auth, user, role/status, metrics, task/content model, CORS, cookie, or
  deployment change must consider `/api/v1/admin/*` and the separate
  `admin-client/` console.

## Database

- Use the dedicated `storyteller` database — not the `guide-me` database (separate migration history).
- Migrations are not automatic on deploy; run `alembic upgrade head` from a VNet-capable environment for production.

## Tests

- Claude is stubbed in tests; `ANTHROPIC_API_KEY` is not required for pytest.
- Single-test runs may fail coverage; run `uv run --no-sync pytest -v tests/` before calling backend work done.

## Azure

- Infra source: `infra/main.bicep`. Deploy workflow: `.github/workflows/backend-serverless-ci-cd.yml`.
- For prod debugging, use `$storyteller-logs` and read `.codex/instructions/azure-resources.md`.
