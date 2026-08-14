# Changelog

## Phase 3 — Team Feed & Team Overview

- `activity_log` table + RLS (`supabase/schema.sql`): logs `created`/`status_changed` events (`accepted`/`blocked`/`unblocked` reserved for Phase 5). New `team_root(uid)` and `team_member_ids(uid)` `security definer` SQL functions define "team" (a manager + their direct reports) once, shared by the `activity_log`, `tasks`, and `users` team-scoping policies below.
- New SELECT-only RLS policies: "Team can view team tasks" (`tasks`) and "Team can view teammate profiles" (`users`) — let a teammate (not just a manager) view, but never modify, the rest of their team's tasks/profiles, needed for Team Overview to work for an employee viewer, not only a manager.
- `src/activity.js` (new): `logActivity()`/`fetchTeamActivity()`. Wired into `src/tasks.js` — `createTask` now logs a `created` entry, `setTaskStatus`/`toggleTaskDone` log a `status_changed` entry when given the acting user's id (both `dashboard.js` call sites updated).
- `src/teamStats.js` (new): `computeTeamPulse`/`computeBlockers`/`computeTodaysFocus` — pure calculations over a team's task list, unit-tested against fixture data.
- `src/users.js` (new): `fetchTeamMembers()` — team-scoped user profiles via the `team_member_ids` RPC, not a bare `select *` (see "Bugs found" in `TEST_REPORT.md` for why that distinction matters).
- `src/tasks.js`: `fetchAllTeamTasks()` — every task owned by anyone on the caller's team (self + manager + siblings), for Team Overview's aggregate cards; distinct from the existing manager-only `fetchTeamTasks` (Dashboard's "My Team" filter).
- Full Team screen (`src/screens/team.js`): Activity Feed tab (team activity, newest first) and Team Overview tab (Team Pulse card, Blockers & Alerts card, per-member Today's Focus cards), tab switch via the existing `.seg` radio pattern — plain JS show/hide, no framework routing within the screen.
- `renderActivityCard`/`renderMemberCard` (`components.js`, new): Nocturne-styled render helpers, unit-tested in isolation via `@testing-library/dom`, matching `renderTaskRow`'s existing pattern.
- `formatRelativeTime` (`dateUtils.js`, new): "just now" / "12m ago" / "3h ago" / calendar-date fallback for the Activity Feed's timestamps.
- `scripts/test-rls-team.mjs` (new): RLS integration tests for the team-scoping policies above (two full teams, symmetric manager/employee visibility, cross-team negative cases), added to `npm run test:integration` alongside the Phase 1/2 scripts.
- Vitest coverage: `teamStats` (7), `activity.js` (5), `users.js` (3), `tasks.js` (6 new), `renderActivityCard`/`renderMemberCard` (8 new), `formatRelativeTime` (5 new) — 123/123 total.
- Playwright coverage: Activity Feed renders team activity with no console errors, empty-state fallback, Team Overview's three cards render from fixture data, and creating a task posts both the task insert and its `activity_log` entry.

### Assumptions

- Left the design reference's "Sprint Progress" sidebar out of the Activity Feed tab — Phase 3's own build/test-case list doesn't call for it, and the data model has no "sprint" concept to map it onto (only flat `projects`). See `TEST_REPORT.md` for the full reasoning.
- "Team" = a manager plus their direct reports, symmetric for whichever member is looking — the natural reading of the brief given the current flat manager→report hierarchy (no manager-of-managers yet).

### Bugs found and fixed during verification

1. **A copy-pasted RLS pattern would have silently broken Team Overview for employees.** A naive "team tasks" policy modeled on Phase 2's manager-only policy relies on a nested `users` subquery that runs under the *querying* user's own RLS — which Phase 1 never granted employees visibility into siblings' rows through, so an employee's version of the same query would return nothing. Fixed by computing team membership through a `security definer` function (`team_member_ids()`) instead. Caught during schema design, before it could reach a live project — see `TEST_REPORT.md` for the full account and how `scripts/test-rls-team.mjs` verifies both a manager and an employee caller get the same team-scoped result.
2. **A related trap**: even with that function in place, an unfiltered `select * from users` for "my team" would still leak every other manager company-wide, because Phase 1's "public can view active managers" policy (needed for the sign-up picker) is a separate, broader grant that ORs together with any new policy. `fetchTeamMembers`/`fetchAllTeamTasks` explicitly filter by the `team_member_ids` RPC result rather than trusting "whatever RLS lets through."
3. **Playwright mock shape mismatch during e2e authoring** (test bug, not an app bug): mocking `.select().single()` responses as `[{...}]` instead of a bare `{...}` object silently nulled out a field client-side. Fixed to match the object-shape convention already used by the Phase 2 e2e mocks.

## Deployment fix (post-Phase-2, found in production)

After merging Phase 2, the live app returned `404: NOT_FOUND` on every route, then (once that was fixed) `Supabase is not configured` on sign-up. Neither was catchable from CI/local — both only manifest against the real Vercel project's dashboard state.

1. **`404: NOT_FOUND` on every route.** This Vercel project was originally set up for the pre-WorkSync scaffold, which built to `public/` via a `vercel.json` removed in Phase 0 once the app became Vite-based (Vite builds to `dist/`) — flagged as an open item in the Phase 0 PR but never confirmed fixed. The dashboard's build/output settings apparently still carried that old override. Fixed by adding an explicit `vercel.json` pinning `buildCommand`/`outputDirectory`, which takes precedence over dashboard settings regardless of what's saved there.
2. **`Supabase is not configured` on sign-up.** The Vercel project had `SUPABASE_URL`/`SUPABASE_ANON_KEY` configured (the names used by the trusted Node-only scripts and CI secrets) but not the `VITE_`-prefixed versions the actual client build reads — Vite only exposes `VITE_`-prefixed env vars to the browser bundle. Fixed by adding `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` as their own separate variables in the Vercel project, scoped to Production and Preview.

Both confirmed fixed by testing sign-up and task creation on a fresh deployment after the fixes.

## Phase 2 — Task CRUD & Dashboard

- `tasks` (+ `projects`) tables + RLS (`supabase/schema.sql`): owner full CRUD on their own tasks; manager can view/update (not delete) their direct reports' tasks — the Dashboard's "My Team" filter. Full data-model contract (dependency/acceptance columns) created now so the shape is stable for Phase 5, but only owner/manager CRUD is wired up yet.
- Shared app shell (`src/layout.js`): desktop sidebar / mobile top bar + bottom tabs, both in the same DOM tree, switched purely by Tailwind responsive classes (`hidden md:flex` / `md:hidden`) — no JS device-state branching, per the brief. Wired into dashboard/team/admin so nav + identity are consistent everywhere.
- Full Dashboard screen (`src/screens/dashboard.js`): Plan Today quick-add, Active Tasks (All/Pending filter, round completion toggle, status select, blocked line), Weekly Progress card (real completed/total for the current week), Advance Planning mini calendar (real month navigation, today highlighted), and a My Team / Mine toggle for managers.
- Real New Task dialog (`src/dialogs/newTaskDialog.js`): title/description/date, always self-owned in this phase (Project/Priority/Assign To/Dependencies are Phase 5's "full New Task dialog"). Rejects a past date or empty title via `validateNewTaskForm`.
- `src/tasks.js`: `fetchMyTasks`/`fetchTeamTasks`/`createTask`/`setTaskStatus`/`toggleTaskDone` — completing a task always clears `blocked`/`blocked_reason`.
- `src/dateUtils.js` / `src/taskStats.js`: pure date and weekly-progress-calculation helpers, unit-tested directly.
- `scripts/test-rls-tasks.mjs`: RLS integration tests for the `tasks` table (owner CRUD, manager sees/updates but can't delete reports' tasks, cross-team access blocked both ways), added to `npm run test:integration` alongside the Phase 1 users script.
- Vitest coverage: `dateUtils` (11), `taskStats`/weekly progress (3), `tasks.js` with a mocked client (10), `renderTaskRow` (7 new), `validateNewTaskForm` (5 new) — 89/89 total.
- Playwright coverage: Dashboard smoke test (all four cards render, no console errors), manager-only My Team filter, real-CSS-breakpoint responsive layout (mobile bottom tabs vs desktop sidebar), New Task dialog validation (past date, empty title) and cancel.

### Bugs found and fixed during verification

1. **The exact same backtick-in-template-literal mistake as Phase 1, reintroduced.** A code comment inside `newTaskDialog.js`'s template literal used backticks around the word `min`, terminating the string early and throwing a real syntax error that silently broke the New Task dialog (and, transitively, the whole Dashboard, since the dialog module is imported by the shell). Caught the same way as before — loading the actual page in a browser and reading `pageerror` events, not by lint/typecheck. Grepped the full `src/` tree afterward for every other backtick to confirm no other instance of this pattern existed.
2. **Native HTML5 constraint validation silently swallowed form submission.** The New Task dialog's date input has a `min` attribute (today); setting it to a past value via any path other than the native picker leaves the field in a browser-invalid state, and clicking submit never even fires the `submit` event — no custom error, no native message either, just nothing. Fixed by adding `novalidate` to the form so the app's own `validateNewTaskForm` always runs and shows its own message, which is what the brief specifically asked for.
3. **Playwright test route-pattern collision.** An e2e test's Supabase mock for "task creation" matched the same URL pattern as the Dashboard's own background task-list fetch, so an unrelated GET was counted as the create call, masking a `insertCalled` false positive. Fixed by branching on HTTP method inside the route handler.
4. **`schema.sql` failed against the reused Supabase project** with `column "owner_id" does not exist`, found only when actually applied to real Supabase (not something I could catch locally without a live project). Cause: that project still had a `tasks` table from the pre-WorkSync scaffold (a `user_id` column, no `owner_id`) — `create table if not exists` silently no-ops against it, then every RLS policy referencing `owner_id` fails. Fixed with a one-time migration guard that drops the table only when it matches that specific old shape, becoming a permanent no-op afterward.
5. **CI-only flaky test, invisible locally.** `ci.yml`'s `build` job set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` at job level, so even the `npm test` step got them — unlike every local run in this repo's history, where those vars are never set for `npm test`. With them present, `supabase` becomes a real (if unreachable) client, and `router.test.js`'s dashboard-rendering test triggers `dashboard.js`'s real background task fetch, which can hang against the placeholder host and time out. Fixed two ways: scoped those env vars to only the e2e/build steps in `ci.yml` (unit tests should never need them), and added an unconditional `tasks.js` mock in `router.test.js` so this test can't depend on network reachability regardless of ambient environment. Reproduced the exact CI failure locally (by setting those vars before `npm test`) to confirm both the bug and the fix.

## Phase 1 — Auth, Users & Roles

- `users` table + RLS (`supabase/schema.sql`): role/manager_id pairing enforced by a CHECK constraint, own-row + manager-sees-reports + public-active-managers-directory + insert-own-row policies, and a `touch_last_active()` RPC instead of a broad UPDATE policy.
- Real sign-in/sign-up forms (`src/screens/login.js`) replacing the Phase 0 placeholder — Nocturne `.seg`/`.field`/`.input` components, role-gated "reports to" picker, error/notice banners.
- `src/auth.js`: session/profile helpers, `signUp`/`signIn`/`signOutUser`, and the inactive-user block (signs out + "contact admin" message instead of entering the app).
- `src/validation.js`: pure `validateSignupForm`/`validateSigninForm`, unit-tested directly per the brief's guidance.
- `src/demoMode.js`: `VITE_DEMO_MODE` + `?demoRole=manager|employee` dev-only bypass, matching the seed data.
- Router auth guard: `#/dashboard`, `#/team`, `#/admin` redirect anonymous visitors to `#/login`; `#/login` itself redirects an already-signed-in visitor forward.
- Sidebar identity block (`renderIdentityBlock` in `src/components.js`) — avatar initials, name, email — wired into the dashboard/team/admin placeholders.
- `scripts/test-rls-users.mjs`: integration tests against a real Supabase project for the RLS policies above (manager sees reports/not other teams, employee can't query or mutate another manager's team). Wired into CI as a separate job that runs only when `SUPABASE_SERVICE_ROLE_KEY` is configured as a repo secret.
- Vitest coverage: validation (9), demo mode (5), auth flows with a mocked Supabase client (14), identity block + `initials` (6 new), router guard (5 new) — 53/53 total passing.
- Playwright coverage (network-mocked, no live backend needed): signup role-required rejection, manager/employee "reports to" field gating, unauthenticated redirect, identity block via demo mode, inactive-user block — plus the Phase 0 regression suite updated for the new auth guard.

### Bugs found and fixed during verification

- A stray pair of backticks inside an HTML comment in `login.js`'s template literal (`` `required` ``) terminated the JS string early, producing a real syntax error ("Unexpected identifier 'required'") that silently broke the entire login screen. Only caught by actually loading the page in a browser and reading the console — not by lint/typecheck, which don't execute template literal contents.
- `fetchActiveManagers()` was originally awaited before the login screen's first paint; against an unreachable Supabase host this network call could hang indefinitely, freezing the whole screen. Moved to a non-blocking background fetch that populates the manager picker once it resolves (or silently no-ops on failure) — the form itself no longer depends on it.

## Phase 0 — Foundation

- Replaced the earlier simple task-tracker scaffold with the WorkSync project structure (previous scaffold preserved on the `template/html-tailwind-supabase-vercel` branch).
- Vite scaffold: plain HTML + Tailwind CSS + vanilla JS ES modules, no UI framework.
- Ported the Nocturne design system verbatim (`src/styles/nocturne.css`) and mapped its tokens into `tailwind.config.js` theme extensions (colors, spacing, radius, shadows, fonts) so layout utilities resolve to the same tokens the component classes use.
- PWA skeleton via `vite-plugin-pwa` (manifest + service worker, placeholder icons).
- Supabase client wiring (`src/api.js`) reading Vite env vars, failing with a readable error if missing.
- Single-shell app (`index.html` + `src/main.js`) with a hash router (`src/router.js`) and empty placeholder screens for Dashboard / Team / User Admin, plus a placeholder Login screen and New Task dialog mount point.
- Seed script (`scripts/seed.js`) for demo users (Sarah Jenkins/manager, David Chen + Marcus Cole/employees) — targets the Phase 1 schema, not yet runnable until that lands.
- ESLint (flat config) + `tsc --noEmit` (checkJs via JSDoc) for lint/typecheck.
- Vitest + jsdom + @testing-library/dom unit tests for the router, Supabase client init, store, and HTML-escaping helper.
- Playwright e2e smoke test verifying the shell loads, routes correctly, and the Nocturne theme (not Tailwind defaults) is actually applied.
- GitHub Actions CI: lint → typecheck → unit → e2e → build on every push/PR.
- Design reference files (prototype + Nocturne design system) saved under `design-reference/` for later phases.
