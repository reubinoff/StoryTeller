# StoryTeller Codex Instructions

## Azure

- For Azure CLI work in this project, first read `.codex/instructions/azure-resources.md`.
- Use the project-local `$azure-cli` skill when available.
- In Codex non-interactive shells, plain `az` may not be on `PATH`; use `/opt/homebrew/bin/az` when `command -v az` returns nothing.
- Treat Azure operations as production by default. Confirm subscription/resource group context before writes, and do not print secrets, storage keys, connection strings, tokens, or app setting values.
