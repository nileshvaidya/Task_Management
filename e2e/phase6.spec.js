// Phase 6 — Polish, Accessibility, PWA & Deployment Hardening.
// Loading/empty/error states (test case 1): render-function unit tests in
// src/screens/{dashboard,team,admin}.test.js cover the state->markup logic
// directly; these e2e tests prove the real network path drives that state
// correctly in a live browser — a delayed route to catch the loading
// skeleton, a failed route to catch the error state + Retry recovery, and
// an empty response to catch the empty-state message.
import { test, expect } from '@playwright/test';

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  // A few px of tolerance for scrollbar-width rounding, not a real overflow.
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe('Phase 6 — Dashboard async states (tasks)', () => {
  test('shows a loading skeleton while the tasks fetch is in flight', async ({ page }) => {
    await page.route('**/rest/v1/tasks**', async (route) => {
      if (route.request().method() !== 'GET') return route.fulfill({ status: 200, body: '{}' });
      // Long enough that it's still pending by the time the assertion below
      // runs — Vite's dev-server module transform + demo-mode boot can
      // itself take a couple hundred ms, so a short delay risks the fetch
      // already resolving by the time we check (goto only waits for
      // 'commit', not the page's own async fetches).
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/?demoRole=manager#/dashboard', { waitUntil: 'commit' });
    await expect(page.locator('[data-role="task-list"] [data-role="list-skeleton"]')).toBeVisible();
  });

  test('shows an error state with a Retry action when the tasks fetch fails, and Retry recovers', async ({ page }) => {
    let fail = true;
    await page.route('**/rest/v1/tasks**', (route) => {
      if (route.request().method() !== 'GET') return route.fulfill({ status: 200, body: '{}' });
      if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/?demoRole=manager#/dashboard');
    const taskList = page.locator('[data-role="task-list"]');
    await expect(taskList.locator('[data-role="error-state"]')).toBeVisible();

    fail = false;
    await taskList.locator('[data-action="retry"]').click();
    await expect(taskList.locator('[data-role="error-state"]')).toHaveCount(0);
    await expect(taskList).toContainText(/no tasks here/i);
  });

  test('shows the empty-state message when there are genuinely no tasks', async ({ page }) => {
    await page.route('**/rest/v1/tasks**', (route) => {
      if (route.request().method() !== 'GET') return route.fulfill({ status: 200, body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/?demoRole=manager#/dashboard');
    await expect(page.locator('[data-role="task-list"]')).toContainText(/no tasks here/i);
  });
});

test.describe('Phase 6 — Admin screen async states (users/tasks)', () => {
  test('shows an error state in both tables when the admin RPCs fail', async ({ page }) => {
    await page.route('**/rest/v1/rpc/admin_list_users', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' })
    );
    await page.route('**/rest/v1/rpc/admin_list_tasks', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' })
    );

    await page.goto('/?demoRole=manager#/admin');
    await expect(page.locator('[data-screen="admin"] [data-role="error-state"]')).toHaveCount(2);
  });
});

test.describe('Phase 6 — PWA install prompt (test case 4)', () => {
  test('the Install App button appears when beforeinstallprompt fires and triggers the captured prompt on click', async ({ page }) => {
    await page.route('**/rest/v1/tasks**', (route) => {
      if (route.request().method() !== 'GET') return route.fulfill({ status: 200, body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/?demoRole=manager#/dashboard');
    const installBtn = page.locator('aside [data-action="install-app"]');
    await expect(installBtn).toBeHidden();

    // beforeinstallprompt isn't something a browser under automation ever
    // fires for real — dispatch a synthetic one with the same shape,
    // recording on `window` whether .prompt() actually got invoked.
    await page.evaluate(() => {
      /** @type {any} */ (window).__promptCalled = false;
      const event = new Event('beforeinstallprompt', { cancelable: true });
      /** @type {any} */ (event).prompt = () => {
        /** @type {any} */ (window).__promptCalled = true;
      };
      /** @type {any} */ (event).userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });

    await expect(installBtn).toBeVisible();
    await installBtn.click();
    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__promptCalled)).toBe(true);
    await expect(installBtn).toBeHidden();
  });
});

test.describe('Phase 6 — keyboard-only New Task + dependency flow (test case 2)', () => {
  // No page.click()/page.check()/page.selectOption() anywhere below —
  // every interaction is a .focus() (standing in for "the user tabbed
  // here") followed by a real key press, proving the flow is completable
  // without a mouse. Also asserts a visible focus ring at a representative
  // sample of control types (native button, custom role="switch", native
  // select, native checkbox) per the brief's own wording of this test case.
  async function expectVisibleFocusRing(locator) {
    const outline = await locator.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: s.outlineWidth };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).not.toBe('0px');
  }

  test('completes the full create-task-with-dependency flow using only the keyboard', async ({ page }) => {
    await page.route('**/rest/v1/projects**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/rpc/team_member_ids**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['demo-u1', 'demo-u2']) })
    );
    await page.route('**/rest/v1/users**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'demo-u1', name: 'Sarah Jenkins' },
          { id: 'demo-u2', name: 'David Chen' },
        ]),
      })
    );
    await page.route('**/rest/v1/rpc/list_assignable_users**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'demo-u3', name: 'Marcus Cole' }]) })
    );
    await page.route('**/rest/v1/rpc/list_all_tasks_for_dependency**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    let insertCount = 0;
    let patchBody = null;
    await page.route('**/rest/v1/tasks**', (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        insertCount += 1;
        const body = insertCount === 1 ? { id: 'primary-1', title: 'Q3 review' } : { id: 'dep-1', title: 'Design sign-off' };
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (req.method() === 'PATCH') {
        patchBody = req.postDataJSON();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'primary-1', ...patchBody }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/activity_log**', (route) =>
      route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
    );

    await page.goto('/?demoRole=manager#/dashboard');

    // Open the dialog via keyboard activation of a real <button>.
    const openBtn = page.locator('[data-action="open-new-task"]:visible').first();
    await openBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-dialog="new-task"]')).toBeVisible();

    // Title.
    const titleInput = page.locator('#new-task-title-input');
    await titleInput.focus();
    await expectVisibleFocusRing(titleInput);
    await page.keyboard.type('Q3 review');

    // Assign To (native select) — ArrowDown moves selection without opening
    // the dropdown, no mouse needed.
    const assignSelect = page.locator('#new-task-assignee');
    await assignSelect.focus();
    await expectVisibleFocusRing(assignSelect);
    await page.keyboard.press('ArrowDown');
    await expect(assignSelect).toHaveValue('demo-u2');

    // Priority — a real <button>, Enter activates it; focus must survive
    // the dialog's full re-render (the bug fixed above this test file).
    const highPriorityBtn = page.locator('[data-action="set-priority"][data-priority="high"]');
    await highPriorityBtn.focus();
    await page.keyboard.press('Enter');
    await expectVisibleFocusRing(highPriorityBtn);
    const focusedAfterPriority = await page.evaluate(() => document.activeElement?.getAttribute('data-priority'));
    expect(focusedAfterPriority).toBe('high');

    // Has Dependency — the custom role="switch" div fixed to be keyboard
    // operable earlier in this phase. Space activates it, same as a native
    // checkbox would.
    const depSwitch = page.locator('[data-action="toggle-has-dependency"]');
    await depSwitch.focus();
    await page.keyboard.press(' ');
    await expectVisibleFocusRing(depSwitch);
    await expect(depSwitch).toHaveAttribute('aria-checked', 'true');
    const focusedAfterSwitch = await page.evaluate(() => document.activeElement?.getAttribute('data-action'));
    expect(focusedAfterSwitch).toBe('toggle-has-dependency');

    // New dependency title + assignee (defaults to "Create New" mode).
    const depTitleInput = page.locator('#new-task-dep-title');
    await depTitleInput.focus();
    await page.keyboard.type('Design sign-off');

    const depAssignSelect = page.locator('#new-task-dep-assignee');
    await depAssignSelect.focus();
    await page.keyboard.press('ArrowDown');
    await expect(depAssignSelect).toHaveValue('demo-u3');

    // Requires acceptance — native checkbox, Space checks it.
    const requiresAcceptance = page.locator('#new-task-requires-acceptance');
    await requiresAcceptance.focus();
    await page.keyboard.press(' ');
    await expectVisibleFocusRing(requiresAcceptance);
    await expect(requiresAcceptance).toBeChecked();

    // Submit.
    const submitBtn = page.locator('[data-form="new-task"] button[type="submit"]');
    await submitBtn.focus();
    await expectVisibleFocusRing(submitBtn);
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-dialog="new-task"]')).toHaveCount(0);
    expect(patchBody).toEqual({
      depends_on_task_id: 'dep-1',
      status: 'in-progress',
      blocked: true,
      blocked_reason: 'Marcus Cole — Design sign-off',
    });
  });
});

test.describe('Phase 6 — responsive QA across breakpoints (test case in brief §Phase 6)', () => {
  // Phase 2's own e2e suite already proves the dashboard's sidebar/tab-bar
  // swap at mobile vs desktop; these extend the same "no horizontal
  // overflow, key content stays visible" check to Team, Admin, and Login —
  // and to a tablet-width breakpoint neither phase covered before.
  for (const bp of BREAKPOINTS) {
    test(`Team screen has no horizontal overflow at ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await page.route('**/rest/v1/rpc/team_member_ids**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['demo-u1']) })
      );
      await page.route('**/rest/v1/activity_log**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.route('**/rest/v1/tasks**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.route('**/rest/v1/users**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/?demoRole=manager#/team');
      await expect(page.locator('[data-screen="team"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test(`Admin screen has no horizontal overflow at ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await page.route('**/rest/v1/rpc/admin_list_users**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'demo-u1', name: 'Sarah Jenkins', email: 's@x.com', role: 'manager', status: 'active', last_active: null }]),
        })
      );
      await page.route('**/rest/v1/rpc/admin_list_tasks**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/?demoRole=manager#/admin');
      await expect(page.locator('[data-screen="admin"]')).toBeVisible();
      // The two tables scroll horizontally within their own container by
      // design (overflow-x:auto on the wrapper) — that's expected at
      // narrow widths and not a page-level overflow bug, so this checks
      // the page itself, not the tables' own intentional scroll regions.
      await expectNoHorizontalOverflow(page);
    });

    test(`Login screen has no horizontal overflow at ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/#/login');
      await expect(page.locator('[data-screen="login"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});
