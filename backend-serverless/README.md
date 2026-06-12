# StoryTeller Backend Serverless

Azure Functions version of the StoryTeller backend. This project is intentionally
standalone from `../backend`: it carries its own FastAPI app, services, models,
migrations, tests, Functions host config, and deployment assets.

## What Runs Here

- HTTP API: FastAPI is hosted through Azure Functions ASGI middleware.
- Public paths stay the same: `/api/v1/...` and `/healthz`.
- Worker: short writing evaluations are processed by an Azure Storage Queue
  trigger.
- Queue payload:

```json
{"schema_version":1,"kind":"writing_evaluation","task_id":"<uuid>"}
```

The submit and retry endpoints enqueue work and return `202 processing`. The
queue worker later calls `run_writing_evaluation(task_id)` and marks the task
`completed` or `failed`.

## Project Layout

```text
backend-serverless/
  function_app.py                  Azure Functions HTTP + queue entrypoints
  host.json                        Functions host, route prefix, queue settings
  local.settings.json.example      Safe local settings template
  requirements.txt                 Azure remote build dependency manifest
  pyproject.toml / uv.lock         Local development and tests
  app/                             FastAPI app, domain services, DB models
  alembic/                         Database migrations
  infra/main.bicep                 Azure resources
  tests/                           Serverless-aware test suite
```

## Local Prerequisites

Install these once:

- Python 3.13
- `uv`
- Azure Functions Core Tools v4
- Docker, for local PostgreSQL and Azurite
- Azure CLI, for Azure provisioning/deployment tasks

Useful checks:

```bash
python3.13 --version
uv --version
func --version
az --version
docker --version
```

## Local Configuration

Create local settings from the example:

```bash
cd backend-serverless
cp local.settings.json.example local.settings.json
```

Edit `local.settings.json`:

- `AzureWebJobsStorage`: use `UseDevelopmentStorage=true` when running Azurite.
- `DATABASE_URL`: local PostgreSQL URL.
- `JWT_SECRET`: any long local-only secret.
- `ANTHROPIC_API_KEY`: required for real Claude calls. Tests stub Claude and do
  not need a real key.
- `CORS_ORIGINS`: include your frontend dev origin.
- `EVALUATION_QUEUE_NAME`: defaults to `writing-evaluations`.

Do not commit `local.settings.json`; it can contain secrets and is ignored.

## Start Local Dependencies

Start PostgreSQL:

```bash
docker run -d --name storyteller-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=storyteller \
  postgres:17
```

Start Azurite for local queues:

```bash
docker run -d --name storyteller-azurite -p 10000:10000 -p 10001:10001 -p 10002:10002 \
  mcr.microsoft.com/azure-storage/azurite
```

If the containers already exist:

```bash
docker start storyteller-pg storyteller-azurite
```

Install dependencies and migrate the database:

```bash
cd backend-serverless
uv sync
uv run --no-sync alembic upgrade head
```

## Debug Locally

Run the Function App:

```bash
cd backend-serverless
uv run --no-sync func start
```

Local URLs:

- Health: `http://localhost:7071/healthz`
- API: `http://localhost:7071/api/v1`
- OpenAPI: `http://localhost:7071/docs`

Point the frontend at the local Function App:

```text
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:7071/api/v1
```

Then run the client:

```bash
cd ../client
npm install
npm run dev
```

### Debug The Queue Worker

The worker runs in the same `func start` process. To test it end to end:

1. Start `func start`.
2. Submit a writing task through the app.
3. The HTTP request returns `202`.
4. The queue trigger logs `Processing writing evaluation task_id=...`.
5. Poll `GET /api/v1/tasks/{task_id}` or `GET /api/v1/tasks/{task_id}/result`.

If you want to inspect the queue directly, use Azure Storage Explorer against
Azurite or an Azure Storage account and open the `writing-evaluations` queue.

### Local Troubleshooting

- `AzureWebJobsStorage is not configured`: `local.settings.json` is missing or
  does not contain `AzureWebJobsStorage`.
- Queue trigger does not fire: make sure Azurite is running and `func start`
  loaded the `writing_evaluation_worker` function.
- Message goes to poison queue: inspect the original payload. The worker rejects
  malformed JSON, unsupported `schema_version`, and unsupported `kind`.
- API works but worker cannot read DB: confirm `DATABASE_URL` in
  `local.settings.json` and run `uv run --no-sync alembic upgrade head`.
- Claude calls fail: set `ANTHROPIC_API_KEY`, or run tests where Claude is
  stubbed.
- CORS errors: add the frontend origin to `CORS_ORIGINS`.

## Tests

Run only serverless tests:

```bash
cd backend-serverless
uv run --frozen pytest -q
```

Run the full verification set from the migration plan:

```bash
cd backend
UV_PROJECT_ENVIRONMENT=/tmp/storyteller-backend-venv uv run --frozen pytest -q

cd ../backend-serverless
UV_PROJECT_ENVIRONMENT=/tmp/storyteller-serverless-venv uv run --frozen pytest -q

cd ../client
NODE_OPTIONS=--localstorage-file=/tmp/storyteller-vitest-localstorage npm run test:run
```

The existing backend and client static checks currently have pre-existing
non-test failures, so the provided CI gates on tests only.

## Provision Azure

The Bicep template creates:

- Linux Azure Function App on Flex Consumption, Python 3.13
- Storage account, deployment blob container, and `writing-evaluations` queue
- PostgreSQL Flexible Server and database
- Key Vault with `database-url`, `jwt-secret`, and `anthropic-api-key`
- Application Insights and Log Analytics
- Function App settings with Key Vault references for app secrets

Create a resource group:

```bash
az group create \
  --name rg-storyteller-prod \
  --location israelcentral
```

Copy and edit parameters:

```bash
cd backend-serverless
cp infra/main.parameters.json.example infra/main.parameters.json
```

Deploy infrastructure:

```bash
az deployment group create \
  --resource-group rg-storyteller-prod \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json
```

Record the outputs:

- `functionAppName`
- `functionAppUrl`
- `resourceGroupName`
- `keyVaultName`
- `postgresServerName`

Use these values for GitHub repository variables.

## Configure GitHub OIDC

The deploy workflow uses OIDC. Create a user-assigned managed identity or an
Entra application with a federated credential for this repository and `main`
branch. Grant it:

- `Website Contributor` on the Function App or resource group
- `Reader` on the resource group
- `Key Vault Secrets User` on the Key Vault if you use the manual migration
  workflow
- PostgreSQL firewall management permission if you use the manual migration
  workflow from GitHub-hosted runners

Set GitHub repository variables:

```text
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
AZURE_RESOURCE_GROUP
AZURE_FUNCTIONAPP_NAME
AZURE_FUNCTIONAPP_BASE_URL
AZURE_KEYVAULT_NAME
AZURE_POSTGRES_SERVER_NAME
```

`AZURE_FUNCTIONAPP_BASE_URL` can be omitted if the app is reachable at
`https://<AZURE_FUNCTIONAPP_NAME>.azurewebsites.net`.

## Deploy Code

Push to `main`. The workflow:

1. Runs existing backend tests.
2. Runs serverless backend tests.
3. Runs client Vitest with a Node localStorage file.
4. Logs in to Azure with OIDC.
5. Deploys `backend-serverless/` with the Azure Functions action.
6. Smoke-tests `/healthz`.

You can also deploy manually:

```bash
cd backend-serverless
func azure functionapp publish <function-app-name> --python
```

For Flex Consumption, keep `host.json` at the package root and do not set
`WEBSITE_RUN_FROM_PACKAGE`; Flex runs from package by default.

## Database Migrations

Migrations are intentionally not automatic on every deploy.

Recommended local/manual gate:

```bash
cd backend-serverless
DATABASE_URL='postgresql+asyncpg://...' uv run --frozen alembic upgrade head
```

Optional GitHub gate:

1. Run `Backend Serverless Manual Migrations`.
2. Enter `RUN`.
3. The workflow opens a temporary PostgreSQL firewall rule for the runner,
   reads `database-url` from Key Vault, runs `alembic upgrade head`, and removes
   the firewall rule.

If your database is private-networked later, replace the GitHub-hosted migration
workflow with an Azure-side job or run migrations from a machine inside the VNet.

## Production Troubleshooting

- No functions appear after deploy:
  - Confirm the deployment package root contains `host.json`.
  - Check the Functions deployment logs.
  - Confirm `remote-build: true` in the GitHub workflow.
- `/healthz` fails:
  - Check Function App logs in Application Insights.
  - Confirm app settings exist and Key Vault references are resolved.
- Key Vault references are unresolved:
  - Confirm the Function App managed identity has `get` access to secrets.
  - Restart the Function App after changing Key Vault permissions.
- Queue worker does not run:
  - Confirm `EVALUATION_QUEUE_NAME` matches the queue name.
  - Confirm `AzureWebJobsStorage` points at the Storage account.
  - Check `<queue-name>-poison` for failed messages.
- Writing tasks stay `processing`:
  - Check queue length and worker logs.
  - Check Anthropic failures and PostgreSQL connectivity.
- Migrations fail from GitHub:
  - Confirm `AZURE_KEYVAULT_NAME` and `AZURE_POSTGRES_SERVER_NAME`.
  - Confirm the deploy identity can read Key Vault secrets and edit PostgreSQL
    firewall rules.
  - Confirm the runner IP firewall rule was removed after the run.
