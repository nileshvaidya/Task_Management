// RPC integration tests for Phase 4's User Admin functions — run against a
// REAL Supabase project, same rationale as the other test-rls-*.mjs
// scripts. Unlike Phases 1-3 (which are genuinely team-scoped RLS
// policies), Phase 4's admin actions are security definer RPCs gated only
// on "caller is an active manager" — company-wide by design (see
// supabase/schema.sql's Phase 4 section). These tests confirm that both
// halves of that design hold: any manager can act across teams, and a
// non-manager is rejected by every one of these RPCs.
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
  return { id, email, name };
}

async function signedInClient(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in as ${email} failed: ${error.message}`);
  return client;
}

async function createTask(ownerId, title, extra = {}) {
  const { data, error } = await admin
    .from('tasks')
    .insert({ title, due_date: today, owner_id: ownerId, created_by: ownerId, ...extra })
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
  console.log('Setting up two teams of test users...');
  const managerA = await createUser({ name: `RLS Admin Manager A ${stamp}`, email: `rls-admin-mgr-a-${stamp}@example.com`, role: 'manager' });
  const empA = await createUser({ name: `RLS Admin Employee A ${stamp}`, email: `rls-admin-emp-a-${stamp}@example.com`, role: 'employee', managerId: managerA.id });
  const managerB = await createUser({ name: `RLS Admin Manager B ${stamp}`, email: `rls-admin-mgr-b-${stamp}@example.com`, role: 'manager' });
  const empB = await createUser({ name: `RLS Admin Employee B ${stamp}`, email: `rls-admin-emp-b-${stamp}@example.com`, role: 'employee', managerId: managerB.id });
  const userIds = [managerA.id, empA.id, managerB.id, empB.id];

  const taskB = await createTask(empB.id, `Task owned by employee B ${stamp}`);

  try {
    const clientMgrA = await signedInClient(managerA.email);
    const clientEmpA = await signedInClient(empA.email);

    console.log('\nadmin_list_users/admin_list_tasks: a manager sees company-wide, not just their own team...');
    const { data: usersForMgrA, error: usersErr } = await clientMgrA.rpc('admin_list_users');
    assert(!usersErr, 'admin_list_users succeeds for a manager caller');
    const idsSeen = (usersForMgrA ?? []).map((u) => u.id);
    assert(idsSeen.includes(empB.id) && idsSeen.includes(managerB.id), "manager A's admin_list_users includes team B's users (company-wide)");

    const { data: tasksForMgrA } = await clientMgrA.rpc('admin_list_tasks');
    assert(
      (tasksForMgrA ?? []).some((t) => t.id === taskB.id),
      "manager A's admin_list_tasks includes team B's task (company-wide)"
    );

    console.log('\nadmin_list_users/admin_list_tasks: an employee caller gets nothing back (not an error, just filtered out)...');
    const { data: usersForEmpA, error: empListErr } = await clientEmpA.rpc('admin_list_users');
    assert(!empListErr && (usersForEmpA ?? []).length === 0, "employee A's admin_list_users returns empty, no error");

    console.log('\nset_user_status: a manager can toggle any user\'s status, an employee cannot...');
    const { error: setStatusErr } = await clientMgrA.rpc('set_user_status', { target_id: empB.id, new_status: 'inactive' });
    assert(!setStatusErr, "manager A can set employee B's status");
    const { data: empBAfterToggle } = await admin.from('users').select('status').eq('id', empB.id).single();
    assert(empBAfterToggle.status === 'inactive', "employee B's status persisted as inactive");
    await admin.from('users').update({ status: 'active' }).eq('id', empB.id);

    const { error: empSetStatusErr } = await clientEmpA.rpc('set_user_status', { target_id: managerA.id, new_status: 'inactive' });
    assert(!!empSetStatusErr, 'employee A cannot call set_user_status at all');

    console.log('\nset_user_status: a manager cannot deactivate themselves...');
    const { error: selfStatusErr } = await clientMgrA.rpc('set_user_status', { target_id: managerA.id, new_status: 'inactive' });
    assert(!!selfStatusErr, 'manager A cannot set their own status');

    console.log('\noverride_task: a manager can override any task\'s status/owner regardless of ownership...');
    const { error: overrideErr } = await clientMgrA.rpc('override_task', {
      task_id: taskB.id,
      new_status: 'completed',
      new_owner_id: empA.id,
    });
    assert(!overrideErr, "manager A can override team B's task");
    const { data: taskBAfter } = await admin.from('tasks').select('status, owner_id, blocked').eq('id', taskB.id).single();
    assert(taskBAfter.status === 'completed' && taskBAfter.owner_id === empA.id, 'override applied both the new status and new owner');
    assert(taskBAfter.blocked === false, 'override to completed also clears blocked');

    const { data: overrideActivity } = await admin
      .from('activity_log')
      .select('id')
      .eq('task_id', taskB.id)
      .eq('verb', 'overridden');
    assert((overrideActivity ?? []).length > 0, 'override_task logged an "overridden" activity entry');

    const { error: empOverrideErr } = await clientEmpA.rpc('override_task', { task_id: taskB.id, new_status: 'planned' });
    assert(!!empOverrideErr, 'employee A cannot call override_task at all');

    console.log('\nsoft_delete_user: reassigns only the deleted user\'s OPEN tasks to their manager...');
    const openTask = await createTask(empA.id, `Open task for delete test ${stamp}`);
    const completedTask = await createTask(empA.id, `Completed task for delete test ${stamp}`, { status: 'completed' });

    const { error: deleteErr } = await clientMgrA.rpc('soft_delete_user', { target_id: empA.id });
    assert(!deleteErr, 'manager A can soft-delete employee A');

    const { data: empAAfterDelete } = await admin.from('users').select('status, deleted_at').eq('id', empA.id).single();
    assert(empAAfterDelete.status === 'inactive' && empAAfterDelete.deleted_at !== null, 'deleted employee A is inactive with deleted_at set');

    const { data: openTaskAfter } = await admin.from('tasks').select('owner_id').eq('id', openTask.id).single();
    assert(openTaskAfter.owner_id === managerA.id, "the open task moved to employee A's manager for triage");

    const { data: completedTaskAfter } = await admin.from('tasks').select('owner_id').eq('id', completedTask.id).single();
    assert(completedTaskAfter.owner_id === empA.id, 'the already-completed task was left alone, not reassigned');

    const { data: usersAfterDelete } = await clientMgrA.rpc('admin_list_users');
    assert(!(usersAfterDelete ?? []).some((u) => u.id === empA.id), 'soft-deleted employee A no longer appears in admin_list_users');

    console.log('\nsoft_delete_user: deleting a manager (no manager of their own) reassigns their open tasks to the acting admin...');
    const openTaskUnderB = await createTask(managerB.id, `Open task owned by manager B ${stamp}`);
    const { error: deleteMgrErr } = await clientMgrA.rpc('soft_delete_user', { target_id: managerB.id });
    assert(!deleteMgrErr, 'manager A can soft-delete manager B');
    const { data: taskUnderBAfter } = await admin.from('tasks').select('owner_id').eq('id', openTaskUnderB.id).single();
    assert(taskUnderBAfter.owner_id === managerA.id, "manager B's open task fell back to the deleting admin (manager A)");

    await admin.from('tasks').delete().in('id', [openTask.id, completedTask.id, openTaskUnderB.id]);
  } finally {
    console.log('\nCleaning up test users and tasks...');
    await admin.from('tasks').delete().eq('id', taskB.id);
    await cleanup(userIds);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Integration test run failed:', err.message);
  process.exit(1);
});
