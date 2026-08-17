// RLS/RPC integration tests for Phase 5's dependency & acceptance
// mechanics — run against a REAL Supabase project, same rationale as the
// other test-rls-*.mjs scripts. These specifically cover what a mocked
// Playwright browser can't prove: the actual Postgres trigger/constraint
// behavior in supabase/schema.sql's Phase 5 section (check_assignee_active,
// tasks_accepted_status_check, clear_dependent_blocks) and the two RPCs
// that must work company-wide for any authenticated user, not just
// managers (list_assignable_users, list_all_tasks_for_dependency).
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

async function cleanup(userIds) {
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

async function run() {
  console.log('Setting up two teams of test users...');
  const managerA = await createUser({ name: `RLS Dep Manager A ${stamp}`, email: `rls-dep-mgr-a-${stamp}@example.com`, role: 'manager' });
  const empA = await createUser({ name: `RLS Dep Employee A ${stamp}`, email: `rls-dep-emp-a-${stamp}@example.com`, role: 'employee', managerId: managerA.id });
  const managerB = await createUser({ name: `RLS Dep Manager B ${stamp}`, email: `rls-dep-mgr-b-${stamp}@example.com`, role: 'manager' });
  const empB = await createUser({ name: `RLS Dep Employee B ${stamp}`, email: `rls-dep-emp-b-${stamp}@example.com`, role: 'employee', managerId: managerB.id });
  const userIds = [managerA.id, empA.id, managerB.id, empB.id];

  const clientEmpA = await signedInClient(empA.email);
  const clientEmpB = await signedInClient(empB.email);

  const taskIds = [];

  try {
    console.log('\nPreflight: checking public.is_active_user(uuid) is reachable and returns true for employee B...');
    const { data: preflightResult, error: preflightErr } = await clientEmpA.rpc('is_active_user', { uid: empB.id });
    if (preflightErr) {
      console.error('    (preflight error detail):', preflightErr.code, '-', preflightErr.message);
    } else {
      console.log('    is_active_user(empB) =', preflightResult);
    }

    console.log("\nCross-team assignment: employee A can create a task assigned to employee B (a different team) — RLS test case 2...");
    const { data: crossTask, error: crossErr } = await clientEmpA
      .from('tasks')
      .insert({ title: `Design sign-off ${stamp}`, due_date: today, owner_id: empB.id, created_by: empA.id })
      .select()
      .single();
    if (crossErr) console.error('    (insert error detail):', crossErr.code, '-', crossErr.message);
    assert(!crossErr && !!crossTask, 'employee A can insert a task assigned to employee B (cross-team)');
    if (!crossTask) {
      throw new Error('Cannot continue: the cross-team insert did not return a row, see error detail above.');
    }
    taskIds.push(crossTask.id);
    assert(crossTask.accepted === false, 'accepted defaults to false for a cross-assigned task (data model rule), regardless of what the client sent');

    console.log('\nSelf-owned tasks keep accepted = null...');
    const { data: selfTask } = await admin
      .from('tasks')
      .insert({ title: `Self task ${stamp}`, due_date: today, owner_id: empA.id, created_by: empA.id })
      .select()
      .single();
    taskIds.push(selfTask.id);
    assert(selfTask.accepted === null, 'accepted stays null for a self-owned task');

    console.log('\nAssignee-active guard: cannot assign a task to an inactive user (test case 10)...');
    await admin.from('users').update({ status: 'inactive' }).eq('id', empB.id);
    const { error: inactiveErr } = await clientEmpA
      .from('tasks')
      .insert({ title: `Should fail ${stamp}`, due_date: today, owner_id: empB.id, created_by: empA.id });
    assert(!!inactiveErr && /inactive/i.test(inactiveErr.message), 'inserting a task assigned to an inactive user fails with a readable error');
    await admin.from('users').update({ status: 'active' }).eq('id', empB.id);

    console.log('\nAcceptance gate: an unaccepted task cannot move off "planned" (test case 8)...');
    const { error: statusErr } = await clientEmpB.from('tasks').update({ status: 'in-progress' }).eq('id', crossTask.id);
    assert(!!statusErr, "employee B's attempt to move the unaccepted task to in-progress is rejected (DB constraint)");
    const { data: stillPlanned } = await admin.from('tasks').select('status').eq('id', crossTask.id).single();
    assert(stillPlanned.status === 'planned', 'task status remains planned after the rejected attempt');

    console.log('\nAcceptance: the assignee can accept, unlocking normal status changes (test case 7)...');
    const { error: acceptErr } = await clientEmpB.from('tasks').update({ accepted: true }).eq('id', crossTask.id);
    assert(!acceptErr, 'employee B can accept the task (set accepted=true) on their own row');
    const { error: nowOkErr } = await clientEmpB.from('tasks').update({ status: 'in-progress' }).eq('id', crossTask.id);
    assert(!nowOkErr, 'employee B can now move the task to in-progress after accepting');

    console.log('\nlist_assignable_users / list_all_tasks_for_dependency: callable by any employee, company-wide (test cases 2-3)...');
    const { data: assignable, error: assignableErr } = await clientEmpA.rpc('list_assignable_users');
    assert(!assignableErr, 'an employee (not just a manager) can call list_assignable_users');
    const assignableIds = (assignable ?? []).map((u) => u.id);
    assert(
      assignableIds.includes(managerB.id) && assignableIds.includes(empB.id),
      "list_assignable_users includes users outside the caller's own team"
    );

    const { data: depTasks, error: depTasksErr } = await clientEmpA.rpc('list_all_tasks_for_dependency');
    assert(!depTasksErr, 'an employee can call list_all_tasks_for_dependency');
    assert(
      (depTasks ?? []).some((t) => t.id === crossTask.id),
      "list_all_tasks_for_dependency includes tasks owned by users outside the caller's team"
    );

    console.log('\nAuto-unblock: completing a dependency clears blocked on the task that depends on it (test case 9)...');
    const { data: originalTask } = await admin
      .from('tasks')
      .insert({
        title: `Write report ${stamp}`,
        due_date: today,
        owner_id: empA.id,
        created_by: empA.id,
        depends_on_task_id: crossTask.id,
        status: 'in-progress',
        blocked: true,
        blocked_reason: `${empB.name} — Design sign-off`,
      })
      .select()
      .single();
    taskIds.push(originalTask.id);

    const { error: completeErr } = await clientEmpB.from('tasks').update({ status: 'completed' }).eq('id', crossTask.id);
    assert(!completeErr, 'employee B can complete the (now accepted) dependency task');

    const { data: originalAfter } = await admin
      .from('tasks')
      .select('blocked, blocked_reason')
      .eq('id', originalTask.id)
      .single();
    assert(
      originalAfter.blocked === false && originalAfter.blocked_reason === null,
      'the original task auto-unblocked when its dependency was completed'
    );

    const { data: unblockActivity } = await admin
      .from('activity_log')
      .select('id')
      .eq('task_id', originalTask.id)
      .eq('verb', 'unblocked');
    assert((unblockActivity ?? []).length > 0, 'an "unblocked" activity entry was logged for the original task');
  } finally {
    console.log('\nCleaning up test users and tasks...');
    if (taskIds.length > 0) await admin.from('tasks').delete().in('id', taskIds);
    await cleanup(userIds);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Integration test run failed:', err.message);
  process.exit(1);
});
