// Admin data layer: User Management + Global Task Control (Phase 4).
// Company-wide, manager-gated — see supabase/schema.sql's Phase 4 section
// for why this is the one deliberately elevated-privilege surface, unlike
// the team-scoped Dashboard/Team data layers. Mirrors tasks.js/activity.js's
// injectable-client, no-throw shape.
import { supabase } from './api.js';

/** @param {any} [client] */
export async function fetchAdminUsers(client = supabase) {
  if (!client) return [];
  const { data, error } = await client.rpc('admin_list_users');
  if (error) throw error;
  return data;
}

/** @param {any} [client] */
export async function fetchAdminTasks(client = supabase) {
  if (!client) return [];
  const { data, error } = await client.rpc('admin_list_tasks');
  if (error) throw error;
  return data;
}

/**
 * Calls the admin-invite-user Edge Function — the one admin action that
 * needs the Auth Admin API (service-role only), so it can't be a plain RPC
 * like the others below (see supabase/functions/admin-invite-user).
 * @param {{ name: string, email: string, role: string, managerId?: string }} form
 * @param {any} [client]
 */
export async function inviteUser(form, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const { data, error } = await client.functions.invoke('admin-invite-user', { body: form });
  if (error) return { data: null, error: { message: error.message || 'Failed to invite user.' } };
  return { data: data?.data ?? null, error: null };
}

/**
 * @param {string} targetId
 * @param {'active'|'inactive'} status
 * @param {any} [client]
 */
export async function setUserStatus(targetId, status, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const { data, error } = await client.rpc('set_user_status', { target_id: targetId, new_status: status });
  return { data, error };
}

/**
 * @param {string} targetId
 * @param {any} [client]
 */
export async function softDeleteUser(targetId, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const { data, error } = await client.rpc('soft_delete_user', { target_id: targetId });
  return { data, error };
}

/**
 * @param {string} taskId
 * @param {string} newStatus
 * @param {string|null} [newOwnerId]
 * @param {any} [client]
 */
export async function overrideTask(taskId, newStatus, newOwnerId = null, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const { data, error } = await client.rpc('override_task', {
    task_id: taskId,
    new_status: newStatus,
    new_owner_id: newOwnerId,
  });
  return { data, error };
}
