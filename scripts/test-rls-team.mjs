// RLS integration tests for Phase 3's team scoping — team_member_ids(),
// activity_log, the "Team can view team tasks" policy, and the "Team can
// view teammate profiles" policy — run against a REAL Supabase project,
// same rationale as test-rls-users.mjs / test-rls-tasks.mjs. Confirms
// Phase 3 test case 5: a viewer only ever sees their own team, never
// company-wide, for either a manager or an employee caller.
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

async function createTask(ownerId, title) {
  const { data, error } = await admin
    .from('tasks')
    .insert({ title, due_date: today, owner_id: ownerId, created_by: ownerId })
    .select()
    .single();
  if (error) throw new Error(`createTask(${title}) failed: ${error.message}`);
  return data;
}

async function logActivity(actorId, verb, detail) {
  const { data, error } = await admin.from('activity_log').insert({ actor_id: actorId, verb, detail }).select().single();
  if (error) throw new Error(`logActivity(${actorId}) failed: ${error.message}`);
  return data;
}

async function cleanup(userIds) {
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

async function run() {
  console.log('Setting up two teams of test users...');
  const managerA = await createUser({ name: `RLS Team Manager A ${stamp}`, email: `rls-team-mgr-a-${stamp}@example.com`, role: 'manager' });
  const empA1 = await createUser({ name: `RLS Team Employee A1 ${stamp}`, email: `rls-team-emp-a1-${stamp}@example.com`, role: 'employee', managerId: managerA.id });
  const empA2 = await createUser({ name: `RLS Team Employee A2 ${stamp}`, email: `rls-team-emp-a2-${stamp}@example.com`, role: 'employee', managerId: managerA.id });
  const managerB = await createUser({ name: `RLS Team Manager B ${stamp}`, email: `rls-team-mgr-b-${stamp}@example.com`, role: 'manager' });
  const empB1 = await createUser({ name: `RLS Team Employee B1 ${stamp}`, email: `rls-team-emp-b1-${stamp}@example.com`, role: 'employee', managerId: managerB.id });
  const userIds = [managerA.id, empA1.id, empA2.id, managerB.id, empB1.id];

  const taskA1 = await createTask(empA1.id, `Task owned by A1 ${stamp}`);
  const taskA2 = await createTask(empA2.id, `Task owned by A2 ${stamp}`);
  const taskB1 = await createTask(empB1.id, `Task owned by B1 ${stamp}`);

  const activityA1 = await logActivity(empA1.id, 'created', `A1 created ${stamp}`);
  const activityMgrA = await logActivity(managerA.id, 'created', `Manager A created ${stamp}`);
  const activityB1 = await logActivity(empB1.id, 'created', `B1 created ${stamp}`);

  const taskIds = [taskA1.id, taskA2.id, taskB1.id];
  const activityIds = [activityA1.id, activityMgrA.id, activityB1.id];

  try {
    console.log('\nteam_member_ids(): symmetric for a manager and an employee caller...');
    const clientEmpA1 = await signedInClient(empA1.email);
    const clientMgrA = await signedInClient(managerA.email);
    const clientEmpB1 = await signedInClient(empB1.email);

    const { data: idsFromMgr } = await clientMgrA.rpc('team_member_ids', { uid: managerA.id });
    const { data: idsFromEmp } = await clientEmpA1.rpc('team_member_ids', { uid: empA1.id });
    const expectedTeamA = [managerA.id, empA1.id, empA2.id].sort();
    assert(
      JSON.stringify((idsFromMgr ?? []).sort()) === JSON.stringify(expectedTeamA),
      "team_member_ids as manager A returns manager A + both reports"
    );
    assert(
      JSON.stringify((idsFromEmp ?? []).sort()) === JSON.stringify(expectedTeamA),
      "team_member_ids as employee A1 returns the same team (symmetric)"
    );

    console.log("\nactivity_log: employee A1 sees their own team's entries, not team B's...");
    const { data: feedForEmpA1 } = await clientEmpA1.from('activity_log').select('id').in('id', activityIds);
    const feedIds = (feedForEmpA1 ?? []).map((r) => r.id).sort();
    assert(
      JSON.stringify(feedIds) === JSON.stringify([activityA1.id, activityMgrA.id].sort()),
      "employee A1's activity feed includes their own + manager A's entries, excludes team B's"
    );

    console.log("\nactivity_log: employee B1 cannot see team A's entries...");
    const { data: feedForEmpB1 } = await clientEmpB1.from('activity_log').select('id').in('id', activityIds);
    assert(
      JSON.stringify((feedForEmpB1 ?? []).map((r) => r.id).sort()) === JSON.stringify([activityB1.id]),
      "employee B1's activity feed includes only their own team's entry"
    );

    console.log("\ntasks: employee A1 can VIEW (not modify) sibling A2's task via the team policy...");
    const { data: siblingTask } = await clientEmpA1.from('tasks').select('id').eq('id', taskA2.id).single();
    assert(siblingTask?.id === taskA2.id, "employee A1 can select sibling A2's task");

    const { error: siblingUpdateError, count: siblingUpdateCount } = await clientEmpA1
      .from('tasks')
      .update({ status: 'in-progress' }, { count: 'exact' })
      .eq('id', taskA2.id);
    assert(
      !siblingUpdateError && siblingUpdateCount === 0,
      "employee A1's update attempt on sibling A2's task affects zero rows (view-only)"
    );
    const { data: taskA2Unchanged } = await admin.from('tasks').select('status').eq('id', taskA2.id).single();
    assert(taskA2Unchanged.status === 'planned', "sibling A2's task status was not changed by employee A1");

    console.log("\ntasks: employee A1 cannot see team B's task...");
    const { data: crossTeamTask } = await clientEmpA1.from('tasks').select('id').eq('id', taskB1.id);
    assert((crossTeamTask ?? []).length === 0, "employee A1 cannot select team B's task");

    console.log("\nusers: employee A1 can see teammate profiles (manager A + sibling A2)...");
    const { data: teammateProfiles } = await clientEmpA1.from('users').select('id').in('id', [managerA.id, empA2.id]);
    assert(
      JSON.stringify((teammateProfiles ?? []).map((r) => r.id).sort()) === JSON.stringify([managerA.id, empA2.id].sort()),
      'employee A1 can select both teammate profile rows'
    );

    console.log("\nusers: employee A1 cannot see team B's employee profile (managers are still publicly listable, employees are not)...");
    const { data: crossTeamEmployeeProfile } = await clientEmpA1.from('users').select('id').eq('id', empB1.id);
    assert((crossTeamEmployeeProfile ?? []).length === 0, "employee A1 cannot select team B's employee profile");
  } finally {
    console.log('\nCleaning up test users, tasks, and activity...');
    await admin.from('activity_log').delete().in('id', activityIds);
    await admin.from('tasks').delete().in('id', taskIds);
    await cleanup(userIds);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Integration test run failed:', err.message);
  process.exit(1);
});
