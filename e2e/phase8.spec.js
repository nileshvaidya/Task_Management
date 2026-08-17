// Phase 8 — Help manual. Demo mode only; the Help screen is pure static
// content (no Supabase calls beyond the shared auth check that dashboard/
// team/admin already exercise), so no route mocking is needed here — same
// as the plain dashboard-render checks in phase2.spec.js.
import { test, expect } from '@playwright/test';

test.describe('Phase 8 — Help screen navigation', () => {
  test('desktop sidebar Help link navigates to the Help manual', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/?demoRole=manager#/dashboard');
    await expect(page.locator('[data-screen="dashboard"]')).toBeVisible();

    await page.click('a[data-nav="/help"]');
    await expect(page.locator('[data-screen="help"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText(/help.*user manual/i);
  });

  test('mobile top bar "?" icon navigates to the Help manual', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/?demoRole=employee#/dashboard');
    await expect(page.locator('[data-screen="dashboard"]')).toBeVisible();

    await page.click('a[data-nav="/help"].wsicon-btn');
    await expect(page.locator('[data-screen="help"]')).toBeVisible();
  });

  test('an unauthenticated visitor hitting #/help directly is redirected to login', async ({ page }) => {
    await page.goto('/#/help');
    await expect(page.locator('[data-screen="login"]')).toBeVisible();
  });

  test('table of contents links scroll to their matching section, all screenshots load, no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/?demoRole=manager#/help');
    await expect(page.locator('[data-screen="help"]')).toBeVisible();

    await page.click('[data-toc-link][href="#help-dependencies"]');
    await expect(page.locator('#help-dependencies')).toBeInViewport();

    const brokenImages = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-screen="help"] img'))
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.getAttribute('src'))
    );
    expect(brokenImages).toEqual([]);

    const imageCount = await page.locator('[data-screen="help"] img').count();
    expect(imageCount).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test('Help content covers task dependencies, export, and admin sections', async ({ page }) => {
    await page.goto('/?demoRole=manager#/help');
    await expect(page.locator('[data-screen="help"]')).toBeVisible();
    await expect(page.getByText('Has Dependency', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Export CSV', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Add User', { exact: false }).first()).toBeVisible();
  });
});
