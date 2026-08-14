// Phase 0 "STOP AND VERIFY" gate: the shell loads, routes correctly, and
// the Nocturne theme is actually applied (not just Tailwind defaults).
import { test, expect } from '@playwright/test';

test.describe('Phase 0 — foundation smoke test', () => {
  test('loads, redirects to the login placeholder, and renders the Nocturne theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/#\/login/);
    await expect(page.locator('[data-screen="login"]')).toBeVisible();

    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe('rgb(22, 24, 38)'); // --color-bg #161826

    // Phase 1 added a sign-up form (hidden by default) with its own
    // .btn-primary, so scope to the visible sign-in form's button.
    const btn = page.locator('[data-form="signin"] .btn-primary');
    await expect(btn).toBeVisible();
    const btnColor = await btn.evaluate((el) => getComputedStyle(el).color);
    expect(btnColor).toBe('rgb(145, 132, 217)'); // --color-accent #9184d9
  });

  test('hash router mounts the dashboard/team/admin screens for a signed-in user', async ({ page }) => {
    // Phase 1 added an auth guard on these routes, so authenticate via the
    // demo-mode dev helper (see e2e/phase1.spec.js) rather than anonymous.
    await page.goto('/?demoRole=manager#/dashboard');
    await expect(page.locator('[data-screen="dashboard"]')).toBeVisible();

    await page.goto('/?demoRole=manager#/team');
    await expect(page.locator('[data-screen="team"]')).toBeVisible();

    await page.goto('/?demoRole=manager#/admin');
    await expect(page.locator('[data-screen="admin"]')).toBeVisible();
  });

  test('an unrecognized hash falls back to the login screen', async ({ page }) => {
    await page.goto('/#/does-not-exist');
    await expect(page.locator('[data-screen="login"]')).toBeVisible();
  });
});
