# WorkSync

Task management for a small manufacturing/engineering company (5–20 users),
with Manager/Employee roles, cross-user task dependencies, and an
acceptance workflow. Built to the "Nocturne" dark-theme design system.

- **Frontend**: plain HTML + Tailwind CSS + vanilla JS (ES modules), no UI
  framework. Vite is the dev server/bundler only.
- **Auth + DB**: Supabase (Postgres + Row Level Security + Supabase Auth).
- **PWA**: installable manifest + service worker via `vite-plugin-pwa`.
- **Testing**: Vitest + jsdom + @testing-library/dom (unit/logic), Playwright
  (e2e), ESLint + `tsc --noEmit` (lint/typecheck).
- **CI/CD**: GitHub Actions (lint → typecheck → unit → e2e → build) on every
  push/PR; deploys to Vercel, backed by Supabase.

This project is being built in phases per the build brief; see
`CHANGELOG.md` for what's shipped and `TEST_REPORT.md` for test results per
phase. **Current status: Phase 0 (Foundation) complete.**

## Project layout

```
index.html              # single shell — <main id="app">, dialog mount point
src/
  main.js                 # entry: imports styles, starts the router
  router.js                # hash router (#/dashboard, #/team, #/admin, #/login)
  api.js                    # Supabase client
  state.js                   # small in-memory store + pub-sub
  components.js               # shared render helpers (e.g. escapeHtml)
  screens/                     # dashboard.js, team.js, admin.js, login.js
  dialogs/                      # newTaskDialog.js
  styles/
    tailwind-base.css            # @tailwind base
    nocturne.css                  # ported verbatim from design-reference/
    tailwind-components-utilities.css  # @tailwind components/utilities
scripts/
  seed.js                # demo user seeding (targets the Phase 1 schema)
supabase/                # schema.sql lands in Phase 1
design-reference/        # the Nocturne design system + prototype handoff
e2e/                      # Playwright specs
vite.config.js, tailwind.config.js, playwright.config.js, eslint.config.js, tsconfig.json
```

## Local development

```bash
npm install
cp .env.example .env      # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                # http://localhost:5173
```

## Checks

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit (checkJs via JSDoc)
npm test             # Vitest unit tests
npm run e2e           # Playwright e2e tests (starts the dev server itself)
npm run build           # production build (also generates the PWA manifest/SW)
```

Playwright note: this repo pins to whatever Chromium `npx playwright
install` fetches for the installed `@playwright/test` version. If you're on
a machine with a pre-installed Chromium at a different revision, set
`PLAYWRIGHT_CHROMIUM_PATH` to its executable before running `npm run e2e`.

## Design reference

`design-reference/` holds the original handoff: `Task Tracker.dc.html` (the
interactive prototype — open directly in a browser to click through it) and
`design-system/` (the bound Nocturne tokens/components: `styles.css`,
`readme.md`, `components/*.html`). These are reference material, not served
by the app — `src/styles/nocturne.css` is the ported, in-app copy.

## Deployment

Deployed on Vercel from this GitHub repo, backed by the same Supabase
project used by the app previously living in this repo (the earlier simple
scaffold is preserved on the `template/html-tailwind-supabase-vercel`
branch). Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
are set in the Vercel project settings, same as before.
