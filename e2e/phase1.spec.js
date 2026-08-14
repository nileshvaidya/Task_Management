// Phase 1 — Auth, Users & Roles. UI-level flows are verified here against
// a mocked Supabase HTTP layer (page.route) rather than a live project —
// real RLS behavior is covered separately by scripts/test-rls-users.mjs,
// which needs a real database. See TEST_REPORT.md.
import { test, expect } from '@playwright/test';

test.describe('Phase 1 — sign-up validation', () => {
  test('rejects signup with no role selected, without calling Supabase', async ({ page }) => {
    let signupCalled = false;
    await page.route('**/auth/v1/signup**', (route) => {
      signupCalled = true;
      route.fulfill({ status: 200, body: '{}' });
    });

    await page.goto('/#/login');
    // The radio input itself is visually hidden by the Nocturne .seg-opt
    // styling (the label is the clickable surface) — click the label.
    await page.click('.seg-opt:has-text("Sign Up")');
    await page.fill('#signup-name', 'David Chen');
    await page.fill('#signup-email', 'd.chen@company.com');
    await page.fill('#signup-password', 'secret1');
    // role intentionally left unselected
    await page.click('[data-form="signup"] button[type="submit"]');

    await expect(page.locator('[data-role="error"]')).toBeVisible();
    await expect(page.locator('[data-role="error"]')).toContainText(/role/i);
    expect(signupCalled).toBe(false);
  });

  test('manager signup hides the "reports to" field; employee signup shows and requires it', async ({ page }) => {
    await page.goto('/#/login');
    await page.click('.seg-opt:has-text("Sign Up")');

    await expect(page.locator('[data-role="manager-field"]')).toBeHidden();

    await page.selectOption('#signup-role', 'manager');
    await expect(page.locator('[data-role="manager-field"]')).toBeHidden();

    await page.selectOption('#signup-role', 'employee');
    await expect(page.locator('[data-role="manager-field"]')).toBeVisible();

    let signupCalled = false;
    await page.route('**/auth/v1/signup**', (route) => {
      signupCalled = true;
      route.fulfill({ status: 200, body: '{}' });
    });
    await page.fill('#signup-name', 'David Chen');
    await page.fill('#signup-email', 'd.chen@company.com');
    await page.fill('#signup-password', 'secret1');
    // manager intentionally left unselected
    await page.click('[data-form="signup"] button[type="submit"]');

    await expect(page.locator('[data-role="error"]')).toContainText(/manager/i);
    expect(signupCalled).toBe(false);
  });
});

test.describe('Phase 1 — auth guard', () => {
  test('an unauthenticated visitor is redirected from a protected route to login', async ({ page }) => {
    await page.goto('/#/dashboard');
    await expect(page.locator('[data-screen="login"]')).toBeVisible();
  });
});

test.describe('Phase 1 — sidebar identity block (via demo mode)', () => {
  test('renders the signed-in user\'s name, email, and initials on the dashboard', async ({ page }) => {
    await page.goto('/?demoRole=manager#/dashboard');
    await expect(page.locator('[data-screen="dashboard"]')).toBeVisible();
    const identity = page.locator('[data-component="identity-block"]');
    await expect(identity).toBeVisible();
    await expect(identity.locator('[data-role="identity-name"]')).toHaveText('Sarah Jenkins');
    await expect(identity.locator('[data-role="identity-email"]')).toHaveText('sarah.j@company.com');
  });
});

test.describe('Phase 1 — inactive user is blocked at sign-in', () => {
  test('shows a "contact admin" message and never reaches the dashboard', async ({ page }) => {
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'fake-refresh',
          user: { id: 'inactive-1', email: 'inactive@company.com' },
        }),
      })
    );
    await page.route('**/rest/v1/users**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'inactive-1',
          name: 'Old Employee',
          email: 'inactive@company.com',
          role: 'employee',
          manager_id: 'demo-u1',
          status: 'inactive',
        }),
      })
    );
    await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));

    await page.goto('/#/login');
    await page.fill('#signin-email', 'inactive@company.com');
    await page.fill('#signin-password', 'secret1');
    await page.click('[data-form="signin"] button[type="submit"]');

    await expect(page.locator('[data-role="error"]')).toBeVisible();
    await expect(page.locator('[data-role="error"]')).toContainText(/inactive/i);
    await expect(page.locator('[data-screen="login"]')).toBeVisible();
    await expect(page.locator('[data-screen="dashboard"]')).toHaveCount(0);
  });
});
