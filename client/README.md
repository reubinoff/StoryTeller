# Storyteller — Frontend

A fully-clickable single-page implementation of **Storyteller**, the gamified
English-learning web app described in `English for fun PRD.pdf`. Every screen
from the design hand-off (Landing, Auth, Onboarding, Dashboard, Courses,
Course detail, Reading task, Writing task, Writing processing, Reading result,
Writing result, Settings, Achievements, Help & FAQ) is implemented with a
typed `fetch` API client backed by a localStorage-driven mock layer, so the

## Stack

- **React Router 7** (SPA mode with prerendered `/` and `/help` pages)
- **React 19** + **TypeScript 5.9**
- **Tailwind CSS 4** — utility resets only; the design's full token system /
  atoms (`btn-*`, `card`, `chip-*`, `field-*`, `app-shell`, …) lives verbatim
  in [`app/app.css`](app/app.css)
- **TanStack Query** for server state, **react-hook-form + zod** for forms
- **No backend dependency in dev** — see "Mock backend" below

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run typecheck    # react-router typegen + tsc
npm run build        # prerender public pages + client bundles
npm run start        # serve the production build
```

Production builds require a canonical public URL so prerendered metadata,
`robots.txt`, `sitemap.xml`, and `llms.txt` all agree:

```bash
VITE_PUBLIC_SITE_URL=https://www.example.com npm run build
```

The Azure Static Web Apps workflow uses the default Azure hostname when
`VITE_PUBLIC_SITE_URL` is not set. Set the variable when switching to a custom
domain.

## Mock backend

The default dev experience runs a localStorage-backed mock backend so the app
is fully clickable without a server. To point at a real `/api/v1` instead:

```bash
# .env.local
VITE_PUBLIC_SITE_URL=https://www.example.com
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://api.storyteller.app/api/v1
```

The mock is implemented in [`app/lib/api/mock/`](app/lib/api/mock/):

- `db.ts` — typed in-memory store, persisted to localStorage. Seed content
  (Saturn rings reading passage, Kyoto writing prompt, sample evaluation,
  achievement set) is taken verbatim from the design's `data.jsx`.
- `router.ts` — pattern-matches `${method} ${path}` against handlers, sleeps
  ~300 ms to feel real, and returns either `{ kind: 'ok', data }` or an RFC
  7807 `{ kind: 'error', problem }`.
- `handlers/{auth,me,catalog,tasks}.ts` — one file per resource; covers the
  full lifecycle from sign-up → onboarding → dashboard → roll task → submit →
  (writing) processing 8s → completed + toast.

To wipe the mock and start fresh, run this in DevTools console:

```js
localStorage.clear();
location.reload();
```

## Project layout

```
app/
├── app.css                       # Storyteller tokens + atoms + responsive
├── root.tsx                      # Document layout, Nunito / Fraunces
├── routes.ts                     # Route map (public + _authed layout)
├── routes/
│   ├── landing.tsx               # /
│   ├── signup.tsx · login.tsx    # zod + react-hook-form
│   ├── onboarding.tsx            # 3-step wizard
│   ├── _authed.tsx               # Protected layout (Shell + ToastHost)
│   ├── dashboard.tsx
│   ├── courses.tsx · course-detail.tsx
│   ├── task.tsx                  # Reading + Writing + Processing branches
│   ├── task-result.tsx           # Reading + Writing result
│   ├── achievements.tsx · settings.tsx · help.tsx
├── components/
│   ├── Shell.tsx                 # Sidebar + Topbar + Mobile tabbar
│   ├── Mascot.tsx                # Brand assets, hafuyfay mascot, feature icons
│   ├── Icons.tsx                 # 30+ stroke icons (port of icons.jsx)
│   ├── AuthFrame.tsx · CourseCards.tsx · Settings.tsx
│   ├── BackBar.tsx · Modal.tsx · Toast.tsx · Toggle.tsx · Skeleton.tsx
│   └── StatusPill.tsx · SectionHeader.tsx
└── lib/
    ├── auth.tsx                  # AuthProvider + display-pref body attrs
    ├── providers.tsx             # QueryClient + AuthProvider + ToastProvider
    ├── topics.ts                 # 15-topic catalog
    └── api/
        ├── client.ts             # fetch wrapper, ApiError, token helpers
        ├── endpoints.ts          # Strongly-typed API surface
        ├── queries.ts            # TanStack Query hooks
        ├── types.ts              # Wire types (snake_case)
        └── mock/                 # localStorage-backed mock backend
```

## API contract

The full backend contract — every endpoint, request/response shape, error
codes, state machine, and TypeScript data models — is documented in
[`API_CONTRACT.md`](API_CONTRACT.md). The frontend ships against that
contract; setting `VITE_USE_MOCK=false` is enough to swap to a real backend
that conforms to it.

## Key flows implemented end-to-end

1. **Sign-up** (with password strength meter) → **Onboarding** (3 steps:
   welcome, grade selector, 15-topic interest grid with 6 max).
2. **Dashboard** with hero, 4 metric cards, "Continue where you left off",
   recent tasks table, recommended course cards, achievements preview.
3. **Reading task**: passage view with TTS (`speechSynthesis`) and font-size
   stepper → one-question-at-a-time flow (multiple choice / true-false /
   fill-in-the-blank) → result page with celebration on ≥ 80%, full
   question-by-question breakdown.
4. **Writing task**: topic + textarea with word counter, 10-second auto-save,
   confirm-submit modal, 8-second processing screen with animated mascot, and
   a result page with circular score ring, four sub-scores, and an annotated
   answer (red grammar / amber word-choice / blue suggestion underlines).
5. **Settings** with theme / text-size / reduce-motion controls that apply
   live via `data-*` attributes on `<body>` (see `lib/auth.tsx`).
6. **Async writing notifications** — the mock backend dispatches a
   `storyteller:task-completed` event 8 s after submit; the `_authed` layout listens
   and pushes a toast with a "View result" CTA (PRD §7.3).

## Accessibility & responsive

- WCAG 2.1 AA contrast on all body copy.
- Keyboard navigable, visible focus rings (2 px teal).
- `prefers-reduced-motion` and a "Reduce motion" Settings toggle.
- TTS for reading passages.
- Sidebar collapses below 900 px; mobile bottom-tab bar with center "roll a
  task" shortcut, 44 × 44 px tap targets.
- Min widths tested: 320 px, 375 px (PRD §11), 768 px, 1280 px.

## Deployment

This app deploys to Azure Static Web Apps from `build/client`. React Router
prerenders the public search pages and emits `__spa-fallback.html` for private
app routes.
