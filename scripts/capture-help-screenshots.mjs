// One-off content-generation tool for the in-app Help manual
// (src/screens/help.js) — captures real screenshots of every screen/dialog
// in demo mode (mocked network responses, no live Supabase project
// needed) into public/help/screenshots/. Not part of the test suite; rerun
// manually (`node scripts/capture-help-screenshots.mjs`) whenever the UI
// changes enough that the manual's screenshots go stale. Needs the dev
// server already running (`npm run dev` with VITE_DEMO_MODE=true) — see
// the npm script wiring in package.json.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.HELP_SHOTS_BASE_URL || 'http://localhost:5173';
const OUT_DIR = fileURLToPath(new URL('../public/help/screenshots/', import.meta.url));
const VIEWPORT = { width: 1280, height: 800 };
const TALL_VIEWPORT = { width: 1280, height: 1080 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const TODAY = new Date().toISOString().slice(0, 10);
function daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const USERS = [
  { id: 'demo-u1', name: 'Sarah Jenkins', email: 'sarah.j@company.com', role: 'manager', status: 'active', last_active: new Date().toISOString() },
  { id: 'demo-u2', name: 'David Chen', email: 'd.chen@company.com', role: 'employee', status: 'active', last_active: new Date().toISOString() },
  { id: 'demo-u3', name: 'Marcus Cole', email: 'm.cole@company.com', role: 'employee', status: 'active', last_active: new Date().toISOString() },
];

const MANAGER_TASKS = [
  { id: 'ss-t1', title: 'Update Q3 Financial Model', description: '', status: 'in-progress', due_date: TODAY, owner_id: 'demo-u1', created_by: 'demo-u1', priority: 'high', blocked: false, blocked_reason: null, accepted: null },
  { id: 'ss-t2', title: 'Review vendor contracts', description: '', status: 'planned', due_date: daysFromToday(2), owner_id: 'demo-u1', created_by: 'demo-u1', priority: 'medium', blocked: false, blocked_reason: null, accepted: null },
  { id: 'ss-t3', title: 'Prepare board deck', description: '', status: 'completed', due_date: daysFromToday(-1), owner_id: 'demo-u1', created_by: 'demo-u1', priority: 'low', blocked: false, blocked_reason: null, accepted: null },
  { id: 'ss-t4', title: 'Sign off on packaging design', description: '', status: 'planned', due_date: daysFromToday(1), owner_id: 'demo-u1', created_by: 'demo-u2', priority: 'high', blocked: false, blocked_reason: null, accepted: false },
];

const TEAM_TASKS = [
  ...MANAGER_TASKS,
  { id: 'ss-t5', title: 'Calibrate production line 2', description: '', status: 'in-progress', due_date: TODAY, owner_id: 'demo-u2', created_by: 'demo-u2', priority: 'high', blocked: true, blocked_reason: 'Marcus Cole — Waiting on parts shipment', accepted: null },
  { id: 'ss-t6', title: 'Waiting on parts shipment', description: '', status: 'planned', due_date: daysFromToday(3), owner_id: 'demo-u3', created_by: 'demo-u2', priority: 'medium', blocked: false, blocked_reason: null, accepted: false },
  { id: 'ss-t7', title: 'Weekly safety inspection', description: '', status: 'completed', due_date: daysFromToday(-2), owner_id: 'demo-u3', created_by: 'demo-u3', priority: 'medium', blocked: false, blocked_reason: null, accepted: null },
];

const ACTIVITY = [
  { id: 'a1', actor: { name: 'Sarah Jenkins' }, verb: 'created', task_id: 'ss-t1', detail: 'Update Q3 Financial Model', created_at: new Date(Date.now() - 3600e3).toISOString() },
  { id: 'a2', actor: { name: 'David Chen' }, verb: 'status_changed', task_id: 'ss-t5', detail: 'Calibrate production line 2 → in-progress', created_at: new Date(Date.now() - 7200e3).toISOString() },
  { id: 'a3', actor: { name: 'Marcus Cole' }, verb: 'blocked', task_id: 'ss-t5', detail: 'Marcus Cole — Waiting on parts shipment', created_at: new Date(Date.now() - 10800e3).toISOString() },
  { id: 'a4', actor: { name: 'Marcus Cole' }, verb: 'accepted', task_id: 'ss-t6', detail: 'Waiting on parts shipment', created_at: new Date(Date.now() - 14400e3).toISOString() },
];

const PROJECTS = [
  { id: 'p1', name: 'Q3 Planning' },
  { id: 'p2', name: 'Line 2 Upgrade' },
];

async function mockCommonRoutes(page) {
  await page.route('**/rest/v1/rpc/team_member_ids**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['demo-u1', 'demo-u2', 'demo-u3']) })
  );
  await page.route('**/rest/v1/users**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USERS) })
  );
  await page.route('**/rest/v1/activity_log**', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ACTIVITY) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/rest/v1/projects**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROJECTS) }));
  await page.route('**/rest/v1/rpc/list_assignable_users**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USERS.map((u) => ({ id: u.id, name: u.name }))) })
  );
  await page.route('**/rest/v1/rpc/list_all_tasks_for_dependency**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TEAM_TASKS.map((t) => ({ id: t.id, title: t.title, owner_id: t.owner_id, owner_name: USERS.find((u) => u.id === t.owner_id)?.name, status: t.status }))),
    })
  );
  await page.route('**/rest/v1/rpc/admin_list_users**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USERS) }));
  await page.route('**/rest/v1/rpc/admin_list_tasks**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TEAM_TASKS) }));
}

async function mockTasksRoute(page, tasksForOwner) {
  await page.route('**/rest/v1/tasks**', (route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 200, body: '{}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasksForOwner) });
  });
}

async function shot(page, name, { fullPage = false } = {}) {
  await page.screenshot({ path: `${OUT_DIR}${name}.png`, fullPage });
  console.log('captured', name);
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });

  // 1. Login screen — Sign In
  {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(`${BASE_URL}/#/login`);
    await page.waitForSelector('[data-screen="login"]');
    await shot(page, '01-login-signin');

    // Sign Up tab, employee role (shows the "Reports to" field)
    await page.click('label:has-text("Sign Up")');
    await page.fill('#signup-name', 'Alex Rivera');
    await page.fill('#signup-email', 'alex.rivera@company.com');
    await page.selectOption('#signup-role', 'employee');
    await shot(page, '02-login-signup');
    await page.close();
  }

  // 2. Dashboard — manager
  {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await mockCommonRoutes(page);
    await mockTasksRoute(page, MANAGER_TASKS);
    await page.goto(`${BASE_URL}/?demoRole=manager#/dashboard`);
    await page.waitForSelector('[data-screen="dashboard"]');
    await page.waitForTimeout(300);
    await shot(page, '03-dashboard-manager');

    // New Task dialog — basic
    await page.click('text=+ New Task');
    await page.waitForSelector('[data-dialog="new-task"]');
    await page.fill('#new-task-title-input', 'Finalize supplier agreement');
    await shot(page, '04-new-task-basic');
    await page.click('[data-action="close"]');
    await page.close();
  }

  // 2b. New Task dialog — dependency section (taller viewport so the whole
  // scrollable dialog fits without needing to scroll mid-screenshot)
  {
    const page = await browser.newPage({ viewport: TALL_VIEWPORT });
    await mockCommonRoutes(page);
    await mockTasksRoute(page, MANAGER_TASKS);
    await page.goto(`${BASE_URL}/?demoRole=manager#/dashboard`);
    await page.waitForSelector('[data-screen="dashboard"]');
    await page.click('text=+ New Task');
    await page.waitForSelector('[data-dialog="new-task"]');
    await page.fill('#new-task-title-input', 'Finalize supplier agreement');
    await page.click('[data-action="toggle-has-dependency"]');
    await page.waitForTimeout(200);
    await page.fill('#new-task-dep-title', 'Legal review of terms');
    await page.selectOption('#new-task-dep-assignee', 'demo-u2');
    await page.check('#new-task-requires-acceptance');
    await shot(page, '05-new-task-dependency');
    await page.close();
  }

  // 3. Dashboard — employee, with a pending-acceptance task visible
  {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await mockCommonRoutes(page);
    await mockTasksRoute(page, [MANAGER_TASKS[3], TEAM_TASKS[4]]); // includes ss-t4 (pending acceptance for David)
    await page.goto(`${BASE_URL}/?demoRole=employee#/dashboard`);
    await page.waitForSelector('[data-screen="dashboard"]');
    await page.waitForTimeout(300);
    await shot(page, '06-dashboard-employee-pending-acceptance');
    await page.close();
  }

  // 4. Team screen — Activity Feed + Team Overview
  {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await mockCommonRoutes(page);
    await mockTasksRoute(page, TEAM_TASKS);
    await page.goto(`${BASE_URL}/?demoRole=manager#/team`);
    await page.waitForSelector('[data-screen="team"]');
    await page.waitForTimeout(300);
    await shot(page, '07-team-activity-feed');

    await page.click('label:has-text("Team Overview")');
    await page.waitForTimeout(200);
    await shot(page, '08-team-overview');
    await page.close();
  }

  // 5. Admin screen — User Management + Global Task Control
  {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await mockCommonRoutes(page);
    await page.goto(`${BASE_URL}/?demoRole=manager#/admin`);
    await page.waitForSelector('[data-screen="admin"]');
    await page.waitForTimeout(300);
    await shot(page, '09-admin-user-management', { fullPage: true });

    await page.click('text=Add User');
    await page.waitForSelector('[data-dialog="add-user"]');
    await page.fill('#add-user-name', 'Priya Nair');
    await page.fill('#add-user-email', 'priya.nair@company.com');
    await shot(page, '10-admin-add-user');
    await page.close();
  }

  // 6. Mobile viewport — bottom tab bar
  {
    const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
    await mockCommonRoutes(page);
    await mockTasksRoute(page, MANAGER_TASKS);
    await page.goto(`${BASE_URL}/?demoRole=manager#/dashboard`);
    await page.waitForSelector('[data-screen="dashboard"]');
    await page.waitForTimeout(300);
    await shot(page, '11-mobile-dashboard');
    await page.close();
  }

  await browser.close();
  console.log('Done. Screenshots written to', OUT_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
