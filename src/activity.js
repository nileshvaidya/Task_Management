// Activity log data layer. Mirrors tasks.js's shape (injectable client,
// plain return values, no throwing on expected failure paths).
import { supabase } from './api.js';

/**
 * @param {{ actorId: string, verb: string, taskId?: string|null, detail?: string }} entry
 * @param {any} [client]
 */
export async function logActivity(entry, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const { actorId, verb, taskId, detail } = entry;
  const { data, error } = await client
    .from('activity_log')
    .insert({ actor_id: actorId, verb, task_id: taskId || null, detail: detail || null })
    .select()
    .single();
  return { data, error };
}

/**
 * The signed-in user's own team activity, newest first. RLS scopes this to
 * their own team (see supabase/schema.sql's team_member_ids) — no client-side
 * filtering needed on top.
 * @param {any} [client]
 */
export async function fetchTeamActivity(client = supabase) {
  if (!client) return [];
  const { data, error } = await client
    .from('activity_log')
    .select('*, actor:actor_id(name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}
