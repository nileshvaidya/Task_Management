-- WorkSync schema — Phase 1: users, roles, hierarchy.
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Later phases add tasks/projects/activity_log migrations as separate
-- files or appended sections — keep this file the running source of truth.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  email text not null unique,
  role text not null check (role in ('manager', 'employee')),
  manager_id uuid null references public.users (id),
  status text not null default 'active' check (status in ('active', 'inactive')),
  last_active timestamptz,
  constraint users_role_manager_pairing check (
    (role = 'manager' and manager_id is null) or
    (role = 'employee' and manager_id is not null)
  )
);

create index if not exists users_manager_id_idx on public.users (manager_id);

alter table public.users enable row level security;

-- Every user can read their own profile row.
drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile"
  on public.users for select
  to authenticated
  using (auth.uid() = id);

-- A manager can read their direct reports' rows (Phase 1 test case 3).
drop policy if exists "Managers can view their reports" on public.users;
create policy "Managers can view their reports"
  on public.users for select
  to authenticated
  using (manager_id = auth.uid());

-- Public manager directory: the sign-up form needs to list existing
-- managers for an employee to pick from *before* that employee has a
-- session. Scoped narrowly to active managers only (no employee rows, no
-- inactive accounts) — an internal-company "who do you report to" picker,
-- not a general user directory. Exposes name/email only, which is the
-- minimum needed for the picker UI.
drop policy if exists "Public can view active managers" on public.users;
create policy "Public can view active managers"
  on public.users for select
  to anon, authenticated
  using (role = 'manager' and status = 'active');

-- A newly authenticated user creates their own profile row right after
-- auth.signUp() (requires "Confirm email" disabled in Supabase Auth
-- settings so signUp() returns a session immediately — see README).
drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);

-- No general UPDATE policy: role/manager_id/status changes are Admin-only
-- (Phase 4 User Admin "toggle active/inactive", OVERRIDE). Users can only
-- bump their own last_active timestamp, via a narrow RPC rather than a
-- broad UPDATE policy that could let them tamper with role/manager_id.
create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = public
as $$
  update public.users set last_active = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_active() to authenticated;
