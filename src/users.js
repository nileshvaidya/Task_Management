// Team membership queries, separate from auth.js (which owns the
// session/profile/sign-in-up flows). "Team can view teammate profiles" RLS
// (supabase/schema.sql) permits selecting the rows below, but a plain
// unfiltered `select *` on `users` would also surface every other active
// manager company-wide — a separate Phase 1 policy exists so the sign-up
// form's "report to" picker can list them. Filtering explicitly by
// team_member_ids here is what keeps this query scoped to the caller's own
// team (Phase 3 test case 5), not just "whatever RLS lets through".
import { supabase } from './api.js';

/**
 * All users sharing `callerId`'s team (per team_root in
 * supabase/schema.sql) — the manager plus their direct reports, seen the
 * same way whether the caller is the manager or one of the reports.
 * @param {string} callerId
 * @param {any} [client]
 */
export async function fetchTeamMembers(callerId, client = supabase) {
  if (!client) return [];
  const { data: ids, error: idsError } = await client.rpc('team_member_ids', { uid: callerId });
  if (idsError) throw idsError;
  if (!ids || ids.length === 0) return [];

  const { data, error } = await client.from('users').select('*').in('id', ids).order('name');
  if (error) throw error;
  return data;
}
