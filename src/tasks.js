// Task CRUD data layer. Mirrors auth.js's shape (injectable client, plain
// return values) for mutations — but the fetch* functions below throw on a
// real query error rather than swallowing it into an empty array, so a
// screen's loader can distinguish "genuinely no rows" from "the request
// failed" and render an error state instead of a silent empty list (Phase
// 6). `!client` (demo mode / unconfigured) is not an error and still
// returns [].
import { supabase } from './api.js';
import { logActivity } from './activity.js';

/** @param {any} [client] */
export async function fetchMyTasks(ownerId, client = supabase) {
  if (!client) return [];
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('owner_id', ownerId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * All tasks owned by the given manager's direct reports (the Dashboard's
 * "My Team" filter). Two round trips — Supabase's JS query builder can't
 * express "owner_id in (subquery)" directly — but each is RLS-scoped the
 * same way the equivalent SQL subquery would be.
 * @param {any} [client]
 */
export async function fetchTeamTasks(managerId, client = supabase) {
  if (!client) return [];
  const { data: reports, error: reportsError } = await client
    .from('users')
    .select('id')
    .eq('manager_id', managerId);
  if (reportsError) throw reportsError;
  if (!reports || reports.length === 0) return [];

  const reportIds = reports.map((r) => r.id);
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .in('owner_id', reportIds)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Every task owned by anyone on `callerId`'s team (per team_root in
 * supabase/schema.sql) — self, manager, and siblings alike — for Team
 * Overview's Team Pulse / Blockers & Alerts / per-member Today's Focus
 * cards (Phase 3). Distinct from fetchTeamTasks above, which is the
 * Dashboard's manager-only "My Team" filter and excludes the manager's own
 * tasks; this one is symmetric for a manager or an employee caller alike.
 * @param {any} [client]
 */
export async function fetchAllTeamTasks(callerId, client = supabase) {
  if (!client) return [];
  const { data: ids, error: idsError } = await client.rpc('team_member_ids', { uid: callerId });
  if (idsError) throw idsError;
  if (!ids || ids.length === 0) return [];

  const { data, error } = await client
    .from('tasks')
    .select('*')
    .in('owner_id', ids)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * `createdBy` defaults to `ownerId` (Phase 2's only case: self-owned).
 * Phase 5 passes them separately for cross-assignment — a manager assigning
 * to a report, or a dependency task assigned to someone else — where the
 * server (schema.sql's check_assignee_active trigger) forces `accepted` to
 * false whenever they differ, regardless of what's sent here.
 * @param {{ title: string, description?: string, dueDate: string, ownerId: string, createdBy?: string, priority?: string, projectId?: string|null, estimatedHours?: number|null }} form
 * @param {any} [client]
 */
export async function createTask(form, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const { title, description, dueDate, ownerId, createdBy, priority, projectId, estimatedHours } = form;
  const { data, error } = await client
    .from('tasks')
    .insert({
      title,
      description: description || null,
      due_date: dueDate,
      owner_id: ownerId,
      created_by: createdBy || ownerId,
      ...(priority ? { priority } : {}),
      ...(projectId ? { project_id: projectId } : {}),
      ...(estimatedHours != null ? { estimated_hours: estimatedHours } : {}),
    })
    .select()
    .single();
  if (!error && data) {
    await logActivity({ actorId: createdBy || ownerId, verb: 'created', taskId: data.id, detail: title }, client);
  }
  return { data, error };
}

/**
 * The "Task Accepted" checkbox (Phase 5 test case 7) — only the task's
 * owner can call this in practice (RLS: "Owners can update own tasks").
 * @param {string} taskId
 * @param {string} actorId
 * @param {any} [client]
 */
export async function acceptTask(taskId, actorId, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const { data, error } = await client.from('tasks').update({ accepted: true }).eq('id', taskId).select().single();
  if (!error && data) {
    await logActivity({ actorId, verb: 'accepted', taskId, detail: data.title }, client);
  }
  return { data, error };
}

/**
 * Active, company-wide user list for the New Task dialog's dependency
 * Assign To (Phase 5 test case 2) — unlike the primary task's Assign To,
 * which is role-gated to the caller's own team.
 * @param {any} [client]
 */
export async function fetchAssignableUsers(client = supabase) {
  if (!client) return [];
  const { data, error } = await client.rpc('list_assignable_users');
  if (error) throw error;
  return data;
}

/**
 * Every existing task company-wide, for the dependency picker's "search
 * existing tasks" mode (Phase 5 test case 3). Filtering by search text is
 * done client-side via filterTasksForDependency (adminFilter.js's sibling).
 * @param {any} [client]
 */
export async function fetchDependencyCandidates(client = supabase) {
  if (!client) return [];
  const { data, error } = await client.rpc('list_all_tasks_for_dependency');
  if (error) throw error;
  return data;
}

/**
 * Orchestrates the New Task dialog's full submission (Phase 5): create the
 * primary task, then resolve its dependency (create a new one, or link an
 * existing one), then — only if "requires acceptance" was checked — mark
 * the primary task blocked and log a 'blocked' activity entry. A "new"
 * dependency has no date field of its own in the brief's mini-form, so it
 * reuses the primary task's due date (documented assumption).
 *
 * If the primary task is created but the dependency step then fails, the
 * primary task is left as a plain (non-blocked) task rather than rolled
 * back — simple partial-failure handling, consistent with Phase 4's
 * best-effort (not transactional) admin-invite-user rollback.
 * @param {{
 *   title: string, description?: string, dueDate: string, priority?: string,
 *   projectId?: string|null, estimatedHours?: number|null,
 *   ownerId: string, createdBy: string,
 *   dependency?: {
 *     mode: 'new'|'existing', requiresAcceptance: boolean,
 *     title?: string, assigneeId?: string, assigneeName?: string,
 *     taskId?: string, taskTitle?: string, taskOwnerName?: string,
 *   } | null,
 * }} form
 * @param {any} [client]
 */
export async function createTaskWithDependency(form, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const { dependency, ...primaryForm } = form;
  const { data: primaryTask, error: primaryError } = await createTask(
    { ...primaryForm, createdBy: primaryForm.createdBy },
    client
  );
  if (primaryError || !primaryTask) return { data: null, error: primaryError };
  if (!dependency) return { data: primaryTask, error: null };

  let depTaskId;
  let depTitle;
  let depOwnerName;
  if (dependency.mode === 'new') {
    const { data: depTask, error: depError } = await createTask(
      {
        title: dependency.title,
        dueDate: form.dueDate,
        ownerId: dependency.assigneeId,
        createdBy: form.createdBy,
      },
      client
    );
    if (depError || !depTask) return { data: primaryTask, error: depError };
    depTaskId = depTask.id;
    depTitle = dependency.title;
    depOwnerName = dependency.assigneeName;
  } else {
    depTaskId = dependency.taskId;
    depTitle = dependency.taskTitle;
    depOwnerName = dependency.taskOwnerName;
  }

  const patch = { depends_on_task_id: depTaskId };
  if (dependency.requiresAcceptance) {
    patch.status = 'in-progress';
    patch.blocked = true;
    patch.blocked_reason = `${depOwnerName} — ${depTitle}`;
  }
  const { data: updatedPrimary, error: updateError } = await client
    .from('tasks')
    .update(patch)
    .eq('id', primaryTask.id)
    .select()
    .single();
  if (updateError) return { data: primaryTask, error: updateError };

  if (dependency.requiresAcceptance) {
    await logActivity(
      { actorId: form.createdBy, verb: 'blocked', taskId: primaryTask.id, detail: patch.blocked_reason },
      client
    );
  }
  return { data: updatedPrimary, error: null };
}

/**
 * Setting status to 'completed' clears any blocked/blocked_reason on the
 * task (matches the prototype's existing behavior); any other status
 * leaves blocked/blocked_reason untouched. `actorId` is the signed-in user
 * making the change — logged to the activity feed alongside the new
 * status; omit it (e.g. from a script with no session) to skip logging.
 * @param {any} [client]
 */
export async function setTaskStatus(taskId, status, actorId, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const patch = status === 'completed' ? { status, blocked: false, blocked_reason: null } : { status };
  const { data, error } = await client.from('tasks').update(patch).eq('id', taskId).select().single();
  if (!error && data && actorId) {
    await logActivity(
      { actorId, verb: 'status_changed', taskId, detail: `${data.title} → ${status}` },
      client
    );
  }
  return { data, error };
}

/**
 * @param {{ id: string, status: string }} task
 * @param {string} [actorId]
 * @param {any} [client]
 */
export async function toggleTaskDone(task, actorId, client = supabase) {
  const nextStatus = task.status === 'completed' ? 'planned' : 'completed';
  return setTaskStatus(task.id, nextStatus, actorId, client);
}
