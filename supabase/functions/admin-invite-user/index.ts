// "Add User" (Phase 4 test case 3) — creates a real Supabase Auth account
// (email invite) plus the matching public.users row. This is the one
// WorkSync action that genuinely needs the Admin API (auth.admin.*), which
// only ever works with the service-role key — never exposed to the
// browser, so it lives here instead of in src/admin.js's client-side RPC
// calls. Deploy once with `supabase functions deploy admin-invite-user`;
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY are injected
// automatically by the Supabase platform, no manual secret setup needed.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401);

  // Identify the caller from their own JWT (anon key + their token) — this
  // client cannot bypass RLS, it only tells us who is asking.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerAuth, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerAuth.user) return json({ error: 'Not authenticated.' }, 401);

  // Privileged client for everything else — the entire reason this action
  // is an Edge Function and not a client-side call.
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile, error: callerProfileError } = await admin
    .from('users')
    .select('role, status, deleted_at')
    .eq('id', callerAuth.user.id)
    .single();
  if (
    callerProfileError ||
    !callerProfile ||
    callerProfile.role !== 'manager' ||
    callerProfile.status !== 'active' ||
    callerProfile.deleted_at !== null
  ) {
    return json({ error: 'Only an active manager can add a user.' }, 403);
  }

  let body: { name?: string; email?: string; role?: string; managerId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const role = body.role;
  const managerId = body.managerId ?? null;

  if (!name) return json({ error: 'Name is required.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'A valid email is required.' }, 400);
  if (role !== 'manager' && role !== 'employee') return json({ error: 'Role must be manager or employee.' }, 400);
  if (role === 'employee' && !managerId) return json({ error: 'Employees must have a manager selected.' }, 400);

  if (role === 'employee') {
    const { data: managerRow, error: managerError } = await admin
      .from('users')
      .select('id, role, status, deleted_at')
      .eq('id', managerId)
      .single();
    if (
      managerError ||
      !managerRow ||
      managerRow.role !== 'manager' ||
      managerRow.status !== 'active' ||
      managerRow.deleted_at !== null
    ) {
      return json({ error: 'Selected manager is not a valid active manager.' }, 400);
    }
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited.user) {
    return json({ error: inviteError?.message ?? 'Failed to invite user.' }, 400);
  }

  const { data: profile, error: profileError } = await admin
    .from('users')
    .insert({
      id: invited.user.id,
      name,
      email,
      role,
      manager_id: role === 'employee' ? managerId : null,
      status: 'active',
    })
    .select()
    .single();

  if (profileError) {
    // Best-effort rollback so a failed profile insert doesn't leave an
    // orphaned auth.users row with no matching public.users profile.
    await admin.auth.admin.deleteUser(invited.user.id).catch(() => {});
    return json({ error: profileError.message }, 400);
  }

  return json({ data: profile }, 201);
});
