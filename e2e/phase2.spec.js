// Phase 2 — Task CRUD & Dashboard. Uses demo mode (no live backend needed)
// for rendering/UI checks, and page.route mocking for the one flow that
// needs a network round trip. Full CRUD logic is unit-tested in
// src/tasks.test.js and src/components.test.js (renderTaskRow); this file
// covers what only a real browser can prove.
import { test, expect } from '@playwright/test';

test.describe('Phase 2 — Dashboard smoke test (demo mode)', () => {
  test('renders all four Dashboard cards for a signed-in user with no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/?demoRole=manager#/dashboard');
    await expect(page.locator('[data-screen="dashboard"]')).toBeVisible();
    await expect(page.getByText('Plan Today')).toBeVisible();
    await expect(page.getByText('Active Tasks')).toBeVisible();
    await expect(page.getByText('Weekly Progress')).toBeVisible();
    await expect(page.getByText('Advance Planning')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('a manager sees the My Team / Mine filter; an employee does not', async ({ page }) => {
    await page.goto('/?demoRole=manager#/dashboard');
    await expect(page.getByText('My Team')).toBeVisible();

    await page.goto('/?demoRole=employee#/dashboard');
    await expect(page.locator('[data-screen="dashboard"]')).toBeVisible();
    await expect(page.getByText('My Team')).toHaveCount(0);
  });
});

test.describe('Phase 2 — responsive layout (real CSS breakpoints, not a device toggle)', () => {
  test('mobile viewport shows the bottom tab bar and hides the desktop sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/?demoRole=manager#/dashboard');
    await expect(page.locator('[data-screen="dashboard"]')).toBeVisible();

    await expect(page.locator('aside')).not.toBeVisible();
    await expect(page.locator('a[data-nav="/dashboard"]').last()).toBeVisible();
  });

  test('desktop viewport shows the sidebar and hides the bottom tab bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/?demoRole=manager#/dashboard');
    await expect(page.locator('[data-screen="dashboard"]')).toBeVisible();

    await expect(page.locator('aside')).toBeVisible();
    await expect(page.getByText('+ New Task')).toBeVisible();
  });
});

test.describe('Phase 2 — New Task dialog', () => {
  // The dashboard's own background task-list fetch (GET) hits this same
  // /rest/v1/tasks path, so every route mock here must distinguish it from
  // the dialog's create call (POST) rather than matching the URL alone.
  async function mockTasksRoute(page, onInsert) {
    await page.route('**/rest/v1/tasks**', (route) => {
      if (route.request().method() === 'POST') {
        onInsert();
        return route.fulfill({ status: 200, body: '{}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }

  test('rejects a past date without calling Supabase', async ({ page }) => {
    let insertCalled = false;
    await mockTasksRoute(page, () => {
      insertCalled = true;
    });

    await page.goto('/?demoRole=manager#/dashboard');
    await page.click('text=+ New Task');
    await expect(page.locator('[data-dialog="new-task"]')).toBeVisible();

    await page.fill('#new-task-title-input', 'Retroactive task');
    // .fill() respects the date input's `min` (today) and won't accept an
    // earlier value; set it directly to simulate a value the JS validation
    // must still catch regardless of how it got there.
    await page.locator('#new-task-date').evaluate((el) => {
      el.value = '2020-01-01';
    });
    await page.click('[data-form="new-task"] button[type="submit"]');

    await expect(page.locator('[data-role="error"]')).toBeVisible();
    await expect(page.locator('[data-role="error"]')).toContainText(/past/i);
    expect(insertCalled).toBe(false);
  });

  test('rejects an empty title without calling Supabase', async ({ page }) => {
    let insertCalled = false;
    await mockTasksRoute(page, () => {
      insertCalled = true;
    });

    await page.goto('/?demoRole=manager#/dashboard');
    await page.click('text=+ New Task');
    await page.click('[data-form="new-task"] button[type="submit"]');

    await expect(page.locator('[data-role="error"]')).toContainText(/title/i);
    expect(insertCalled).toBe(false);
  });

  test('Cancel closes the dialog', async ({ page }) => {
    await page.goto('/?demoRole=manager#/dashboard');
    await page.click('text=+ New Task');
    await expect(page.locator('[data-dialog="new-task"]')).toBeVisible();
    await page.click('.dialog-actions button:has-text("Cancel")');
    await expect(page.locator('[data-dialog="new-task"]')).toHaveCount(0);
  });
});
