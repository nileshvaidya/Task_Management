# Deployment

WorkSync deploys to Vercel (frontend) backed by Supabase (Postgres + Auth).
This document covers environment separation, the secrets/env-var
inventory, and the rollback plan — the Phase 6 "production go-live gate"
deliverables from the build brief.

## Environments

| Environment | Trigger | Frontend | Supabase project |
|---|---|---|---|
| Production | push/merge to `main` | Vercel Production deployment | production project |
| Preview/staging | any PR branch | Vercel Preview deployment (unique URL per PR) | **staging** project (see below) |
| CI | every push/PR | GitHub Actions runner | none for unit/e2e (demo mode / mocked); a project referenced by `SUPABASE_URL` secret for the `integration` job |
| Local dev | `npm run dev` | Vite dev server | whichever project is in your local `.env` |

### Staging vs. production Supabase separation (required manual step)

**This is an account-level setup step that has to be done once in the
Vercel and Supabase dashboards — it can't be done from a coding session.**
Without it, PR preview deployments write to the same database production
does, which is the exact risk this phase's test case 5 exists to catch.

1. Create a second Supabase project (e.g. `worksync-staging`) if one
   doesn't exist yet. Apply the current `supabase/schema.sql` to it the
   same way you did for production (SQL editor; see the main `README.md`).
   Deploy the `admin-invite-user` Edge Function to it too
   (`supabase/README.md`).
2. In the Vercel project's **Settings → Environment Variables**, set
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` **scoped per Vercel
   environment**, not as a single shared value:
   - **Production** environment → the production Supabase project's URL/anon key.
   - **Preview** environment → the staging Supabase project's URL/anon key.
   - (Development, if you use `vercel dev`, can point at either — staging is safer.)
3. **Verify it took effect**: open any PR, wait for its Vercel preview
   comment, load the preview URL, open browser devtools → Network, and
   confirm requests go to the staging project's `*.supabase.co` host, not
   production's. This is the concrete check for test case 5 ("staging
   deploy does not write to the production project") — it isn't something
   Playwright/CI can assert from outside Vercel's own environment-variable
   resolution, so it's a one-time manual verification plus a periodic
   sanity check whenever env vars are touched.

## Environment variables & secrets inventory

| Variable | Where it's set | Used by | Sensitive? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Vercel (per-environment), GitHub Actions repo secret, local `.env` | Client bundle (compiled in at build time) | No — a public project URL |
| `VITE_SUPABASE_ANON_KEY` | same as above | Client bundle | No — anon key is safe to expose by design; RLS is the actual access boundary |
| `SUPABASE_URL` | GitHub Actions repo secret only | `scripts/test-rls-*.mjs` (`integration` CI job) | No |
| `SUPABASE_ANON_KEY` | GitHub Actions repo secret only | same | No |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Actions repo secret only; Supabase project's own Edge Function secrets | `scripts/test-rls-*.mjs`; `admin-invite-user` Edge Function | **Yes — bypasses RLS entirely.** Never put this in a `VITE_*` variable (it would ship to every browser) or in any client-side code path. |
| `VITE_DEMO_MODE` | Only ever set locally or in CI/Lighthouse builds, never in a real Vercel deployment | `src/demoMode.js` | No, but see below |

Review checklist before every production deploy:
- `git grep -n "SUPABASE_SERVICE_ROLE_KEY\|service_role"` across `src/` returns nothing — the service role key must never reach client code.
- `VITE_DEMO_MODE` is **not** set in the Vercel Production (or Preview)
  environment variables. It's a compile-time flag (`src/demoMode.js` reads
  it via `import.meta.env`) that bypasses real Supabase Auth entirely —
  fine for local dev and the Lighthouse CI job's own throwaway build (see
  `.github/workflows/ci.yml`), never for anything reachable by a real user.
- `.env` / `.env.local` stay out of git (already in `.gitignore`) — a repo
  secret scan is also worth running before a first production deploy if
  one hasn't been run yet.

## Rollback plan

**Frontend (Vercel).** Vercel deployments are immutable — every push
produces a new deployment without touching the previous one. To roll back:
1. Vercel dashboard → the project → **Deployments** → find the last known-good deployment → **⋯ → Promote to Production** (this is Vercel's "instant rollback"; it repoints the production domain, no rebuild needed, effectively immediate).
2. In parallel, `git revert` the bad commit on `main` so the branch itself reflects reality and the next real deploy doesn't reintroduce the same bug.

**Database (Supabase).** There's no automatic schema rollback — `schema.sql`
is written to be additive/idempotent (every phase's migrations are `create
or replace`, `drop ... if exists` + `create`, etc.), which makes it safe to
*re-run*, but not something that can be *undone* automatically. If a schema
change needs reverting:
1. Write a short, explicit reverse migration (e.g. `drop policy ...`,
   `alter table ... drop column ...`) and run it by hand in the SQL editor
   — don't hand-edit `schema.sql`'s history, add the reverse as a new
   change, same as any other migration.
2. Prefer catching a bad schema change on staging first — this is the
   other reason the staging/production separation above matters: run new
   `schema.sql` sections against the staging project and its own
   `npm run test:integration` before touching production.
3. For data-loss scenarios (not just a bad policy), Supabase's daily
   backups (or Point-in-Time Recovery, on paid tiers) are the actual
   recovery path — enable at least daily backups on the production project
   if not already on. This repo has no tooling around that; it's a
   Supabase dashboard setting.

**Edge Function (`admin-invite-user`).** `supabase functions deploy`
overwrites the live function with no built-in versioning/canary. To roll
back, check out the previous known-good commit's
`supabase/functions/admin-invite-user/index.ts` and redeploy it:
```bash
git show <last-good-sha>:supabase/functions/admin-invite-user/index.ts > /tmp/index.ts
cp /tmp/index.ts supabase/functions/admin-invite-user/index.ts
supabase functions deploy admin-invite-user
```

## Pre-go-live checklist

- [ ] `lint` → `typecheck` → unit → e2e → `build` all green in CI (`build` job)
- [ ] `integration` CI job green against the **staging** Supabase project
- [ ] Lighthouse CI job green (performance/accessibility ≥ 90 — see note in `.github/workflows/ci.yml` about why the brief's third "PWA" score isn't literally assertable anymore)
- [ ] `supabase/schema.sql` applied to the **production** Supabase project (test on staging first)
- [ ] `admin-invite-user` Edge Function deployed to the production project
- [ ] Vercel Production/Preview environment variables verified to point at the correct (production/staging) Supabase projects respectively
- [ ] Manual smoke test against the production URL after deploy: sign in, create a task, confirm no console errors
