# Test Report

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
