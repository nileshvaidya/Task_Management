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
GitHub, Vercel, and Supabase dashboards — it can't be done from a coding
session (no API access to any of the three from here).** Without it, PR
preview deployments *and* CI's `integration` job both write to the same
database production does — this is exactly what happened before this
section was tightened: the `integration` job's `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` secrets pointed at the production project, so
every run of `scripts/test-rls-*.mjs` created (and, on a good run, deleted)
real rows in it — `RLS Test Manager A ...`-style users left behind in the
User Management screen whenever a run didn't clean up after itself. This
phase's test case 5 exists specifically to catch this class of bug.

**Step 1 — create the staging Supabase project.**
Create a second Supabase project (e.g. `worksync-staging`) if one doesn't
exist yet. Apply the current `supabase/schema.sql` to it the same way you
did for production (SQL editor; see the main `README.md`). Deploy the
`admin-invite-user` Edge Function to it too (`supabase/README.md`). Note
down its **Project URL**, **anon public key**, and **service_role key**
(Supabase dashboard → Settings → API) — you'll need all three below.

**Step 2 — point GitHub Actions' `integration` job at staging.**
This is the part that was missing before and is the actual fix for the
pollution above.
1. On GitHub, go to the repo → **Settings → Secrets and variables →
   Actions**.
2. Under the **Repository secrets** tab, for each of `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: if it already exists,
   click it → **Update** and paste in the **staging** project's value; if
   it doesn't exist yet, click **New repository secret** and add it.
   **All three must be the staging project's values — never
   production's.** These three secrets exist solely so
   `.github/workflows/ci.yml`'s `integration` job can run
   `scripts/test-rls-*.mjs` against a real database; that database must
   never be the one real users' data lives in.
3. If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` also exist as repo
   secrets (used by the `build`/e2e steps as a fallback-only value — see
   the workflow file), point those at staging too for the same reason,
   though the e2e suite mocks all network calls so this matters far less
   than step 2's three.

**Step 3 — point Vercel Preview deployments at staging.**
In the Vercel project's **Settings → Environment Variables**, set
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` **scoped per Vercel
environment**, not as a single shared value:
- **Production** environment → the production Supabase project's URL/anon key.
- **Preview** environment → the staging Supabase project's URL/anon key.
- (Development, if you use `vercel dev`, can point at either — staging is safer.)

**Step 4 — verify both took effect.**
- *CI*: open the **Actions** tab on GitHub, find the latest `CI` run's
  `integration` job, and confirm it ran (not skipped) and passed. Then
  check the staging project's `public.users` table in the Supabase SQL
  editor — you should see (and, after a clean run, *not* see, since the
  scripts clean up after themselves) the `RLS ...@example.com` test rows
  there, never in production's.
- *Preview deploys*: open any PR, wait for its Vercel preview comment,
  load the preview URL, open browser devtools → Network, and confirm
  requests go to the staging project's `*.supabase.co` host, not
  production's.
- Neither of these is something Playwright/CI can assert from outside
  Vercel's/GitHub's own environment-variable resolution, so both are a
  one-time manual verification plus a periodic sanity check whenever these
  secrets/env vars are touched again.

## Environment variables & secrets inventory

| Variable | Where it's set | Used by | Sensitive? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Vercel (per-environment), GitHub Actions repo secret, local `.env` | Client bundle (compiled in at build time) | No — a public project URL |
| `VITE_SUPABASE_ANON_KEY` | same as above | Client bundle | No — anon key is safe to expose by design; RLS is the actual access boundary |
| `SUPABASE_URL` | GitHub Actions repo secret only — **must be the staging project, never production** (see "Staging vs. production Supabase separation" above) | `scripts/test-rls-*.mjs` (`integration` CI job) | No |
| `SUPABASE_ANON_KEY` | GitHub Actions repo secret only — **staging, never production** | same | No |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Actions repo secret only (**staging project's key**); Supabase project's own Edge Function secrets (production project's key, for the real Edge Function) | `scripts/test-rls-*.mjs`; `admin-invite-user` Edge Function | **Yes — bypasses RLS entirely.** Never put this in a `VITE_*` variable (it would ship to every browser) or in any client-side code path. The GitHub Actions copy and the production Edge Function's copy are two *different* projects' keys — don't reuse one for the other. |
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
