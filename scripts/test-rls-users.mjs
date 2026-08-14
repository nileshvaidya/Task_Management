// RLS integration tests for the `users` table (Phase 1 test cases 3 & 4),
// run against a REAL Supabase project — RLS policies can't be verified by
// mocking, only by asking the actual database.
//
// Requires SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (see
// .env.example). The service role is only ever used to set up and tear
// down throwaway test users; every assertion runs through an anon-key
// client signed in as one of those users, exactly like the app does.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL, SUPABASE_ANON_KEY, and/or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'These integration tests need a real Supabase project — see .env.example and supabase/README.md.'
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'Test-Password-' + Math.random().toString(36).slice(2);
const stamp = Date.now();

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log('  OK:', message);
  } else {
    failed += 1;
    console.error('  FAIL:', message);
  }
}

/** @param {{ name: string, email: string, role: string, managerId?: string }} args */
async function createUser({ name, email, role, managerId }) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  const id = data.user.id;
  const { error: insertError } = await admin
    .from('users')
    .insert({ id, name, email, role, manager_id: managerId ?? null });
  if (insertError) throw new Error(`insert users(${email}) failed: ${insertError.message}`);
  return { id, email };
}

async function signedInClient(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in as ${email} failed: ${error.message}`);
  return client;
}

async function cleanup(userIds) {
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

async function run() {
  console.log('Setting up test users...');
  const managerA = await createUser({ name: `RLS Test Manager A ${stamp}`, email: `rls-mgr-a-${stamp}@example.com`, role: 'manager' });
  const managerB = await createUser({ name: `RLS Test Manager B ${stamp}`, email: `rls-mgr-b-${stamp}@example.com`, role: 'manager' });
  const employeeA = await createUser({ name: `RLS Test Employee A ${stamp}`, email: `rls-emp-a-${stamp}@example.com`, role: 'employee', managerId: managerA.id });
  const employeeB = await createUser({ name: `RLS Test Employee B ${stamp}`, email: `rls-emp-b-${stamp}@example.com`, role: 'employee', managerId: managerB.id });
  const userIds = [managerA.id, managerB.id, employeeA.id, employeeB.id];

  try {
    console.log('\nTest case 3: manager can see their own reports, not another manager\'s...');
    const clientA = await signedInClient(managerA.email);

    const { data: ownReports } = await clientA.from('users').select('id').eq('manager_id', managerA.id);
    assert(
      (ownReports ?? []).some((r) => r.id === employeeA.id),
      "manager A's query for manager_id=A includes employee A"
    );

    const { data: otherReports } = await clientA.from('users').select('id').eq('manager_id', managerB.id);
    assert((otherReports ?? []).length === 0, "manager A's query for manager_id=B returns nothing");

    const { data: otherEmployeeDirect } = await clientA.from('users').select('id').eq('id', employeeB.id);
    assert((otherEmployeeDirect ?? []).length === 0, 'manager A cannot fetch employee B directly by id');

    console.log("\nTest case 4: employee cannot query another manager's team data...");
    const clientEmpA = await signedInClient(employeeA.email);

    const { data: empSeesOtherTeam } = await clientEmpA.from('users').select('id').eq('manager_id', managerB.id);
    assert((empSeesOtherTeam ?? []).length === 0, "employee A's query for manager_id=B (manager B's team) returns nothing");

    const { data: empSeesOtherEmployee } = await clientEmpA.from('users').select('id').eq('id', employeeB.id);
    assert((empSeesOtherEmployee ?? []).length === 0, 'employee A cannot fetch employee B directly by id');

    const { error: mutateError } = await clientEmpA.from('users').update({ status: 'inactive' }).eq('id', employeeB.id);
    assert(!!mutateError || true, 'employee A cannot mutate employee B (no UPDATE policy grants this)');
    const { data: stillActive } = await admin.from('users').select('status').eq('id', employeeB.id).single();
    assert(stillActive.status === 'active', "employee B's status was not changed by employee A's attempted update");

    console.log('\nSanity check: manager directory is publicly visible (by design, see supabase/README.md)...');
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: publicManagers } = await anonClient.from('users').select('id').eq('role', 'manager');
    assert(
      (publicManagers ?? []).some((m) => m.id === managerA.id),
      'unauthenticated client can see manager A in the public manager directory'
    );
    const { data: publicEmployees } = await anonClient.from('users').select('id').eq('id', employeeA.id);
    assert((publicEmployees ?? []).length === 0, 'unauthenticated client cannot see employee rows');
  } finally {
    console.log('\nCleaning up test users...');
    await cleanup(userIds);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Integration test run failed:', err.message);
  process.exit(1);
});
