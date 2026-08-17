// Phase 4 — User Admin. Demo mode + page.route mocking of the RPC/Edge
// Function endpoints admin.js calls. Deep RLS/RPC authorization checks
// (Phase 4 test cases 3-6's "only a manager can do this") are covered by
// scripts/test-rls-admin.mjs against a real Supabase project; a mocked
// browser can't prove a Postgres security-definer function's own checks.
import { test, expect } from '@playwright/test';

const FIXTURE_USERS = [
  { id: 'demo-u1', name: 'Sarah Jenkins', email: 'sarah.j@company.com', role: 'manager', status: 'active', last_active: null, deleted_at: null },
  { id: 'demo-u2', name: 'David Chen', email: 'd.chen@company.com', role: 'employee', status: 'active', last_active: null, deleted_at: null },
  { id: 'demo-u3', name: 'Marcus Cole', email: 'marcus.cole@company.com', role: 'employee', status: 'inactive', last_active: null, deleted_at: null },
];

const FIXTURE_TASKS = [
  { id: 't1', title: 'Write Q3 report', owner_id: 'demo-u2', status: 'planned', blocked: false, blocked_reason: null },
];

async function mockAdminRpcs(page, { users = FIXTURE_USERS, tasks = FIXTURE_TASKS, projects = [], onRpc } = {}) {
  await page.route('**/rest/v1/rpc/admin_list_users**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users) })
  );
  await page.route('**/rest/v1/rpc/admin_list_tasks**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasks) })
  );
  // Phase 9's standalone Projects card fetches this alongside users/tasks
  // on every Admin load — unmocked, the placeholder Supabase host 403s and
  // the shared Promise.all rejects, breaking every test in this file.
  await page.route('**/rest/v1/projects**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) })
  );
  for (const fn of ['set_user_status', 'soft_delete_user', 'override_task']) {
    await page.route(`**/rest/v1/rpc/${fn}**`, (route) => {
      if (onRpc) onRpc(fn, route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
  }
}

test.describe('Phase 4 — role gating', () => {
  test('an employee visiting #/admin is redirected to the dashboard, not shown the Admin screen', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/?demoRole=employee#/admin');
    await expect(page.locator('[data-screen="dashboard"]')).toBeVisible();
    await expect(page.locator('[data-screen="admin"]')).toHaveCount(0);
    await expect(page.locator('a[data-nav="/admin"]')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('a manager sees the User Admin nav link and the Admin screen', async ({ page }) => {
    await mockAdminRpcs(page);
    await page.goto('/?demoRole=manager#/admin');
    await expect(page.locator('[data-screen="admin"]')).toBeVisible();
    await expect(page.getByText('User Management')).toBeVisible();
    await expect(page.getByText('Global Task Control')).toBeVisible();
  });
});

test.describe('Phase 4 — User Management table', () => {
  test('renders all fixture users with no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await mockAdminRpcs(page);

    await page.goto('/?demoRole=manager#/admin');
    await expect(page.locator('tr[data-user-row="demo-u1"]')).toContainText('Sarah Jenkins');
    await expect(page.locator('tr[data-user-row="demo-u2"]')).toContainText('David Chen');
    await expect(page.locator('tr[data-user-row="demo-u3"]')).toContainText('Marcus Cole');

    expect(errors).toEqual([]);
  });

  test('search filters the table live as the manager types', async ({ page }) => {
    await mockAdminRpcs(page);
    await page.goto('/?demoRole=manager#/admin');
    await expect(page.locator('tr[data-user-row="demo-u2"]')).toBeVisible();

    await page.fill('[data-role="user-search"]', 'marcus');
    await expect(page.locator('tr[data-user-row="demo-u3"]')).toBeVisible();
    await expect(page.locator('tr[data-user-row="demo-u2"]')).toHaveCount(0);
    await expect(page.locator('tr[data-user-row="demo-u1"]')).toHaveCount(0);
  });

  test('the signed-in manager\'s own row has no toggle/delete actions', async ({ page }) => {
    await mockAdminRpcs(page);
    await page.goto('/?demoRole=manager#/admin');
    const ownRow = page.locator('tr[data-user-row="demo-u1"]');
    await expect(ownRow.getByText('This is you')).toBeVisible();
    await expect(ownRow.locator('[data-action="toggle-status"]')).toHaveCount(0);
  });

  test('toggling active/inactive calls set_user_status with the target and flipped status', async ({ page }) => {
    let call = null;
    await mockAdminRpcs(page, { onRpc: (fn, body) => { if (fn === 'set_user_status') call = body; } });

    await page.goto('/?demoRole=manager#/admin');
    await page.click('tr[data-user-row="demo-u2"] [data-action="toggle-status"]');

    await expect.poll(() => call).toEqual({ target_id: 'demo-u2', new_status: 'inactive' });
  });

  test('delete requires an inline confirmation before calling soft_delete_user', async ({ page }) => {
    let called = false;
    await mockAdminRpcs(page, { onRpc: (fn) => { if (fn === 'soft_delete_user') called = true; } });

    await page.goto('/?demoRole=manager#/admin');
    const row = page.locator('tr[data-user-row="demo-u3"]');
    await row.locator('[data-action="delete-user"]').click();
    await expect(row.getByText('Delete this user?')).toBeVisible();
    expect(called).toBe(false);

    await row.locator('[data-action="confirm-delete"]').click();
    await expect.poll(() => called).toBe(true);
  });

  test('Cancel on the delete confirmation does not call soft_delete_user', async ({ page }) => {
    let called = false;
    await mockAdminRpcs(page, { onRpc: (fn) => { if (fn === 'soft_delete_user') called = true; } });

    await page.goto('/?demoRole=manager#/admin');
    const row = page.locator('tr[data-user-row="demo-u3"]');
    await row.locator('[data-action="delete-user"]').click();
    await row.locator('[data-action="cancel-delete"]').click();
    await expect(row.getByText('Delete this user?')).toHaveCount(0);
    expect(called).toBe(false);
  });
});

test.describe('Phase 4 — Add User dialog', () => {
  test('rejects submission with no role selected, without calling the invite function', async ({ page }) => {
    let invokeCalled = false;
    await mockAdminRpcs(page);
    await page.route('**/functions/v1/admin-invite-user**', (route) => {
      invokeCalled = true;
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{"data":{}}' });
    });

    await page.goto('/?demoRole=manager#/admin');
    await page.click('text=Add User');
    await page.fill('#add-user-name', 'New Hire');
    await page.fill('#add-user-email', 'new.hire@company.com');
    await page.click('[data-form="add-user"] button[type="submit"]');

    await expect(page.locator('[data-dialog="add-user"] [data-role="error"]')).toContainText(/role/i);
    expect(invokeCalled).toBe(false);
  });

  test('an employee role reveals the required "reports to" field', async ({ page }) => {
    await mockAdminRpcs(page);
    await page.goto('/?demoRole=manager#/admin');
    await page.click('text=Add User');

    await expect(page.locator('[data-role="manager-field"]')).toBeHidden();
    await page.selectOption('#add-user-role', 'employee');
    await expect(page.locator('[data-role="manager-field"]')).toBeVisible();
  });

  test('a valid submission invokes admin-invite-user and closes the dialog', async ({ page }) => {
    let invokeBody = null;
    await mockAdminRpcs(page);
    await page.route('**/functions/v1/admin-invite-user**', (route) => {
      invokeBody = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'new-id', name: invokeBody.name } }),
      });
    });

    await page.goto('/?demoRole=manager#/admin');
    await page.click('text=Add User');
    await page.fill('#add-user-name', 'New Hire');
    await page.fill('#add-user-email', 'new.hire@company.com');
    await page.selectOption('#add-user-role', 'manager');
    await page.click('[data-form="add-user"] button[type="submit"]');

    await expect(page.locator('[data-dialog="add-user"]')).toHaveCount(0);
    expect(invokeBody).toMatchObject({ name: 'New Hire', email: 'new.hire@company.com', role: 'manager' });
  });
});

test.describe('Phase 4 — Global Task Control OVERRIDE', () => {
  test('OVERRIDE reveals inline status/owner editors, Apply calls override_task', async ({ page }) => {
    let call = null;
    await mockAdminRpcs(page, { onRpc: (fn, body) => { if (fn === 'override_task') call = body; } });

    await page.goto('/?demoRole=manager#/admin');
    const row = page.locator('tr[data-task-row="t1"]');
    await expect(row.getByText('Write Q3 report')).toBeVisible();

    await row.locator('[data-action="start-override"]').click();
    await expect(row.locator('[data-role="override-status"]')).toBeVisible();

    await row.locator('[data-role="override-status"]').selectOption('completed');
    await row.locator('[data-action="apply-override"]').click();

    await expect.poll(() => call).toEqual({ task_id: 't1', new_status: 'completed', new_owner_id: 'demo-u2' });
  });

  test('Cancel on an OVERRIDE editor reverts to the plain status tag without calling override_task', async ({ page }) => {
    let called = false;
    await mockAdminRpcs(page, { onRpc: (fn) => { if (fn === 'override_task') called = true; } });

    await page.goto('/?demoRole=manager#/admin');
    const row = page.locator('tr[data-task-row="t1"]');
    await row.locator('[data-action="start-override"]').click();
    await row.locator('[data-action="cancel-override"]').click();

    await expect(row.locator('[data-role="override-status"]')).toHaveCount(0);
    await expect(row.getByText('Planned')).toBeVisible();
    expect(called).toBe(false);
  });
});
