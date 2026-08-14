// Phase 3 — Team Feed & Team Overview. Demo mode (no live backend) plus
// page.route mocking of the Supabase REST/RPC endpoints team.js calls.
// Deep RLS scoping (Phase 3 test case 5 — a viewer only sees their own
// team, never company-wide) is covered by scripts/test-rls-team.mjs
// against a real Supabase project; a mocked browser can't prove that.
import { test, expect } from '@playwright/test';

async function mockTeamMemberIds(page, ids) {
  await page.route('**/rest/v1/rpc/team_member_ids**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ids) })
  );
}

async function mockActivity(page, entries) {
  await page.route('**/rest/v1/activity_log**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(entries) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function mockTasks(page, tasks) {
  await page.route('**/rest/v1/tasks**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasks) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function mockUsers(page, users) {
  await page.route('**/rest/v1/users**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Phase 3 — Team screen tabs (demo mode)', () => {
  test('Activity Feed tab renders team activity by default, no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockTeamMemberIds(page, []);
    await mockActivity(page, [
      {
        id: 'a1',
        actor: { name: 'Sarah Jenkins' },
        verb: 'created',
        detail: 'Write Q3 report',
        created_at: new Date().toISOString(),
      },
      {
        id: 'a2',
        actor: { name: 'David Chen' },
        verb: 'status_changed',
        detail: 'Write Q3 report → in-progress',
        created_at: new Date().toISOString(),
      },
    ]);
    await mockTasks(page, []);
    await mockUsers(page, []);

    await page.goto('/?demoRole=manager#/team');
    await expect(page.locator('[data-screen="team"]')).toBeVisible();
    const feedTab = page.locator('[data-tab="feed"]');
    await expect(feedTab).toBeVisible();
    await expect(feedTab.getByText('Sarah Jenkins')).toBeVisible();
    await expect(feedTab.getByText(/created a task/)).toBeVisible();
    await expect(feedTab.getByText('Write Q3 report', { exact: true })).toBeVisible();
    await expect(feedTab.getByText('Status Update')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('shows an empty state when the team has no activity yet', async ({ page }) => {
    await mockTeamMemberIds(page, []);
    await mockActivity(page, []);
    await mockTasks(page, []);
    await mockUsers(page, []);

    await page.goto('/?demoRole=manager#/team');
    await expect(page.getByText('No team activity yet.')).toBeVisible();
  });

  test('Team Overview tab shows Team Pulse, Blockers & Alerts, and per-member Today\'s Focus', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);

    await mockTeamMemberIds(page, ['demo-u1', 'demo-u2']);
    await mockActivity(page, []);
    await mockTasks(page, [
      { id: 't1', title: 'Completed task', owner_id: 'demo-u1', status: 'completed', due_date: today, blocked: false, blocked_reason: null },
      { id: 't2', title: 'Planned task', owner_id: 'demo-u1', status: 'planned', due_date: '2099-01-01', blocked: false, blocked_reason: null },
      {
        id: 't3',
        title: 'Blocked task',
        owner_id: 'demo-u2',
        status: 'in-progress',
        due_date: today,
        blocked: true,
        blocked_reason: 'David Chen — Design sign-off',
      },
    ]);
    await mockUsers(page, [
      { id: 'demo-u1', name: 'Sarah Jenkins', role: 'manager', status: 'active' },
      { id: 'demo-u2', name: 'David Chen', role: 'employee', status: 'active' },
    ]);

    await page.goto('/?demoRole=manager#/team');
    await page.click('label:has-text("Team Overview")');
    await expect(page.locator('[data-tab="overview"]')).toBeVisible();

    // Team Pulse: 1 of 3 tasks completed = 33%.
    await expect(page.getByText('33%')).toBeVisible();
    await expect(page.getByText('2 Tasks Active')).toBeVisible();
    await expect(page.getByText('1 Completed')).toBeVisible();

    // Blockers & Alerts.
    const blockersCard = page.locator('[data-role="blockers"]');
    await expect(blockersCard.getByText('Blocked task')).toBeVisible();
    await expect(blockersCard.getByText('David Chen — Design sign-off')).toBeVisible();

    // Per-member Today's Focus.
    const sarahCard = page.locator('[data-member-card="demo-u1"]');
    await expect(sarahCard.getByText('Completed task')).toBeVisible();
    const davidCard = page.locator('[data-member-card="demo-u2"]');
    await expect(davidCard.getByText('Blocked task')).toBeVisible();
  });
});

test.describe('Phase 3 — task creation logs activity', () => {
  test('creating a task also posts a "created" entry to activity_log', async ({ page }) => {
    let taskInsertBody = null;
    let activityInsertBody = null;

    // .select().single() expects a single JSON object back, not an
    // array-of-one — real PostgREST does this server-side when the client
    // sends Accept: application/vnd.pgrst.object+json (see phase2.spec.js's
    // mockTasksRoute, which returns '{}' for the same reason).
    await page.route('**/rest/v1/tasks**', (route) => {
      if (route.request().method() === 'POST') {
        taskInsertBody = route.request().postDataJSON();
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 't1', title: taskInsertBody.title, due_date: taskInsertBody.due_date }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/activity_log**', (route) => {
      if (route.request().method() === 'POST') {
        activityInsertBody = route.request().postDataJSON();
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'a1', ...activityInsertBody, created_at: new Date().toISOString() }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/?demoRole=manager#/dashboard');
    await page.click('text=+ New Task');
    await page.fill('#new-task-title-input', 'Write Q3 report');
    await page.click('[data-form="new-task"] button[type="submit"]');

    await expect(page.locator('[data-dialog="new-task"]')).toHaveCount(0);
    expect(taskInsertBody).toMatchObject({ title: 'Write Q3 report', owner_id: 'demo-u1', created_by: 'demo-u1' });
    expect(activityInsertBody).toMatchObject({
      actor_id: 'demo-u1',
      verb: 'created',
      task_id: 't1',
      detail: 'Write Q3 report',
    });
  });
});
