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
- **CI/CD**: GitHub Actions (lint → typecheck → unit → e2e → build, plus a
  Lighthouse CI job) on every push/PR; deploys to Vercel, backed by
  Supabase — see `DEPLOYMENT.md` for environment separation and rollback.

This project is being built in phases per the build brief; see
`CHANGELOG.md` for what's shipped and `TEST_REPORT.md` for test results per
phase. **Current status: Phase 6 (Polish, Accessibility, PWA & Deployment Hardening) complete — the brief's production go-live gate.** See `DEPLOYMENT.md` for environment separation, secrets, and the rollback plan.

## Project layout

```
index.html              # single shell — <main id="app">, dialog mount point
src/
  main.js                 # entry: imports styles, starts the router
  router.js                # hash router (#/dashboard, #/team, #/admin, #/login) + auth guard
  api.js                    # Supabase client
  auth.js                    # session/profile helpers, signIn/signUp/signOutUser
  validation.js                # pure form-validation logic (signup/signin/new-task)
  demoMode.js                   # VITE_DEMO_MODE + ?demoRole= dev bypass
  state.js                       # small in-memory store + pub-sub
  pwaInstall.js                   # captures beforeinstallprompt/appinstalled, exposes promptInstall()
  tasks.js                        # task CRUD + dependency/acceptance data layer
  activity.js                      # activity_log data layer (logActivity, fetchTeamActivity)
  users.js                          # team membership queries (fetchTeamMembers)
  admin.js                           # User Admin data layer (fetchAdminUsers/Tasks, inviteUser, setUserStatus, softDeleteUser, overrideTask)
  adminFilter.js                      # pure search-filter logic for the User Management table
  projects.js                          # projects data layer (fetchProjects, createProject)
  dependencyFilter.js                   # pure search-filter logic for the dependency task picker
  dateUtils.js                           # pure date helpers (today, week range, calendar cells, relative time)
  taskStats.js                            # pure calculations (weekly progress, ...)
  teamStats.js                             # pure calculations (team pulse, blockers, today's focus)
  layout.js                                 # shared app shell (desktop sidebar / mobile top bar+tabs)
  components.js                              # shared render helpers (escapeHtml, renderIdentityBlock, renderTaskRow incl. Task Acceptance UI, renderActivityCard, renderMemberCard, renderListSkeleton/renderErrorState)
  screens/                                    # dashboard.js, team.js, admin.js, login.js — renderContent exported from each for direct async-state unit tests
  dialogs/                                     # newTaskDialog.js (full: Project/Priority/Assign To/Dependencies), addUserDialog.js
  styles/
    tailwind-base.css                            # @tailwind base
    nocturne.css                                  # ported verbatim from design-reference/ (+ .wsswitch, see CHANGELOG)
    tailwind-components-utilities.css              # @tailwind components/utilities
scripts/
  seed.js                 # demo user seeding (Sarah Jenkins/manager, David Chen + Marcus Cole/employees)
  test-rls-users.mjs       # RLS integration tests for the users table
  test-rls-tasks.mjs        # RLS integration tests for the tasks table
  test-rls-team.mjs          # RLS integration tests for team scoping (activity_log, team tasks/profiles)
  test-rls-admin.mjs          # RPC integration tests for the Phase 4 admin functions
  test-rls-dependencies.mjs    # RLS/RPC integration tests for Phase 5 dependencies & acceptance
supabase/
  schema.sql               # users + tasks/projects + activity_log tables, RLS policies, team_root()/team_member_ids(), admin RPCs, Phase 5 dependency/acceptance triggers + RPCs
  functions/
    admin-invite-user/       # Edge Function: real Auth invite for "Add User" (needs `supabase functions deploy`)
design-reference/        # the Nocturne design system + prototype handoff
e2e/                      # Playwright specs
.lighthouserc.json       # Lighthouse CI thresholds (performance/accessibility ≥ 90) — see CHANGELOG for why "PWA" isn't a scoreable category anymore
DEPLOYMENT.md            # environments, secrets inventory, rollback plan
vite.config.js, tailwind.config.js, playwright.config.js, eslint.config.js, tsconfig.json
```

## Local development

```bash
npm install
cp .env.example .env      # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
```

Before first run, apply `supabase/schema.sql` in your Supabase project's SQL editor (it's additive/idempotent — safe to re-run on top of an earlier phase's version, it'll just add what's new, e.g. Phase 5's dependency/acceptance triggers and RPCs), and disable **Authentication → Providers → Email → Confirm email** (see `supabase/README.md` for why). For "Add User" to work, also deploy the Edge Function once: `supabase functions deploy admin-invite-user` (see `supabase/README.md`).

```bash
npm run dev                # http://localhost:5173
```

To bypass real auth for local UI work, set `VITE_DEMO_MODE=true` in `.env`
and visit e.g. `http://localhost:5173/?demoRole=manager#/dashboard` —
`?demoRole=manager` or `?demoRole=employee` signs you in as a hardcoded
seeded user without touching Supabase. Never enabled in a real deployment
unless you explicitly set that env var there.

## Checks

```bash
npm run lint              # ESLint
npm run typecheck         # tsc --noEmit (checkJs via JSDoc)
npm test                   # Vitest unit tests
npm run e2e                 # Playwright e2e tests (starts the dev server itself)
npm run build                 # production build (also generates the PWA manifest/SW)
npm run test:integration        # RLS integration tests — needs SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY
npm run lighthouse               # Lighthouse CI against a demo-mode build (build with VITE_DEMO_MODE=true first — see .github/workflows/ci.yml's lighthouse job)
```

Playwright note: this repo pins to whatever Chromium `npx playwright
install` fetches for the installed `@playwright/test` version. If you're on
a machine with a pre-installed Chromium at a different revision, set
`PLAYWRIGHT_CHROMIUM_PATH` to its executable before running `npm run e2e`.

Lighthouse note: needs a real Chrome/Chromium on the machine running it —
GitHub Actions' `ubuntu-latest` runner has one preinstalled, but locally
(or in a container without one) set `CHROME_PATH` to an existing
executable first. Running as root also needs `--no-sandbox`, already set
in `.lighthouserc.json`'s `chromeFlags`.

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
