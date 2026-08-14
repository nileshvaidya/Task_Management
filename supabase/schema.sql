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

-- Phase 2: tasks, single-owner CRUD + Dashboard. This creates the full
-- `tasks` contract from the build brief (including dependency/acceptance
-- columns) so the shape doesn't change under later phases, but Phase 2's
-- RLS and app logic only light up owner + manager-of-owner CRUD — no
-- cross-user assignment or acceptance flow yet (that's Phase 5, which will
-- likely add further INSERT/UPDATE policies for the dependency flow rather
-- than touching this table's shape).

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

alter table public.projects enable row level security;

drop policy if exists "Authenticated users can view projects" on public.projects;
create policy "Authenticated users can view projects"
  on public.projects for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create projects" on public.projects;
create policy "Authenticated users can create projects"
  on public.projects for insert
  to authenticated
  with check (true);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text,
  project_id uuid null references public.projects (id),
  due_date date not null,
  estimated_hours numeric null,
  status text not null default 'planned' check (status in ('planned', 'in-progress', 'completed')),
  priority text not null default 'low' check (priority in ('low', 'medium', 'high', 'critical')),
  owner_id uuid not null references public.users (id),
  created_by uuid not null references public.users (id),
  blocked boolean not null default false,
  blocked_reason text null,
  depends_on_task_id uuid null references public.tasks (id),
  accepted boolean null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_owner_id_idx on public.tasks (owner_id);
create index if not exists tasks_due_date_idx on public.tasks (due_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- Owner can fully manage their own tasks.
drop policy if exists "Owners can view own tasks" on public.tasks;
create policy "Owners can view own tasks"
  on public.tasks for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Owners can insert own tasks" on public.tasks;
create policy "Owners can insert own tasks"
  on public.tasks for insert
  to authenticated
  with check (owner_id = auth.uid() and created_by = auth.uid());

drop policy if exists "Owners can update own tasks" on public.tasks;
create policy "Owners can update own tasks"
  on public.tasks for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners can delete own tasks" on public.tasks;
create policy "Owners can delete own tasks"
  on public.tasks for delete
  to authenticated
  using (owner_id = auth.uid());

-- A manager can view and update (not delete) their direct reports' tasks —
-- the Dashboard's "My Team" filter (Phase 2 test case 8). Delete is
-- intentionally owner-only; broader manager override lands with Phase 4's
-- explicit OVERRIDE action instead of a blanket delete grant here.
drop policy if exists "Managers can view reports' tasks" on public.tasks;
create policy "Managers can view reports' tasks"
  on public.tasks for select
  to authenticated
  using (
    owner_id in (select id from public.users where manager_id = auth.uid())
  );

drop policy if exists "Managers can update reports' tasks" on public.tasks;
create policy "Managers can update reports' tasks"
  on public.tasks for update
  to authenticated
  using (
    owner_id in (select id from public.users where manager_id = auth.uid())
  )
  with check (
    owner_id in (select id from public.users where manager_id = auth.uid())
  );
