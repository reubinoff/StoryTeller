# Admin Client — Codex Instructions

Separate React/Vite admin console for StoryTeller. This app is hosted as its
own Azure Static Web App and talks to the existing backend at `/api/v1`.

## Commands

```bash
npm install
npm run dev          # http://localhost:5175
npm run typecheck
npm run test:run
npm run build
```

## Security

- Admin authorization is enforced only by backend `/api/v1/admin/*` role checks.
- Never add secrets, storage keys, connection strings, tokens, or app-setting
  dumps to the UI or repository.
- Keep all admin API requests cookie-based with `credentials: "include"` and
  CSRF headers on unsafe methods.
- Treat admin responses as non-cacheable and avoid local persistence of admin
  data.

## UX

- This is an operational tool, not a landing page.
- Optimize for dense scanning, clear risk states, responsive mobile layouts, and
  fast user-management workflows.
- Any auth, user, role/status, metrics, task/content model, CORS, cookie, or
  deployment change must consider this console.
