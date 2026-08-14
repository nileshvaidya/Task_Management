# Test Report

## Phase 1 — Auth, Users & Roles

Run locally: `npm run lint && npm run typecheck && npm test && npm run e2e && npm run build`. Integration tests: `npm run test:integration` (needs `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`).

| # | Test case (from build brief §Phase 1) | Result | Notes |
|---|---|---|---|
| 1 | New user can sign up and is required to pick a role; reject signup with no role selected | ✅ | Unit: `validateSignupForm` rejects empty/unrecognized role (`src/validation.test.js`). E2E: signup form submission with no role shows the error banner and never calls `auth/v1/signup` (`e2e/phase1.spec.js`). |
| 2 | Manager signup doesn't require a manager; employee signup requires selecting an existing manager | ✅ | Unit: `validateSignupForm` (manager without managerId passes; employee without managerId fails). E2E: "reports to" field hidden for manager, shown+required for employee. DB: `users_role_manager_pairing` CHECK constraint enforces the same rule server-side. |
| 3 | Employee's `manager_id` persisted and visible to their manager; manager cannot see other managers' reports | ⏳ **Written, pending live run** | `scripts/test-rls-users.mjs` — creates 2 managers + 2 employees via service role, asserts manager A sees employee A via `manager_id` query, sees nothing for `manager_id`=manager B, and cannot fetch employee B directly. Wired into CI (`integration` job) but only executes once `SUPABASE_SERVICE_ROLE_KEY` is added as a repo secret — not yet added as of this PR. |
| 4 | Logged-in employee cannot query/mutate another manager's team data | ⏳ **Written, pending live run** | Same script: employee A's query for manager B's team returns nothing, cannot fetch employee B directly, and an attempted `.update()` on employee B does not change their row (verified via the service-role client after the attempt). |
| 5 | Sidebar identity block renders correct name/email/initials | ✅ | Unit: `renderIdentityBlock`/`initials` (`src/components.test.js`, 6 tests, via `@testing-library/dom` queries). E2E: via demo mode, asserts the rendered name/email text on the dashboard. |
| 6 | Inactive users cannot log in / shown a "contact admin" message | ✅ | Unit: `signIn` signs out and returns `code: 'inactive_user'` for an inactive profile (`src/auth.test.js`). E2E: mocked Supabase responses (real sign-in code path, fake network layer) confirm the UI shows the message and never reaches the dashboard. |

### Additional Phase 1 coverage

| Module | Tests | Result |
|---|---|---|
| `src/validation.js` | 9 | ✅ |
| `src/demoMode.js` | 5 | ✅ |
| `src/auth.js` | 14 | ✅ |
| Router auth guard (new cases) | 5 | ✅ |
| `renderIdentityBlock`/`initials` (new cases) | 6 | ✅ |
| `e2e/phase0.spec.js` (updated for the new auth guard + login form) | 3 | ✅ |
| `e2e/phase1.spec.js` | 5 | ✅ |

**Totals**: 53/53 Vitest unit tests passing · 8/8 Playwright e2e tests passing (3 Phase 0 regression + 5 Phase 1) · lint clean · typecheck clean · production build succeeds. RLS integration tests (2 test cases, 8 assertions) written and CI-wired but **not yet executed against a live project** — see "Known items" below.

### Bugs found and fixed during verification

1. **Real JS syntax error, not caught by lint/typecheck.** An HTML comment inside `login.js`'s template literal used backticks around the word `required` (`` `required` ``). Backticks inside a template literal are unescaped string terminators — this closed the literal early and threw `Unexpected identifier 'required'` at runtime, silently breaking the entire login screen. Neither ESLint nor `tsc` catches this (both parse the file as a whole; the syntax error only manifests when the module actually executes). Found by loading the built app in a real browser and reading `pageerror` events — the same category of "test the actual thing" verification that caught the Phase 0 `@import` ordering bug.
2. **Blocking network call on first paint.** `login.js` originally awaited `fetchActiveManagers()` before rendering anything. Against an unreachable/misconfigured Supabase URL, this call can hang rather than fail fast (observed directly: Chromium without an explicit proxy silently drops connections to unresolvable hosts in this sandbox, rather than rejecting them, so the fetch never resolves). Fixed by rendering the form shell synchronously first and populating the manager picker in the background afterward, with a `.catch()` so a failed fetch never surfaces as an error — the sign-in/sign-up forms now work regardless of that specific call's outcome.

### Known items carried forward (not blockers for Phase 1 sign-off)

- **RLS integration tests are unrun.** `scripts/test-rls-users.mjs` is written, typechecked, and wired into CI, but needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` added as GitHub Actions repo secrets to actually execute (per your choice in this phase's kickoff). Until then, CI's `integration` job logs a warning and skips rather than silently passing.
- Carried from Phase 0: `npm audit` dev-tooling advisories (esbuild/vite), deferred pending a Vite major-version bump.
- `supabase/schema.sql` must be run against the live project, and "Confirm email" must be disabled in Supabase Auth settings, before sign-up works end-to-end on the deployed app (documented in `supabase/README.md`).

## Phase 0 — Foundation

Run locally: `npm run lint && npm run typecheck && npm test && npm run e2e && npm run build`.

| # | Test case (from build brief §Phase 0) | Result | Notes |
|---|---|---|---|
| 1 | CI pipeline runs green on an empty commit (lint, typecheck, build all pass) | ✅ | Verified locally: `npm run lint`, `npm run typecheck`, `npm run build` all exit 0. `.github/workflows/ci.yml` runs the same steps plus unit/e2e. |
| 2 | Smoke test (Playwright): app loads, shows login screen, Nocturne background/accent colors present (computed CSS values on `<body>` and a sample `.btn`) | ✅ | `e2e/phase0.spec.js` — asserts `document.body` background is `rgb(22, 24, 38)` (`--color-bg #161826`) and `.btn-primary` color is `rgb(145, 132, 217)` (`--color-accent #9184d9`), both against the real built app in a real Chromium browser. |
| 3 | Unit test (Vitest): Supabase client initializes with env vars; fails gracefully with a readable error if env vars are missing | ✅ | `src/api.test.js`, 3 tests — missing both vars, missing one var, and successful init all covered. |
| 4 | Unit test: hash-router correctly mounts the right screen module for `#/dashboard`, `#/team`, `#/admin` | ✅ | `src/router.test.js`, 6 tests — also covers `normalizePath` fallback behavior for empty/unknown hashes. |

### Additional Phase 0 coverage (not explicitly listed in the brief, added for foundation modules)

| Module | Tests | Result |
|---|---|---|
| `src/state.js` (store/pub-sub) | 4 | ✅ |
| `src/components.js` (`escapeHtml`) | 4 | ✅ |
| `e2e/phase0.spec.js` — router mounts dashboard/team/admin screens directly by hash | 1 | ✅ |
| `e2e/phase0.spec.js` — unrecognized hash falls back to login | 1 | ✅ |

**Totals**: 17/17 Vitest unit tests passing · 3/3 Playwright e2e tests passing · lint clean · typecheck clean · production build succeeds (`npm run build`, PWA manifest + service worker generated).

### Issue found and fixed during verification

Initial `src/styles/main.css` used `@tailwind base;` followed by `@import './nocturne.css';` in the same file. CSS spec requires `@import` to precede all other rules; once Tailwind's `@tailwind base` expanded to real CSS ahead of it, the import became invalid and Vite/PostCSS warned it would be dropped in a real browser — meaning the whole Nocturne design system would silently fail to load. Fixed by splitting into three JS-imported files in `src/main.js` (`tailwind-base.css` → `nocturne.css` → `tailwind-components-utilities.css`), which Vite/Rollup concatenate in import order. Verified post-fix: the built CSS contains the Nocturne tokens/components with no import-order warning, and the e2e test's computed-style assertions confirm the tokens actually apply in a real browser.

### Known items carried forward (not blockers for Phase 0 sign-off)

- `npm audit` reports vulnerabilities in `esbuild`/`vite` dev-server tooling (dev-only request-forgery class issue, not present in the built output). Fixing requires a breaking Vite 6→8 major bump; deferred rather than done reactively mid-phase.
- `scripts/seed.js` targets the Phase 1 `users` table schema and is not yet runnable — expected until Phase 1 lands.
