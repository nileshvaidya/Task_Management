// Task CRUD data layer. Mirrors auth.js's shape (injectable client, plain
// return values, no throwing on expected failure paths) for the same
// testability reasons.
import { supabase } from './api.js';

/** @param {any} [client] */
export async function fetchMyTasks(ownerId, client = supabase) {
  if (!client) return [];
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('owner_id', ownerId)
    .order('due_date', { ascending: true });
  if (error) return [];
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
  if (reportsError || !reports || reports.length === 0) return [];

  const reportIds = reports.map((r) => r.id);
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .in('owner_id', reportIds)
    .order('due_date', { ascending: true });
  if (error) return [];
  return data;
}

/**
 * @param {{ title: string, description?: string, dueDate: string, ownerId: string }} form
 * @param {any} [client]
 */
export async function createTask(form, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const { title, description, dueDate, ownerId } = form;
  const { data, error } = await client
    .from('tasks')
    .insert({
      title,
      description: description || null,
      due_date: dueDate,
      owner_id: ownerId,
      created_by: ownerId,
    })
    .select()
    .single();
  return { data, error };
}

/**
 * Setting status to 'completed' clears any blocked/blocked_reason on the
 * task (matches the prototype's existing behavior); any other status
 * leaves blocked/blocked_reason untouched.
 * @param {any} [client]
 */
export async function setTaskStatus(taskId, status, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const patch = status === 'completed' ? { status, blocked: false, blocked_reason: null } : { status };
  const { data, error } = await client.from('tasks').update(patch).eq('id', taskId).select().single();
  return { data, error };
}

/**
 * @param {{ id: string, status: string }} task
 * @param {any} [client]
 */
export async function toggleTaskDone(task, client = supabase) {
  const nextStatus = task.status === 'completed' ? 'planned' : 'completed';
  return setTaskStatus(task.id, nextStatus, client);
}
