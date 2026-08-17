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

-- One-time migration guard: a project that previously ran the pre-WorkSync
-- scaffold's schema (see the template/html-tailwind-supabase-vercel
-- branch) may still have a `tasks` table shaped for that app (a `user_id`
-- column, no `owner_id`). `create table if not exists` below would then
-- silently no-op against that old shape, and every policy referencing
-- `owner_id` would fail with "column does not exist". Drop it only when it
-- matches that specific old shape — this becomes a permanent no-op after
-- the first run, once the real WorkSync `tasks` table (with `owner_id`)
-- exists, so it's safe to leave in place and re-run this file repeatedly.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'owner_id'
  ) then
    drop table public.tasks cascade;
  end if;
end $$;

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

-- Phase 3: Team Feed & Team Overview. "Team" = a manager plus their direct
-- reports. team_root(uid) resolves any user to the manager id that anchors
-- their team (themselves, if they're a manager) so both a manager's and an
-- employee's team-scoped queries can share one definition.
create or replace function public.team_root(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when u.role = 'manager' then u.id else u.manager_id end
  from public.users u
  where u.id = uid;
$$;

grant execute on function public.team_root(uuid) to authenticated;

-- team_member_ids must also be security definer: a plain subquery on
-- public.users inside a policy's USING clause runs under the *querying*
-- user's own RLS, not the definer's — so an employee (who Phase 1 only
-- grants "own row" + "public active managers" visibility on public.users)
-- would see an empty result for siblings under the same manager, breaking
-- Team Overview for employees specifically. Wrapping the lookup in a
-- security definer function bypasses that inner RLS, scoped only to
-- "who shares my team_root" — it can't be used to browse arbitrary users.
create or replace function public.team_member_ids(uid uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where coalesce(manager_id, id) = public.team_root(uid);
$$;

grant execute on function public.team_member_ids(uuid) to authenticated;

-- Team Overview's per-member cards need each teammate's name/role/status —
-- same team_member_ids scoping as the tasks/activity_log policies below.
-- SELECT-only; the Phase 1 "own row" insert policy is unaffected, and there
-- is still no general UPDATE policy (role/status changes stay Admin-only).
drop policy if exists "Team can view teammate profiles" on public.users;
create policy "Team can view teammate profiles"
  on public.users for select
  to authenticated
  using (id in (select public.team_member_ids(auth.uid())));

-- Team Overview needs to read teammates' tasks to compute Team Pulse,
-- Blockers & Alerts, and per-member Today's Focus — including for an
-- employee viewing siblings under the same manager, which the Phase 2
-- owner/manager-of-owner policies don't cover. This is SELECT-only: the
-- existing owner/manager policies above remain the only way to insert,
-- update, or delete a task, so a teammate can view but never modify
-- another teammate's task through this policy.
drop policy if exists "Team can view team tasks" on public.tasks;
create policy "Team can view team tasks"
  on public.tasks for select
  to authenticated
  using (owner_id in (select public.team_member_ids(auth.uid())));

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users (id),
  verb text not null check (verb in ('created', 'status_changed', 'accepted', 'blocked', 'unblocked')),
  task_id uuid null references public.tasks (id) on delete set null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

-- Scoped the same way as the "Team can view team tasks" policy above: a
-- viewer sees activity from their own team only (themselves, their
-- manager/reports), never company-wide.
drop policy if exists "Team can view team activity" on public.activity_log;
create policy "Team can view team activity"
  on public.activity_log for select
  to authenticated
  using (actor_id in (select public.team_member_ids(auth.uid())));

drop policy if exists "Users can log their own activity" on public.activity_log;
create policy "Users can log their own activity"
  on public.activity_log for insert
  to authenticated
  with check (actor_id = auth.uid());

-- Phase 4: User Admin. "Managers = admins" (brief §0) — unlike the
-- deliberately team-scoped Dashboard/Team screens (Phases 2-3), the Admin
-- screen is the one surface where a manager's privilege is company-wide:
-- any active manager can list/manage every user and every task, not just
-- their own team. Kept out of RLS (which would broaden every other query
-- too) and instead gated per-action through these security definer RPCs,
-- so the elevated access only ever applies to an explicit admin action.

alter table public.users add column if not exists deleted_at timestamptz null;

create or replace function public.is_active_manager(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = uid and role = 'manager' and status = 'active' and deleted_at is null
  );
$$;

grant execute on function public.is_active_manager(uuid) to authenticated;

-- Every user, for the User Management table. Excludes soft-deleted users —
-- "deleted" means gone from the admin view, not merely deactivated (that's
-- what the separate Active/Inactive toggle is for).
create or replace function public.admin_list_users()
returns setof public.users
language sql
stable
security definer
set search_path = public
as $$
  select * from public.users
  where public.is_active_manager(auth.uid()) and deleted_at is null
  order by name;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- Every task, for the Global Task Control table.
create or replace function public.admin_list_tasks()
returns setof public.tasks
language sql
stable
security definer
set search_path = public
as $$
  select * from public.tasks
  where public.is_active_manager(auth.uid())
  order by due_date;
$$;

grant execute on function public.admin_list_tasks() to authenticated;

-- Toggle Active/Inactive (Phase 4 test case 4). A narrow RPC rather than a
-- general UPDATE policy, same rationale as touch_last_active() in Phase 1 —
-- this is the only door through which status can change, so it's the only
-- place that needs to enforce "caller is a manager" and "not targeting
-- yourself" (an admin locking themselves out is never intended).
create or replace function public.set_user_status(target_id uuid, new_status text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.users;
begin
  if not public.is_active_manager(auth.uid()) then
    raise exception 'Only an active manager can change a user''s status.';
  end if;
  if target_id = auth.uid() then
    raise exception 'You cannot change your own status.';
  end if;
  if new_status not in ('active', 'inactive') then
    raise exception 'Invalid status: %', new_status;
  end if;

  update public.users set status = new_status where id = target_id and deleted_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'User not found.';
  end if;
  return updated;
end;
$$;

grant execute on function public.set_user_status(uuid, text) to authenticated;

-- Soft-delete (Phase 4 test case 5): marks the user inactive + deleted, and
-- reassigns their open (not-yet-completed) tasks rather than orphaning
-- owner_id. Reassignment target is their manager, for triage — the natural
-- reading of "tasks move to the deleted user's manager". A deleted
-- *manager* has no manager to fall back to, so their open tasks go to
-- whichever admin performed the delete instead (documented assumption —
-- there's no companywide "manager of managers" concept yet).
create or replace function public.soft_delete_user(target_id uuid)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.users;
  target_manager_id uuid;
  reassign_to uuid;
begin
  if not public.is_active_manager(auth.uid()) then
    raise exception 'Only an active manager can delete a user.';
  end if;
  if target_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;

  select manager_id into target_manager_id from public.users where id = target_id;
  reassign_to := coalesce(target_manager_id, auth.uid());

  update public.tasks set owner_id = reassign_to
  where owner_id = target_id and status <> 'completed';

  update public.users set status = 'inactive', deleted_at = now()
  where id = target_id
  returning * into updated;

  if updated.id is null then
    raise exception 'User not found.';
  end if;
  return updated;
end;
$$;

grant execute on function public.soft_delete_user(uuid) to authenticated;

-- OVERRIDE (Phase 4 test case 6): lets a manager change any task's status
-- and/or owner regardless of the ownership rules RLS otherwise enforces —
-- implemented as this server-side function rather than a client-side RLS
-- bypass, per the brief. new_owner_id is optional (null = leave owner_id
-- unchanged, just change status).
create or replace function public.override_task(task_id uuid, new_status text, new_owner_id uuid default null)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.tasks;
  old_title text;
begin
  if not public.is_active_manager(auth.uid()) then
    raise exception 'Only an active manager can override a task.';
  end if;
  if new_status not in ('planned', 'in-progress', 'completed') then
    raise exception 'Invalid status: %', new_status;
  end if;

  select title into old_title from public.tasks where id = task_id;
  if old_title is null then
    raise exception 'Task not found.';
  end if;

  update public.tasks
  set status = new_status,
      owner_id = coalesce(new_owner_id, owner_id),
      -- Phase 5: an unaccepted task can't otherwise move off 'planned' (see
      -- tasks_accepted_status_check below). OVERRIDE is the one path allowed
      -- to bypass that — implicitly accepting the task in the same step,
      -- per the brief's default rule for this exact case.
      accepted = case when new_status <> 'planned' then true else accepted end,
      blocked = case when new_status = 'completed' then false else blocked end,
      blocked_reason = case when new_status = 'completed' then null else blocked_reason end
  where id = task_id
  returning * into updated;

  insert into public.activity_log (actor_id, verb, task_id, detail)
  values (auth.uid(), 'overridden', task_id, old_title || ' → ' || new_status);

  return updated;
end;
$$;

grant execute on function public.override_task(uuid, text, uuid) to authenticated;

-- Allow the new 'overridden' verb — the original inline check constraint
-- (auto-named by Postgres) is replaced with an explicitly-named one so this
-- migration is idempotent on re-run.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'activity_log' and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%verb%'
  loop
    execute format('alter table public.activity_log drop constraint %I', c.conname);
  end loop;

  alter table public.activity_log add constraint activity_log_verb_check
    check (verb in ('created', 'status_changed', 'accepted', 'blocked', 'unblocked', 'overridden'));
end $$;

-- Phase 5: Dependencies & Cross-User Task Assignment & Acceptance. Two
-- kinds of cross-assignment now exist — a manager assigning a primary task
-- directly to a report, and anyone creating a dependency task assigned to
-- another user — and both are indistinguishable at the row level (a
-- dependency task is just a normal task; only the *other* task's
-- depends_on_task_id points at it). So the real security boundary here
-- isn't "who can insert a row for whom" — it's acceptance: `accepted`
-- already defaults to false whenever created_by <> owner_id (data model,
-- section 1), and the CHECK constraint below makes that unenforceable to
-- bypass except through the one explicit escape hatch (OVERRIDE, above).

-- An unaccepted task cannot move off 'planned' via any path except
-- override_task() (which explicitly accepts it in the same statement) —
-- Phase 5 test case 8. Defense in depth: the Task Acceptance UI already
-- hides status controls client-side; this is the server-side backstop.
alter table public.tasks drop constraint if exists tasks_accepted_status_check;
alter table public.tasks add constraint tasks_accepted_status_check
  check (accepted is not false or status = 'planned');

-- A task can't be assigned (owner_id) to an inactive/deleted user — Phase 5
-- test case 10. A BEFORE INSERT trigger (rather than folding this into the
-- INSERT policy alone) gives a readable error message instead of RLS's
-- generic "row violates policy" — the trigger raises before RLS's WITH
-- CHECK is even evaluated, so this is the message the client actually sees.
-- Same trigger also enforces the data model's own rule (section 1): accepted
-- is forced to false whenever created_by <> owner_id, regardless of what the
-- client sends — this is a data-integrity rule, not a client choice, so it
-- isn't left to application code to remember on every insert path.
create or replace function public.check_assignee_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignee_status text;
  assignee_deleted timestamptz;
begin
  if new.owner_id <> new.created_by then
    select status, deleted_at into assignee_status, assignee_deleted
    from public.users where id = new.owner_id;
    if assignee_status is distinct from 'active' or assignee_deleted is not null then
      raise exception 'Cannot assign a task to an inactive user.';
    end if;
    new.accepted := false;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_check_assignee_active on public.tasks;
create trigger tasks_check_assignee_active
  before insert on public.tasks
  for each row
  execute function public.check_assignee_active();

-- is_active_user must be security definer for the same reason
-- team_member_ids (Phase 3) and is_active_manager (Phase 4) are: a plain
-- subquery on public.users inside a policy's WITH CHECK clause runs under
-- the *inserting* user's own RLS visibility into users, not bypassed —
-- and Phase 3 only grants visibility into your own team's profiles. A
-- cross-TEAM assignment (Employee A → Employee B, different manager)
-- would then silently fail the check not because B is inactive, but
-- because A isn't allowed to see B's row at all — caught by
-- scripts/test-rls-dependencies.mjs's cross-team assignment case.
create or replace function public.is_active_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = uid and status = 'active' and deleted_at is null
  );
$$;

grant execute on function public.is_active_user(uuid) to authenticated;

-- Cross-assignment (manager → report, or a dependency assigned to anyone)
-- needs owner_id <> created_by to be insertable at all — Phase 2's
-- "Owners can insert own tasks" policy only ever allowed self-assignment.
-- Replaced with a broader check: assign to yourself, or to any active
-- user — narrowed further (inactive users rejected) by the trigger above,
-- and made safe in practice by the acceptance gate rather than by
-- restricting who can be targeted.
drop policy if exists "Owners can insert own tasks" on public.tasks;
drop policy if exists "Users can insert tasks for active users" on public.tasks;
create policy "Users can insert tasks for active users"
  on public.tasks for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (owner_id = auth.uid() or public.is_active_user(owner_id))
  );

-- INSERT ... RETURNING (what every insert().select() call does) also
-- requires the inserted row to pass a SELECT policy, not just the INSERT
-- policy's WITH CHECK — a Postgres RLS detail easy to miss, caught only
-- once scripts/test-rls-dependencies.mjs ran the cross-team insert for
-- real: the WITH CHECK above now allows it, but none of the existing
-- SELECT policies (owner / manager-of-owner / same-team) grant the
-- creator visibility into a task they just created for someone on a
-- different team, so the RETURNING row failed RLS with the exact same
-- 42501 error as the original bug. A creator can always see what they
-- created, regardless of who it's assigned to.
drop policy if exists "Creators can view tasks they created" on public.tasks;
create policy "Creators can view tasks they created"
  on public.tasks for select
  to authenticated
  using (created_by = auth.uid());

-- Auto-unblock (Phase 5 test case 9): when a task is marked completed,
-- clear blocked/blocked_reason on every task that depends on it, and log
-- an 'unblocked' activity entry for each one's owner. security definer so
-- this works regardless of who completed the dependency — the dependent
-- task usually belongs to someone else entirely, who the completer has no
-- RLS-granted write access to otherwise.
create or replace function public.clear_dependent_blocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dep record;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    for dep in
      update public.tasks
      set blocked = false, blocked_reason = null
      where depends_on_task_id = new.id and blocked = true
      returning id, owner_id, title
    loop
      insert into public.activity_log (actor_id, verb, task_id, detail)
      values (dep.owner_id, 'unblocked', dep.id, dep.title || ' — no longer blocked, ' || new.title || ' was completed');
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_clear_dependent_blocks on public.tasks;
create trigger tasks_clear_dependent_blocks
  after update on public.tasks
  for each row
  execute function public.clear_dependent_blocks();

-- The dependency picker needs two company-wide, narrowly-scoped reads that
-- no existing RLS policy grants to a plain employee (Phase 5 test cases 2
-- and 3): who can this be assigned to, and which existing tasks can this
-- depend on. Same "narrow RPC over broad policy" principle as Phase 3/4 —
-- callable by any authenticated user, but each returns only the minimum
-- fields needed for its picker, not full row access.
create or replace function public.list_assignable_users()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.name from public.users u
  where u.status = 'active' and u.deleted_at is null
  order by u.name;
$$;

grant execute on function public.list_assignable_users() to authenticated;

create or replace function public.list_all_tasks_for_dependency()
returns table (id uuid, title text, owner_id uuid, owner_name text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.title, t.owner_id, u.name as owner_name, t.status
  from public.tasks t
  join public.users u on u.id = t.owner_id
  order by t.created_at desc;
$$;

grant execute on function public.list_all_tasks_for_dependency() to authenticated;

-- Phase 9: managers can delete their own tasks (already covered by "Owners
-- can delete own tasks" above) *and* their direct reports' tasks — the
-- Dashboard's task rows now show a delete action for managers on both the
-- "Mine" and "My Team" filters. Postgres ORs multiple permissive policies
-- for the same command, so this is additive: an owner-manager still
-- qualifies via the owner policy, a manager deleting a report's task
-- qualifies via this one, and an employee (who has neither) still can't
-- touch anyone else's row.
drop policy if exists "Managers can delete reports' tasks" on public.tasks;
create policy "Managers can delete reports' tasks"
  on public.tasks for delete
  to authenticated
  using (
    owner_id in (select id from public.users where manager_id = auth.uid())
  );

-- Deleting a task can leave other tasks pointing at it via
-- depends_on_task_id. That FK had no ON DELETE action, so before this it
-- would have just blocked the delete outright with a foreign-key-violation
-- error the moment a task with a dependent existed. Switched to SET NULL so
-- the delete always succeeds, and paired with a BEFORE DELETE trigger (not
-- AFTER — the FK's own SET NULL action is itself an internal AFTER
-- trigger, and would already have nulled depends_on_task_id on every
-- dependent by the time a user-defined AFTER trigger ran, leaving nothing
-- for its WHERE clause to match) that clears the resulting stale
-- blocked/blocked_reason, same "auto-unblock" idea as
-- clear_dependent_blocks above but triggered by deletion instead of
-- completion.
alter table public.tasks drop constraint if exists tasks_depends_on_task_id_fkey;
alter table public.tasks add constraint tasks_depends_on_task_id_fkey
  foreign key (depends_on_task_id) references public.tasks (id) on delete set null;

create or replace function public.clear_blocks_on_dependency_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dep record;
begin
  for dep in
    update public.tasks
    set blocked = false, blocked_reason = null
    where depends_on_task_id = old.id and blocked = true
    returning id, owner_id, title
  loop
    insert into public.activity_log (actor_id, verb, task_id, detail)
    values (dep.owner_id, 'unblocked', dep.id, dep.title || ' — no longer blocked, its dependency was deleted');
  end loop;
  return old;
end;
$$;

drop trigger if exists tasks_clear_blocks_on_delete on public.tasks;
create trigger tasks_clear_blocks_on_delete
  before delete on public.tasks
  for each row
  execute function public.clear_blocks_on_dependency_deleted();
