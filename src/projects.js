// Projects data layer — the New Task dialog's Project select (+New).
// Mirrors tasks.js/activity.js's shape (injectable client, plain return
// values, no throwing on expected failure paths).
import { supabase } from './api.js';

/** @param {any} [client] */
export async function fetchProjects(client = supabase) {
  if (!client) return [];
  const { data, error } = await client.from('projects').select('*').order('name');
  if (error) throw error;
  return data;
}

/**
 * @param {string} name
 * @param {any} [client]
 */
export async function createProject(name, client = supabase) {
  if (!client) return { data: null, error: { message: 'Supabase is not configured.' } };
  const { data, error } = await client.from('projects').insert({ name }).select().single();
  return { data, error };
}
