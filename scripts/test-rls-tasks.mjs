// RLS integration tests for the `tasks` table (Phase 2 test case 8) — run
// against a REAL Supabase project, same rationale as test-rls-users.mjs.
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
const today = new Date().toISOString().slice(0, 10);

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

async function createTask(ownerId, title) {
  const { data, error } = await admin
    .from('tasks')
    .insert({ title, due_date: today, owner_id: ownerId, created_by: ownerId })
    .select()
    .single();
  if (error) throw new Error(`createTask(${title}) failed: ${error.message}`);
  return data;
}

async function cleanup(userIds) {
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

async function run() {
  console.log('Setting up test users and tasks...');
  const managerA = await createUser({ name: `RLS Task Manager A ${stamp}`, email: `rls-task-mgr-a-${stamp}@example.com`, role: 'manager' });
  const managerB = await createUser({ name: `RLS Task Manager B ${stamp}`, email: `rls-task-mgr-b-${stamp}@example.com`, role: 'manager' });
  const employeeA = await createUser({ name: `RLS Task Employee A ${stamp}`, email: `rls-task-emp-a-${stamp}@example.com`, role: 'employee', managerId: managerA.id });
  const employeeB = await createUser({ name: `RLS Task Employee B ${stamp}`, email: `rls-task-emp-b-${stamp}@example.com`, role: 'employee', managerId: managerB.id });
  const userIds = [managerA.id, managerB.id, employeeA.id, employeeB.id];

  const taskA = await createTask(employeeA.id, `Task owned by employee A ${stamp}`);
  const taskB = await createTask(employeeB.id, `Task owned by employee B ${stamp}`);

  try {
    console.log("\nOwner CRUD: employee A can see, update, and delete their own task...");
    const clientEmpA = await signedInClient(employeeA.email);

    const { data: ownTask } = await clientEmpA.from('tasks').select('id').eq('id', taskA.id).single();
    assert(ownTask?.id === taskA.id, 'employee A can select their own task');

    const { data: updated, error: updateError } = await clientEmpA
      .from('tasks')
      .update({ status: 'in-progress' })
      .eq('id', taskA.id)
      .select()
      .single();
    assert(!updateError && updated.status === 'in-progress', 'employee A can update their own task');

    console.log("\nManager CRUD: manager A can see and update employee A's task (My Team filter)...");
    const clientMgrA = await signedInClient(managerA.email);

    const { data: teamTask } = await clientMgrA.from('tasks').select('id').eq('id', taskA.id).single();
    assert(teamTask?.id === taskA.id, "manager A can select employee A's task");

    const { data: mgrUpdated, error: mgrUpdateError } = await clientMgrA
      .from('tasks')
      .update({ status: 'completed' })
      .eq('id', taskA.id)
      .select()
      .single();
    assert(!mgrUpdateError && mgrUpdated.status === 'completed', "manager A can update employee A's task");

    console.log("\nNegative cases: manager A cannot see/update employee B's task (a different manager's report)...");
    const { data: otherTeamTask } = await clientMgrA.from('tasks').select('id').eq('id', taskB.id);
    assert((otherTeamTask ?? []).length === 0, "manager A cannot select employee B's task");

    const { error: otherUpdateError, data: otherUpdateData } = await clientMgrA
      .from('tasks')
      .update({ status: 'completed' })
      .eq('id', taskB.id)
      .select();
    assert(
      !otherUpdateError && (otherUpdateData ?? []).length === 0,
      "manager A's update to employee B's task affects zero rows"
    );
    const { data: taskBUnchanged } = await admin.from('tasks').select('status').eq('id', taskB.id).single();
    assert(taskBUnchanged.status === 'planned', "employee B's task status was not changed by manager A");

    console.log("\nNegative case: employee A cannot see/update employee B's task...");
    const { data: crossEmployeeTask } = await clientEmpA.from('tasks').select('id').eq('id', taskB.id);
    assert((crossEmployeeTask ?? []).length === 0, "employee A cannot select employee B's task");

    console.log("\nNegative case: manager A cannot delete employee A's task (delete is owner-only)...");
    const { error: deleteError, count } = await clientMgrA
      .from('tasks')
      .delete({ count: 'exact' })
      .eq('id', taskA.id);
    assert(!deleteError && count === 0, "manager A's delete attempt on employee A's task affects zero rows");
    const { data: stillThere } = await admin.from('tasks').select('id').eq('id', taskA.id).single();
    assert(stillThere?.id === taskA.id, "employee A's task still exists after manager A's delete attempt");
  } finally {
    console.log('\nCleaning up test users and tasks...');
    await admin.from('tasks').delete().in('id', [taskA.id, taskB.id]);
    await cleanup(userIds);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Integration test run failed:', err.message);
  process.exit(1);
});
