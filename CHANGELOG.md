# Changelog

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
