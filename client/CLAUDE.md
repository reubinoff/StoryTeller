# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:5174
npm run build        # Production SSR + client bundles
npm run start        # Serve production build
npm run typecheck    # Regenerate React Router types + run tsc
npm test             # Run tests in watch mode (Vitest)
npm run test:run     # Run tests once (CI)
```

Run a single test file: `npx vitest run app/routes/__tests__/login.test.tsx`

No lint command is configured.

## Environment

Create `.env.local` for the local backend:

```
VITE_PUBLIC_SITE_URL=http://localhost:5174 # canonical URL for SEO assets
VITE_API_BASE_URL=http://localhost:7071/api/v1
```

Start the backend Function App at `http://localhost:7071/api/v1` before running the frontend dev server.

## Architecture

**React Router 7 SPA with prerendered public pages** (`ssr: false` with `/` and `/help` in `react-router.config.ts`). TypeScript strict mode. Path alias `~` → `app/`.

### Layers

| Layer | Location | Role |
|-------|----------|------|
| Routes | `app/routes/` | Pages; loader/action via React Router |
| Components | `app/components/` | Shared UI primitives |
| Auth | `app/lib/auth.tsx` | `AuthContext` — user, metrics, auth actions, display prefs |
| API | `app/lib/api/` | Typed client, TanStack Query hooks, mock backend |
| Design system | `app/app.css` | CSS variables, utility atoms (`btn-*`, `card`, `chip-*`, `field-*`, `app-shell`) |

### API / Transport

`app/lib/api/client.ts` exposes the typed API transport used by the app. Real endpoints are documented in `API_CONTRACT.md`, and local development should set `VITE_API_BASE_URL=http://localhost:7071/api/v1`.

- **`endpoints.ts`** — strongly-typed API methods (auth, me, catalog, tasks)
- **`queries.ts`** — TanStack Query hooks (`useMe`, `useInterests`, `useTask`, etc.)
- **`types.ts`** — wire types (snake_case) matching the API contract

### Mock Implementation

`app/lib/api/mock/` is a complete in-memory backend:
- `db.ts` — typed store + localStorage persistence
- `router.ts` — pattern matcher `${method} ${path}` → handlers
- `handlers/` — auth, catalog, me, tasks

### Auth & Protected Routes

`AuthContext` stores user + metrics; tokens in localStorage. `app/routes/_authed.tsx` is the protected layout (auth guard + toast event listener). Display preferences (theme, text-size, reduce-motion) are applied to `<body>` dataset attributes in a `useEffect`.

### Async Task Completion

Writing tasks have an 8-second processing phase. The mock backend dispatches a custom `storyteller:task-completed` event; `_authed.tsx` listens and fires a toast with a "View result" CTA.

### Shell & Responsive Layout

`app/components/Shell.tsx` — sidebar collapses below 900px; mobile bottom tab bar uses 44×44px tap targets.

### Design Tokens

Full token system in CSS variables: `--ink`, `--teal`, `--rust`, `--radius-*`, `--shadow-*`, `--font-*`. Theme variants (`playful`, `clean`) and palette swaps (`berry`, `forest`, `indigo`) are toggled via `<body>` dataset.
