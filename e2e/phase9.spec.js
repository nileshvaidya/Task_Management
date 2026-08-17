// Phase 9 — manager task deletion, standalone project creation, and brand
// refresh (checklist icon + company name). Demo mode + page.route mocking,
// same approach as every other phase's e2e suite. Deep RLS authorization
// (a manager deleting a report's task vs. an employee being denied) is a
// Postgres policy decision a mocked browser can't prove — that's for a
// scripts/test-rls-*.mjs script against a real Supabase project, not here.
import { test, expect } from '@playwright/test';

test.describe('Phase 9 — manager task deletion (Dashboard)', () => {
  test('a manager can delete their own task after an inline confirmation', async ({ page }) => {
    let tasks = [
      { id: 't1', title: 'Write Q3 report', status: 'planned', due_date: '2026-08-20', owner_id: 'demo-u1', blocked: false, blocked_reason: null },
    ];
    let deleteCalled = false;

    await page.route('**/rest/v1/tasks**', (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasks) });
      }
      if (method === 'DELETE') {
        deleteCalled = true;
        tasks = [];
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/?demoRole=manager#/dashboard');
    const row = page.locator('div.task-row[data-task-id="t1"]');
    await expect(row).toBeVisible();

    await row.locator('[data-action="delete-task"]').click();
    await expect(row.getByText('Delete?')).toBeVisible();
    expect(deleteCalled).toBe(false);

    await row.locator('[data-action="confirm-delete-task"]').click();
    await expect.poll(() => deleteCalled).toBe(true);
    await expect(page.locator('div.task-row[data-task-id="t1"]')).toHaveCount(0);
  });

  test('Cancel on the delete confirmation leaves the task alone', async ({ page }) => {
    const tasks = [
      { id: 't1', title: 'Write Q3 report', status: 'planned', due_date: '2026-08-20', owner_id: 'demo-u1', blocked: false, blocked_reason: null },
    ];
    let deleteCalled = false;

    await page.route('**/rest/v1/tasks**', (route) => {
      const method = route.request().method();
      if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasks) });
      if (method === 'DELETE') deleteCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/?demoRole=manager#/dashboard');
    const row = page.locator('div.task-row[data-task-id="t1"]');
    await row.locator('[data-action="delete-task"]').click();
    await row.locator('[data-action="cancel-delete-task"]').click();

    await expect(row.getByText('Delete?')).toHaveCount(0);
    await expect(page.locator('div.task-row[data-task-id="t1"]')).toBeVisible();
    expect(deleteCalled).toBe(false);
  });

  test('a manager can also delete a direct report\'s task from the "My Team" filter', async ({ page }) => {
    let tasks = [
      { id: 't2', title: 'Calibrate line 2', status: 'planned', due_date: '2026-08-21', owner_id: 'demo-u2', blocked: false, blocked_reason: null },
    ];
    let deleteCalled = false;

    await page.route('**/rest/v1/tasks**', (route) => {
      const method = route.request().method();
      if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasks) });
      if (method === 'DELETE') {
        deleteCalled = true;
        tasks = [];
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/users**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'demo-u2', name: 'David Chen' }]) })
    );

    await page.goto('/?demoRole=manager#/dashboard');
    await page.click('label:has-text("My Team")');
    const row = page.locator('div.task-row[data-task-id="t2"]');
    await expect(row).toBeVisible();

    await row.locator('[data-action="delete-task"]').click();
    await row.locator('[data-action="confirm-delete-task"]').click();
    await expect.poll(() => deleteCalled).toBe(true);
  });

  test('an employee sees no delete action on their own tasks', async ({ page }) => {
    const tasks = [
      { id: 't1', title: 'Write Q3 report', status: 'planned', due_date: '2026-08-20', owner_id: 'demo-u2', blocked: false, blocked_reason: null },
    ];
    await page.route('**/rest/v1/tasks**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasks) }));

    await page.goto('/?demoRole=employee#/dashboard');
    await expect(page.locator('div.task-row[data-task-id="t1"]')).toBeVisible();
    await expect(page.locator('[data-action="delete-task"]')).toHaveCount(0);
  });
});

test.describe('Phase 9 — standalone Project creation (Admin screen)', () => {
  async function mockAdminScreen(page, { projects = [] } = {}) {
    await page.route('**/rest/v1/rpc/admin_list_users**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/rpc/admin_list_tasks**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/projects**', (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'p-new', name: body.name }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) });
    });
  }

  test('a manager can create a project directly from Admin, without opening the New Task dialog', async ({ page }) => {
    await mockAdminScreen(page);
    await page.goto('/?demoRole=manager#/admin');
    await expect(page.locator('[data-role="projects-card"]')).toBeVisible();
    await expect(page.getByText('No projects yet.')).toBeVisible();

    await page.fill('[data-role="new-project-name"]', 'Line 3 Expansion');
    await page.click('[data-form="add-project"] button[type="submit"]');

    await expect(page.locator('[data-role="project-list"]')).toContainText('Line 3 Expansion');
    await expect(page.locator('[data-dialog="new-task"]')).toHaveCount(0);
  });

  test('an existing project list renders as tags', async ({ page }) => {
    await mockAdminScreen(page, { projects: [{ id: 'p1', name: 'Q3 Planning' }] });
    await page.goto('/?demoRole=manager#/admin');
    await expect(page.locator('[data-role="project-list"]')).toContainText('Q3 Planning');
  });
});

test.describe('Phase 9 — brand refresh', () => {
  test('the company name is visible on the login screen', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.locator('[data-screen="login"]')).toContainText('ASK Info-Solutions LLP');
  });

  test('the company name is visible in the signed-in app shell', async ({ page }) => {
    await page.route('**/rest/v1/tasks**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/?demoRole=manager#/dashboard');
    await expect(page.locator('aside')).toContainText('ASK Info-Solutions LLP');
  });

  test('the regenerated checklist icon files are served', async ({ page }) => {
    // The manifest itself is only generated by `vite build` (vite-plugin-pwa
    // has devOptions.enabled left at its default false), so this can't
    // fetch /manifest.webmanifest against the dev server the e2e suite runs
    // against — it checks the underlying icon files public/ serves as-is
    // instead, which is what actually changed in this phase.
    await page.goto('/#/login');
    for (const path of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png']) {
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
    }
  });
});
