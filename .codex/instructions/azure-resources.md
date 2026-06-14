# StoryTeller Azure Resources

Last verified with read-only Azure CLI queries on 2026-06-14.

Use this file as project-local Azure context for StoryTeller. Do not treat it as a source of secrets; never fetch or print Key Vault secret values, storage keys, connection strings, or app setting values unless the user explicitly asks and the output can be handled securely.

## CLI Context

- Azure CLI path in this Codex environment: `/opt/homebrew/bin/az`
- Subscription: `Visual Studio Premium with MSDN`
- Subscription ID: `f93c22c4-86a5-4831-9b75-136506dcf5eb`
- Tenant ID: `ddfb0d44-fe2a-4bd3-8275-5cd8db6f884f`
- Signed-in user observed during verification: `reubinoff@gmail.com`

Before write operations, re-run:

```bash
/opt/homebrew/bin/az account show --query "{name:name,id:id,tenantId:tenantId,user:user.name}" --output table
```

## Primary Resource Group

- Name: `rg-storyteller-prod`
- Location: `israelcentral`
- Provisioning state: `Succeeded`
- Resource ID: `/subscriptions/f93c22c4-86a5-4831-9b75-136506dcf5eb/resourceGroups/rg-storyteller-prod`

This is the production StoryTeller app resource group.

## Resources In `rg-storyteller-prod`

### Function App

- Name: `storyteller-func-prod-4dghcj4shzqwa`
- Type: `Microsoft.Web/sites`
- Kind: `functionapp,linux`
- Location: `Israel Central`
- State: `Running`
- Default host: `storyteller-func-prod-4dghcj4shzqwa.azurewebsites.net`
- Custom API host: `api.storyteller.reubinoff.com`
- Custom API health check: `https://api.storyteller.reubinoff.com/healthz`
- Custom API Google OAuth start URL: `https://api.storyteller.reubinoff.com/api/v1/auth/google/start`
- HTTPS only: `true`
- App Service plan: `storyteller-plan-prod-4dghcj4shzqwa`
- Runtime: Python `3.13`
- Hosting: Flex Consumption, `2048` MB instance memory, max scale `100`
- Deployment package container: `https://storyteller4dghcj4shzqwa.blob.core.windows.net/function-packages`
- VNet integration subnet: `/subscriptions/f93c22c4-86a5-4831-9b75-136506dcf5eb/resourceGroups/guide-me-infra/providers/Microsoft.Network/virtualNetworks/guide-me-infra-vnet/subnets/storyteller-functions`
- Managed identity: system-assigned
- Managed identity principal ID: `012448ec-869c-40cf-8adf-6593b5b4fd9f`
- Functions:
  - `http_api` (`python`, enabled)
  - `writing_evaluation_worker` (`python`, enabled)

CLI-visible app setting names at verification time:

```text
AzureWebJobsStorage
APPLICATIONINSIGHTS_CONNECTION_STRING
AUTH_COOKIE_SECURE
JWT_ALGORITHM
JWT_ACCESS_TTL_SECONDS
JWT_REFRESH_TTL_SECONDS
CLAUDE_MODEL
CLAUDE_MAX_TOKENS
CORS_ORIGINS
EVALUATION_QUEUE_NAME
CREATE_EVALUATION_QUEUE_ON_ENQUEUE
SEED_ON_STARTUP
AUTO_CREATE_SCHEMA
ENVIRONMENT
DATABASE_URL
JWT_SECRET
ANTHROPIC_API_KEY
FRONTEND_BASE_URL
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI
```

Function App hostnames observed:

```text
storyteller-func-prod-4dghcj4shzqwa.azurewebsites.net
api.storyteller.reubinoff.com
```

`api.storyteller.reubinoff.com` is verified with SNI SSL and returned `{"status":"ok"}` from `/healthz` on 2026-06-14.

Google OAuth was configured on 2026-06-14 for client ID `525009119858-87fp032hjjuneqlcislnluprhp0l6150.apps.googleusercontent.com`. The signed-in Azure CLI user could not set `google-oauth-client-secret` in Key Vault, so `GOOGLE_OAUTH_CLIENT_SECRET` was set directly as a Function App app setting from the downloaded Google OAuth client JSON. Do not print or retrieve the setting value.

`GOOGLE_OAUTH_REDIRECT_URI` is set to:

```text
https://api.storyteller.reubinoff.com/api/v1/auth/google/callback
```

The Google Cloud OAuth client must include this exact backend callback URL as an authorized redirect URI. The downloaded client JSON observed on 2026-06-14 only listed `https://storyteller.reubinoff.com/auth/callback`, so update Google Cloud if browser login reports `redirect_uri_mismatch`.

### App Service Plan

- Name: `storyteller-plan-prod-4dghcj4shzqwa`
- Type: `Microsoft.Web/serverFarms`
- Kind: `functionapp`
- Location: `Israel Central`
- SKU: `FC1`
- Tier: `FlexConsumption`

### Storage Account

- Name: `storyteller4dghcj4shzqwa`
- Type: `Microsoft.Storage/storageAccounts`
- Kind: `StorageV2`
- Location: `israelcentral`
- SKU: `Standard_LRS`
- Access tier: `Hot`
- Minimum TLS: `TLS1_2`
- Blob public access: `false`
- Shared key access: `true`
- Network rules: default `Allow`, bypass `AzureServices`
- Blob endpoint: `https://storyteller4dghcj4shzqwa.blob.core.windows.net/`
- Queue endpoint: `https://storyteller4dghcj4shzqwa.queue.core.windows.net/`
- File endpoint: `https://storyteller4dghcj4shzqwa.file.core.windows.net/`
- Table endpoint: `https://storyteller4dghcj4shzqwa.table.core.windows.net/`

Observed blob containers:

```text
azure-webjobs-hosts
azure-webjobs-secrets
function-packages
```

Observed queue:

```text
writing-evaluations
```

The `writing_evaluation_worker` Function trigger uses this queue through `AzureWebJobsStorage`.

### Key Vault

- Name: `storyteller-kv-prod-4dgh`
- Type: `Microsoft.KeyVault/vaults`
- Location: `israelcentral`
- SKU: `standard`
- RBAC authorization: `false`
- Access policy model: enabled
- Public network access: `Enabled`
- Enabled for template deployment: `true`
- Soft-delete retention: `7` days
- Purge protection: not enabled in the queried properties

Observed access policies grant `get` and `list` secret permissions to:

- Function App managed identity principal `012448ec-869c-40cf-8adf-6593b5b4fd9f`
- Principal/object `c0d6e0ba-834f-4223-98cb-eed70b497cff`

Secrets are defined by the Bicep template for:

```text
database-url
jwt-secret
anthropic-api-key
google-oauth-client-secret
```

Do not retrieve secret values during routine inventory or troubleshooting. For Function App Key Vault reference issues, first verify the managed identity access policy and restart the Function App after policy changes.

### Application Insights

- Name: `storyteller-ai-prod-4dghcj4shzqwa`
- Type: `Microsoft.Insights/components`
- Kind: `web`
- Application type: `web`
- Location: `israelcentral`
- Provisioning state: `Succeeded`
- Retention: `90` days
- Public network access for ingestion: `Enabled`
- Public network access for query: `Enabled`
- Workspace resource ID: `/subscriptions/f93c22c4-86a5-4831-9b75-136506dcf5eb/resourceGroups/rg-storyteller-prod/providers/Microsoft.OperationalInsights/workspaces/storyteller-log-prod-4dghcj4shzqwa`

Use this for Function App request/dependency/failure diagnostics and smoke-test failures.

### Log Analytics Workspace

- Name: `storyteller-log-prod-4dghcj4shzqwa`
- Type: `Microsoft.OperationalInsights/workspaces`
- Location: `israelcentral`
- SKU: `PerGB2018`
- Retention: `30` days
- Provisioning state: `Succeeded`
- Public network access for ingestion: `Enabled`
- Public network access for query: `Enabled`

Application Insights is workspace-based and points at this workspace.

### Static Web App

- Name: `react-client`
- Type: `Microsoft.Web/staticSites`
- Location: `Central US`
- SKU: `Free`
- Provider: `GitHub`
- Branch: `main`
- Repository: `https://github.com/reubinoff/StoryTeller`
- Default hostname: `calm-field-0f498ee10.7.azurestaticapps.net`
- Custom domain: `storyteller.reubinoff.com`
- Staging environments: `Enabled`
- Config file updates: `true`
- Content distribution endpoint: `https://content-dm1.infrastructure.7.azurestaticapps.net`
- Private endpoint connections: none observed

The workflow file is `.github/workflows/azure-static-web-apps-calm-field-0f498ee10.yml`.

### Smart Detection Action Group

- Name: `Application Insights Smart Detection`
- Type: `microsoft.insights/actiongroups`
- Location: `Global`
- Enabled: `true`
- Group short name: `SmartDetect`
- ARM role receivers: `2`
- Email receivers: `0`
- Webhook receivers: `0`

This action group is used by the Application Insights smart detector alert rule.

### Smart Detector Alert Rule

- Name: `Failure Anomalies - storyteller-ai-prod-4dghcj4shzqwa`
- Type: `microsoft.alertsmanagement/smartDetectorAlertRules`
- Location: `global`
- State: `Enabled`
- Severity: `Sev3`
- Frequency: `PT1M`
- Detector: `Failure Anomalies`
- Scope: `storyteller-ai-prod-4dghcj4shzqwa`
- Action group: `Application Insights Smart Detection`

This rule detects abnormal rises in failed HTTP requests or dependency calls.

## Shared Azure Dependencies Outside `rg-storyteller-prod`

These resources are not owned solely by the StoryTeller app resource group, but production StoryTeller depends on them.

### PostgreSQL Flexible Server

- Resource group: `guide-me-infra`
- Name: `guide-me`
- Type: `Microsoft.DBforPostgreSQL/flexibleServers`
- Location: `Israel Central`
- FQDN: `guide-me.postgres.database.azure.com`
- Version: PostgreSQL `17`
- State: `Ready`
- SKU: `Standard_B1ms`, tier `Burstable`
- Storage: `32` GB, tier `P4`, autogrow disabled
- Backup retention: `7` days
- Geo-redundant backup: `Disabled`
- High availability: `Disabled`
- Public network access: `Disabled`
- Delegated subnet: `/subscriptions/f93c22c4-86a5-4831-9b75-136506dcf5eb/resourceGroups/guide-me-infra/providers/Microsoft.Network/virtualNetworks/guide-me-infra-vnet/subnets/default`
- Private DNS zone: `/subscriptions/f93c22c4-86a5-4831-9b75-136506dcf5eb/resourceGroups/guide-me-infra/providers/Microsoft.Network/privateDnsZones/guide-me.private.postgres.database.azure.com`

StoryTeller uses the `storyteller` database on this server. Do not point StoryTeller at the existing `guide-me` database because it has a separate migration history.

### Shared VNet

- Resource group: `guide-me-infra`
- Name: `guide-me-infra-vnet`
- Type: `Microsoft.Network/virtualNetworks`
- Location: `israelcentral`
- Address spaces:
  - `10.0.0.0/24`
  - `10.1.0.0/16`

Relevant subnets:

- `storyteller-functions`
  - Address prefix: `10.1.1.0/24`
  - Delegation: `Microsoft.App/environments`
  - Used by the production Function App VNet integration.
- `storyteller-migrations`
  - Address prefix: `10.1.3.0/24`
  - Delegation: `Microsoft.ContainerInstance/containerGroups`
  - Intended for one-off migration jobs that need private PostgreSQL access.
- `default`
  - Address prefix: `10.0.0.0/24`
  - Delegation: `Microsoft.DBforPostgreSQL/flexibleServers`
  - Used by the PostgreSQL Flexible Server.

### Private DNS

- Resource group: `guide-me-infra`
- Zone: `guide-me.private.postgres.database.azure.com`
- Type: `Microsoft.Network/privateDnsZones`
- VNet link observed: `guide-me.private.postgres.database.azure.com/hg7psgcwx2rju`

This supports private name resolution for the PostgreSQL Flexible Server.

## Deployment History Observed

Recent deployments in `rg-storyteller-prod`:

```text
Microsoft.Web-StaticApp-Portal-c1a10810-963d      Succeeded  Incremental  2026-06-12T15:54:30Z
storyteller-prod                                  Succeeded  Incremental  2026-06-12T15:09:16Z
Failure-Anomalies-Alert-Rule-Deployment-00839185  Succeeded  Incremental  2026-06-12T15:02:07Z
```

Backend infrastructure source: `backend-serverless/infra/main.bicep`.

Backend deployment workflow: `.github/workflows/backend-serverless-ci-cd.yml`.

Manual migration workflow: `.github/workflows/backend-serverless-migrations.yml`.

Frontend Static Web Apps workflow: `.github/workflows/azure-static-web-apps-calm-field-0f498ee10.yml`.

## Safe Refresh Commands

Use these for future read-only inventory refreshes:

```bash
/opt/homebrew/bin/az resource list --resource-group rg-storyteller-prod --query "[].{name:name,type:type,kind:kind,location:location,sku:sku.name,id:id}" --output table
```

```bash
/opt/homebrew/bin/az functionapp function list --resource-group rg-storyteller-prod --name storyteller-func-prod-4dghcj4shzqwa --query "[].{name:name,language:language,isDisabled:isDisabled}" --output table
```

```bash
/opt/homebrew/bin/az storage queue list --account-name storyteller4dghcj4shzqwa --auth-mode login --query "[].name" --output table
```

```bash
/opt/homebrew/bin/az deployment group list --resource-group rg-storyteller-prod --query "[].{name:name,state:properties.provisioningState,mode:properties.mode,timestamp:properties.timestamp}" --output table
```

Avoid commands that return secret values, including:

```bash
az keyvault secret show
az storage account keys list
az functionapp config appsettings list
```

If app setting names are needed, use a query that returns only names:

```bash
/opt/homebrew/bin/az functionapp config appsettings list --resource-group rg-storyteller-prod --name storyteller-func-prod-4dghcj4shzqwa --query "[].name" --output table
```
