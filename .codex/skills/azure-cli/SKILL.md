---
name: azure-cli
description: Use Azure CLI (`az`) to inspect, create, update, delete, deploy, or troubleshoot Azure resources, subscriptions, resource groups, identities, apps, storage, networking, databases, containers, Kubernetes, logs, role assignments, and Azure DevOps-adjacent cloud workflows. Use when the user asks Codex to run Azure CLI commands, manage Azure infrastructure from a terminal, verify Azure account or subscription state, collect Azure diagnostics, or produce safe command sequences for Azure operations.
---

# Azure CLI

## Overview

Use this skill to operate Azure through the `az` CLI with explicit account context, careful read-before-write checks, and strong protection around production, billing, access, and destructive operations.

## Core Workflow

1. Establish local tool state:
   ```bash
   command -v az || test -x /opt/homebrew/bin/az
   AZ="/opt/homebrew/bin/az"; command -v az >/dev/null 2>&1 && AZ="$(command -v az)"
   "$AZ" version --output json
   ```
   In this StoryTeller project on macOS, Azure CLI may be available at `/opt/homebrew/bin/az` even when non-interactive shells cannot find plain `az`. If neither plain `az` nor `/opt/homebrew/bin/az` exists, tell the user and provide install steps for their OS instead of inventing a fallback.

2. Confirm authentication and account context before any Azure operation:
   ```bash
   "$AZ" account show --output json
   "$AZ" account list --output table
   ```
   If unauthenticated, ask the user to complete `az login` interactively or use an already-configured environment. Do not request secrets in chat.

3. Pin the intended subscription explicitly when more than one subscription exists or when the request names one:
   ```bash
   "$AZ" account set --subscription "<subscription-id-or-name>"
   "$AZ" account show --query "{name:name,id:id,tenantId:tenantId,user:user.name}" --output table
   ```
   Treat ambiguous subscription, tenant, or environment names as blockers for write operations.

4. Inspect existing state before changing it. Prefer narrow, resource-specific reads such as:
   ```bash
   az group show --name "<resource-group>" --output json
   az resource show --ids "<resource-id>" --output json
   az <service> <resource-type> show --name "<name>" --resource-group "<resource-group>" --output json
   ```

5. Use idempotent or previewable commands where available. Prefer `--only-show-errors`, `--output json`, and `--query` for machine-readable results; use `--output table` for user-facing summaries.

6. After writes, verify the resulting state with a separate `az ... show`, `az ... list`, log query, health check, or deployment status command.

## Safety Rules

- Do not run destructive, irreversible, billing-impacting, or access-changing commands without making the intended target explicit in the user-facing update first. This includes `delete`, `purge`, `deallocate`, role assignment changes, network exposure changes, key/secret changes, SKU changes, and production deployments.
- Do not use `--yes`, `--force`, or equivalent confirmation bypasses unless the target has already been verified and the user requested the operation clearly.
- Do not print secrets, connection strings, access keys, tokens, kubeconfigs, or full `.env` values. If a command returns secret material, summarize that it exists and suggest secure local storage.
- Do not persist credentials, tokens, or service principal secrets into repo files, shell history snippets, logs, or skill resources.
- For role assignments and identity changes, inspect the principal, scope, and existing assignments first:
  ```bash
  az role assignment list --assignee "<principal-id-or-upn>" --scope "<scope>" --output table
  ```
- For production-like resources, prefer a plan/what-if path before writes. For ARM/Bicep deployments use `az deployment group what-if`, `az deployment sub what-if`, or the matching deployment scope when practical.

## Command Patterns

Use resource IDs when names are ambiguous:
```bash
az resource list --name "<name>" --query "[].{name:name,type:type,group:resourceGroup,id:id}" --output table
```

Use JMESPath queries to keep output focused:
```bash
az vm list --query "[].{name:name,group:resourceGroup,location:location,powerState:powerState}" --show-details --output table
```

Use Azure CLI help and examples when command syntax is uncertain:
```bash
az <group> <command> --help
az find "<task description>"
```

Handle extensions deliberately:
```bash
az extension list --output table
az extension add --name "<extension-name>"
az extension update --name "<extension-name>"
```
Only install or update extensions when the command requires it.

## Troubleshooting

- For authentication errors, check `az account show`, tenant context, conditional access messages, and whether the operation needs `az login --tenant "<tenant-id>"`.
- For permission errors, identify the exact scope and action from the error, then inspect role assignments. Do not recommend broad roles like Owner unless no narrower role is suitable and the tradeoff is clear.
- For resource-not-found errors, verify subscription, resource group, region, spelling, and resource type.
- For deployment errors, read the deployment operations:
  ```bash
  az deployment group operation list --resource-group "<resource-group>" --name "<deployment-name>" --output table
  ```
- For service logs, prefer the service-native `az` log command when available; otherwise guide the user to Azure Monitor or Log Analytics queries.

## Reporting Back

When summarizing results, include the subscription name/id, resource group, target resource names, commands run at a high level, and verified outcome. Redact secrets and avoid dumping long JSON unless the user asks for raw output.
