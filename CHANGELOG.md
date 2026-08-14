# Changelog

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
