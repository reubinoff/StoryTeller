---
name: storyteller-logs
description: Read and summarize production StoryTeller Azure Function telemetry from Application Insights and Log Analytics using Azure CLI. Use in this project when the user asks to read logs, check Azure Function logs, inspect Application Insights, diagnose HTTP 4xx/5xx failures, investigate exceptions, debug production API behavior, troubleshoot health/login/task/evaluation issues, or generally asks for debugging related to the StoryTeller backend.
---

# StoryTeller Logs

## Overview

Use this skill to inspect StoryTeller production backend logs safely. The backend is a Python Azure Function App that sends telemetry to workspace-based Application Insights and Log Analytics.

Always treat this as production. Prefer narrow read-only queries, selected columns, short time ranges, and concise summaries.

## Required Context

Before running Azure commands:

- Read `.codex/instructions/azure-resources.md`.
- Use the project-local `$azure-cli` skill when available.
- Do not print app setting values, Key Vault secrets, storage keys, connection strings, bearer tokens, cookies, or raw request bodies.
- Use `/opt/homebrew/bin/az` if `az` is not on `PATH`.

Known production resources:

- Subscription: `Visual Studio Premium with MSDN`
- Subscription ID: `f93c22c4-86a5-4831-9b75-136506dcf5eb`
- Resource group: `rg-storyteller-prod`
- Function App: `storyteller-func-prod-4dghcj4shzqwa`
- Application Insights: `storyteller-ai-prod-4dghcj4shzqwa`
- Log Analytics workspace: `storyteller-log-prod-4dghcj4shzqwa`
- Workspace customer ID: `dca30966-4f3f-46c1-9d33-5b6ac8a28068`
- API host: `https://api.storyteller.reubinoff.com`

## Log Reading Workflow

Confirm CLI and account context first:

```bash
AZ="/opt/homebrew/bin/az"
command -v az >/dev/null 2>&1 && AZ="$(command -v az)"
"$AZ" account show --query "{name:name,id:id,tenantId:tenantId,user:user.name}" --output table
```

Verify the telemetry targets are reachable:

```bash
"$AZ" monitor log-analytics workspace show \
  --resource-group rg-storyteller-prod \
  --workspace-name storyteller-log-prod-4dghcj4shzqwa \
  --query "{name:name,customerId:customerId,location:location,retentionInDays:retentionInDays}" \
  --output table

"$AZ" monitor app-insights component show \
  --resource-group rg-storyteller-prod \
  --app storyteller-ai-prod-4dghcj4shzqwa \
  --query "{name:name,appId:appId,kind:kind,applicationType:applicationType}" \
  --output table
```

Start with a count by table over a short window. Replace `24h` with the relevant range:

```bash
"$AZ" monitor log-analytics query \
  -w dca30966-4f3f-46c1-9d33-5b6ac8a28068 \
  --analytics-query 'union isfuzzy=true AppTraces, AppRequests, AppExceptions
| where TimeGenerated > ago(24h)
| summarize Count=count() by Type
| order by Type asc' \
  --output table
```

Read recent traces:

```bash
"$AZ" monitor log-analytics query \
  -w dca30966-4f3f-46c1-9d33-5b6ac8a28068 \
  --analytics-query 'AppTraces
| where TimeGenerated > ago(24h)
| where AppRoleName == "storyteller-func-prod-4dghcj4shzqwa"
| order by TimeGenerated desc
| take 20
| project TimeGenerated, SeverityLevel, Message, OperationName, OperationId, AppRoleName' \
  --output table
```

Read recent exceptions:

```bash
"$AZ" monitor log-analytics query \
  -w dca30966-4f3f-46c1-9d33-5b6ac8a28068 \
  --analytics-query 'AppExceptions
| where TimeGenerated > ago(24h)
| where AppRoleName == "storyteller-func-prod-4dghcj4shzqwa"
| order by TimeGenerated desc
| take 10
| project TimeGenerated, Type, OuterMessage, ProblemId, OperationName, OperationId, AppRoleName' \
  --output table
```

Summarize request status codes:

```bash
"$AZ" monitor log-analytics query \
  -w dca30966-4f3f-46c1-9d33-5b6ac8a28068 \
  --analytics-query 'AppRequests
| where TimeGenerated > ago(24h)
| where AppRoleName == "storyteller-func-prod-4dghcj4shzqwa"
| summarize Count=count() by Success, ResultCode, Name
| order by Count desc' \
  --output table
```

List failed requests:

```bash
"$AZ" monitor log-analytics query \
  -w dca30966-4f3f-46c1-9d33-5b6ac8a28068 \
  --analytics-query 'AppRequests
| where TimeGenerated > ago(24h)
| where AppRoleName == "storyteller-func-prod-4dghcj4shzqwa"
| where Success == false or toint(ResultCode) >= 500
| order by TimeGenerated desc
| take 20
| project TimeGenerated, Name, ResultCode, Success, DurationMs, OperationName, OperationId, AppRoleName' \
  --output table
```

## Debugging Workflow

When the user asks for debugging or troubleshooting:

1. Identify the symptom, endpoint, user-visible time, and time zone if provided.
2. Convert relative user times to concrete UTC windows when querying logs.
3. Check `/healthz` if the issue might be service-wide:

```bash
curl -fsS https://api.storyteller.reubinoff.com/healthz
```

4. Query request counts, failures, exceptions, and traces for the relevant window.
5. If a failing request has an `OperationId`, correlate all telemetry for that operation:

```bash
"$AZ" monitor log-analytics query \
  -w dca30966-4f3f-46c1-9d33-5b6ac8a28068 \
  --analytics-query 'let op = "REPLACE_WITH_OPERATION_ID";
union isfuzzy=true AppRequests, AppTraces, AppExceptions, AppDependencies
| where OperationId == op
| order by TimeGenerated asc
| project TimeGenerated, Type, OperationName, Name, ResultCode, SeverityLevel, Message, OuterMessage, ProblemId, DurationMs, AppRoleName' \
  --output table
```

6. For active reproduction only, use a short log stream and stop it after collecting enough signal:

```bash
"$AZ" webapp log tail \
  --resource-group rg-storyteller-prod \
  --name storyteller-func-prod-4dghcj4shzqwa
```

Do not leave `log tail` running when ending the turn.

## Reporting

Report the subscription/resource group, time window, queried telemetry tables, counts, and the main finding. Use exact UTC timestamps from logs. Include only selected messages needed to explain the issue, and redact anything that looks like credentials, cookies, tokens, personal data, or raw user-submitted content.
