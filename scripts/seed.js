// Seeds demo users matching the design prototype: one manager (Sarah
// Jenkins) and two employees reporting to her (David Chen, Marcus Cole).
//
// Requires the Phase 1 schema (supabase/schema.sql — `users` table with
// role/manager_id) to be applied first; running this before then will fail
// with a "relation \"users\" does not exist" error from Postgres, which is
// expected in Phase 0.
//
// Uses the service_role key (admin-only, never expose it client-side) to
// create real Supabase Auth users, matching the handoff brief's explicit
// requirement that "Add User" creates a real Auth invite, not a stub row.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Set them in .env (see .env.example) — the service role key is only ' +
      'ever used from this trusted script, never shipped to the browser.'
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'WorkSync-Demo-2026!';

const SEED_USERS = [
  { name: 'Sarah Jenkins', email: 'sarah.j@company.com', role: 'manager', managerEmail: null },
  { name: 'David Chen', email: 'd.chen@company.com', role: 'employee', managerEmail: 'sarah.j@company.com' },
  { name: 'Marcus Cole', email: 'm.cole@company.com', role: 'employee', managerEmail: 'sarah.j@company.com' },
];

async function createAuthUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function seed() {
  const idByEmail = {};

  for (const u of SEED_USERS.filter((u) => !u.managerEmail)) {
    const authUser = await createAuthUser(u.email);
    idByEmail[u.email] = authUser.id;
    const { error } = await admin
      .from('users')
      .insert({ id: authUser.id, name: u.name, email: u.email, role: u.role, manager_id: null });
    if (error) throw error;
    console.log(`Seeded manager: ${u.name} <${u.email}>`);
  }

  for (const u of SEED_USERS.filter((u) => u.managerEmail)) {
    const authUser = await createAuthUser(u.email);
    idByEmail[u.email] = authUser.id;
    const { error } = await admin.from('users').insert({
      id: authUser.id,
      name: u.name,
      email: u.email,
      role: u.role,
      manager_id: idByEmail[u.managerEmail],
    });
    if (error) throw error;
    console.log(`Seeded employee: ${u.name} <${u.email}> (reports to ${u.managerEmail})`);
  }

  console.log(`\nDone. Demo password for all seeded users: ${DEMO_PASSWORD}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
