# Client — Codex Instructions

React Router 7 SPA with prerendered public pages. Overrides repo-root guidance for this package.

## Commands

```bash
npm install
npm run dev          # http://localhost:5174
npm run typecheck    # react-router typegen + tsc
npm run build
npm run test:run     # Vitest once (CI)
npm test             # Vitest watch
```

Single file: `npx vitest run app/routes/__tests__/login.test.tsx`

No lint script is configured.

## Environment (`.env.local`)

```
VITE_PUBLIC_SITE_URL=http://localhost:5174
VITE_API_BASE_URL=http://localhost:7071/api/v1
```

Start the backend Function App before running the frontend dev server.

## Layout

| Layer | Path | Role |
|-------|------|------|
| Routes | `app/routes/` | Pages; `_authed.tsx` is the protected layout |
| Components | `app/components/` | Shell, Modal, design primitives |
| Auth | `app/lib/auth.tsx` | AuthContext, display prefs on `<body>` |
| API | `app/lib/api/` | client, endpoints, queries, types |
| Styles | `app/app.css` | Tokens + atoms (`btn-*`, `card`, `chip-*`, …) |

Path alias: `~` → `app/`.

## Conventions

- TypeScript strict; wire types in `types.ts` use snake_case per `API_CONTRACT.md`.
- TanStack Query hooks live in `app/lib/api/queries.ts`.
- Reuse existing CSS atoms; do not invent parallel styling systems.
- Responsive: sidebar collapses below 900px; mobile tab bar uses 44×44px targets.
- **UI tasks:** verify mobile and desktop widths before finishing.

## API contract

`API_CONTRACT.md` in this directory is the source of truth. Coordinate with `backend-serverless/` when changing request/response shapes.

## Tests

- Vitest + Testing Library; tests live beside routes in `app/routes/__tests__/`.
- CI uses `NODE_OPTIONS=--localstorage-file=...` — see root `backend-serverless/README.md` for the full verification command.
