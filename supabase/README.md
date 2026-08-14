# Supabase

Run [`schema.sql`](./schema.sql) in the Supabase SQL editor (or via
`supabase db push`) before using the app or running `scripts/seed.js`.

## Required project setting

**Authentication → Providers → Email → "Confirm email" must be disabled**
for sign-up to work as designed: `auth.signUp()` needs to return a session
immediately so the app can insert the new user's `public.users` profile row
in the same flow (the insert RLS policy requires `auth.uid()`, which needs
an active session). Re-enable it before real users sign up in production —
tracked as a Phase 6 hardening item.

## Manager directory exposure

The `"Public can view active managers"` policy intentionally exposes
active managers' `name`/`email` to unauthenticated requests — the sign-up
form needs to list managers for an employee to pick from before that
employee has a session. No employee rows or inactive accounts are exposed.

## Integration tests

`scripts/test-rls-users.mjs` exercises the RLS policies above against a
real project. Requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` (service role only ever used for setup/teardown
of throwaway test users, never for the assertions themselves). Run with
`npm run test:integration`.
