// Phase 5 — Dependencies & Cross-User Task Assignment & Acceptance. Demo
// mode + page.route mocking, same approach as every other phase's e2e
// suite — including test 11, the brief's mandatory full cross-user flow
// (the brief: "do not merge to main without the full e2e flow (test 11)
// passing"). That flow spans three separate "logins" (Employee A creates,
// Employee B accepts+completes, Employee A verifies); each is a fresh
// page.goto() with its own route mocks reflecting what the previous step
// would have produced — the actual DB-level correctness of the
// auto-unblock trigger is proven separately by
// scripts/test-rls-dependencies.mjs against a real Supabase project. This
// test's job is to prove the UI correctly drives and reflects that flow.
import { test, expect } from '@playwright/test';

const TODAY = new Date().toISOString().slice(0, 10);

test.describe('Phase 5 — Assign To role gating (test cases 1-2)', () => {
  test('a manager\'s primary Assign To is enabled with self + direct reports', async ({ page }) => {
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
    await page.route('**/rest/v1/projects**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto('/?demoRole=manager#/dashboard');
    await page.click('text=+ New Task');
    const assignSelect = page.locator('#new-task-assignee');
    await expect(assignSelect).toBeEnabled();
    await expect(assignSelect.locator('option')).toHaveCount(2);
  });

  test('an employee\'s primary Assign To is locked to themself', async ({ page }) => {
    await page.route('**/rest/v1/projects**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto('/?demoRole=employee#/dashboard');
    await page.click('text=+ New Task');
    const assignSelect = page.locator('#new-task-assignee');
    await expect(assignSelect).toBeDisabled();
    await expect(assignSelect.locator('option')).toHaveCount(1);
    await expect(assignSelect.locator('option')).toHaveText('Myself');
  });
});

test.describe('Phase 5 — Dependency Assign To is company-wide (test case 2)', () => {
  test('an employee can pick any active user for a new dependency, not just their team', async ({ page }) => {
    await page.route('**/rest/v1/projects**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/rpc/list_assignable_users**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'demo-u1', name: 'Sarah Jenkins' },
          { id: 'demo-u2', name: 'David Chen' },
          { id: 'demo-u3', name: 'Marcus Cole' },
        ]),
      })
    );
    await page.route('**/rest/v1/rpc/list_all_tasks_for_dependency**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    await page.goto('/?demoRole=employee#/dashboard');
    await page.click('text=+ New Task');
    await page.click('[data-action="toggle-has-dependency"]');
    const depAssignSelect = page.locator('#new-task-dep-assignee');
    await expect(depAssignSelect.locator('option')).toHaveCount(4); // placeholder + 3 users
    await expect(depAssignSelect).toContainText('Sarah Jenkins');
    await expect(depAssignSelect).toContainText('Marcus Cole');
  });
});

test.describe('Phase 5 — search existing tasks (test case 3)', () => {
  test('search is company-wide and filters live as the user types', async ({ page }) => {
    await page.route('**/rest/v1/projects**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/rpc/list_assignable_users**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/rest/v1/rpc/list_all_tasks_for_dependency**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 't1', title: 'Design sign-off', owner_id: 'demo-u3', owner_name: 'Marcus Cole', status: 'planned' },
          { id: 't2', title: 'Legal review', owner_id: 'demo-u1', owner_name: 'Sarah Jenkins', status: 'planned' },
        ]),
      })
    );

    await page.goto('/?demoRole=employee#/dashboard');
    await page.click('text=+ New Task');
    await page.click('[data-action="toggle-has-dependency"]');
    await page.click('label:has-text("Search Existing")');

    const results = page.locator('[data-role="dep-results"]');
    await expect(results).toContainText('Design sign-off');
    await expect(results).toContainText('Legal review');

    await page.fill('#new-task-dep-search', 'legal');
    await expect(results).toContainText('Legal review');
    await expect(results).not.toContainText('Design sign-off');
  });
});

test.describe('Phase 5 — requires-acceptance checkbox controls blocking (test cases 4-5)', () => {
  async function mockCreationRoutes(page, onPrimaryPatch) {
    await page.route('**/rest/v1/projects**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/rpc/list_assignable_users**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'demo-u3', name: 'Marcus Cole' }]) })
    );
    // Toggling "Has Dependency" fetches this alongside list_assignable_users
    // (Promise.all) — leaving it unmocked used to be silently tolerated
    // (the resulting network error against the unreachable placeholder host
    // was swallowed into an empty array), but Phase 6 made that error throw
    // instead, which now fails the whole Promise.all and leaves
    // assignableUsers empty too. Mock it for real, matching what every
    // other has-dependency test in this file already does.
    await page.route('**/rest/v1/rpc/list_all_tasks_for_dependency**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    let insertCount = 0;
    await page.route('**/rest/v1/tasks**', (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        insertCount += 1;
        const body = insertCount === 1 ? { id: 'primary-1', title: 'Write Q3 report' } : { id: 'dep-1', title: 'Design sign-off' };
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (req.method() === 'PATCH') {
        const patch = req.postDataJSON();
        onPrimaryPatch(patch);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'primary-1', ...patch }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/activity_log**', (route) => {
      if (route.request().method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }

  async function fillAndSubmitWithDependency(page, requiresAcceptance) {
    await page.goto('/?demoRole=employee#/dashboard');
    await page.click('text=+ New Task');
    await page.fill('#new-task-title-input', 'Write Q3 report');
    await page.click('[data-action="toggle-has-dependency"]');
    await page.fill('#new-task-dep-title', 'Design sign-off');
    await page.selectOption('#new-task-dep-assignee', 'demo-u3');
    if (requiresAcceptance) await page.check('#new-task-requires-acceptance');
    await page.click('[data-form="new-task"] button[type="submit"]');
    await expect(page.locator('[data-dialog="new-task"]')).toHaveCount(0);
  }

  test('checking "Requires acceptance" blocks the primary task (test case 4)', async ({ page }) => {
    let patch = null;
    await mockCreationRoutes(page, (p) => { patch = p; });
    await fillAndSubmitWithDependency(page, true);

    expect(patch).toEqual({
      depends_on_task_id: 'dep-1',
      status: 'in-progress',
      blocked: true,
      blocked_reason: 'Marcus Cole — Design sign-off',
    });
  });

  test('leaving "Requires acceptance" unchecked links the dependency but does not block (test case 5)', async ({ page }) => {
    let patch = null;
    await mockCreationRoutes(page, (p) => { patch = p; });
    await fillAndSubmitWithDependency(page, false);

    expect(patch).toEqual({ depends_on_task_id: 'dep-1' });
  });
});

test.describe('Phase 5 — inactive assignee validation (test case 10)', () => {
  test('rejects a dependency assigned to a user not in the active-users list, without calling Supabase', async ({ page }) => {
    let insertCalled = false;
    await page.route('**/rest/v1/projects**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/rpc/list_assignable_users**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'demo-u3', name: 'Marcus Cole' }]) })
    );
    await page.route('**/rest/v1/tasks**', (route) => {
      if (route.request().method() === 'POST') insertCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/?demoRole=employee#/dashboard');
    await page.click('text=+ New Task');
    await page.fill('#new-task-title-input', 'Write Q3 report');
    await page.click('[data-action="toggle-has-dependency"]');
    await page.fill('#new-task-dep-title', 'Design sign-off');
    // Force a value the real dropdown would never offer (it only ever
    // lists active users) — simulates a stale/tampered selection to prove
    // the client-side guard, same technique as phase2's past-date test.
    await page.locator('#new-task-dep-assignee').evaluate((el) => {
      const select = /** @type {HTMLSelectElement} */ (el);
      const opt = document.createElement('option');
      opt.value = 'inactive-user-id';
      opt.textContent = 'Ghost User';
      select.appendChild(opt);
      select.value = 'inactive-user-id';
      // The dialog tracks this field in its own store on the 'change'
      // event (so re-renders elsewhere don't wipe it) — setting .value
      // directly, as above, doesn't fire that event on its own.
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.click('[data-form="new-task"] button[type="submit"]');

    await expect(page.locator('[data-dialog="new-task"] [data-role="error"]')).toContainText(/inactive/i);
    expect(insertCalled).toBe(false);
  });
});

test.describe('Phase 5 — full cross-user dependency + acceptance flow (test case 11, mandatory)', () => {
  test('Employee A creates a blocked dependency task; Employee B accepts and completes it; Employee A sees it auto-unblock', async ({ page }) => {
    test.setTimeout(90000); // three full "sessions" in one test — well beyond the default 30s budget
    // ---- Phase 1: Employee A (David, demo-u2) creates the task + dependency ----
    let insertCount = 0;
    await page.route('**/rest/v1/projects**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/rpc/list_assignable_users**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'demo-u3', name: 'Marcus Cole' }]) })
    );
    // See mockCreationRoutes' comment above — unmocked, this used to
    // silently resolve empty; Phase 6 made the underlying fetch throw.
    await page.route('**/rest/v1/rpc/list_all_tasks_for_dependency**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/rest/v1/activity_log**', (route) =>
      route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
    );
    await page.route('**/rest/v1/tasks**', (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        insertCount += 1;
        const body = insertCount === 1 ? { id: 'primary-1', title: 'Write Q3 report' } : { id: 'dep-1', title: 'Design sign-off' };
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (req.method() === 'PATCH') {
        // The primary task is being linked + blocked.
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'primary-1', title: 'Write Q3 report', status: 'in-progress', blocked: true,
            blocked_reason: 'Marcus Cole — Design sign-off', due_date: TODAY,
          }),
        });
      }
      // GET (fetchMyTasks) — empty until both inserts have actually
      // happened, so the later "Waiting on" assertion only passes because
      // the creation flow really ran, not because the mock always returns it.
      const tasksSoFar = insertCount >= 2
        ? [{
            id: 'primary-1', title: 'Write Q3 report', status: 'in-progress', due_date: TODAY,
            blocked: true, blocked_reason: 'Marcus Cole — Design sign-off',
            owner_id: 'demo-u2', created_by: 'demo-u2', accepted: null,
          }]
        : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasksSoFar) });
    });

    await page.goto('/?demoRole=employee#/dashboard');
    await page.click('text=+ New Task');
    await page.fill('#new-task-title-input', 'Write Q3 report');
    await page.click('[data-action="toggle-has-dependency"]');
    await page.fill('#new-task-dep-title', 'Design sign-off');
    await page.selectOption('#new-task-dep-assignee', 'demo-u3');
    await page.check('#new-task-requires-acceptance');
    await page.click('[data-form="new-task"] button[type="submit"]');

    await expect(page.locator('[data-dialog="new-task"]')).toHaveCount(0);
    await expect(page.getByText('Waiting on: Marcus Cole — Design sign-off')).toBeVisible();

    // ---- Phase 2: Employee B (Marcus, demo-u3) sees, accepts, and completes it ----
    let accepted = false;
    let completed = false;
    await page.unroute('**/rest/v1/tasks**');
    await page.route('**/rest/v1/tasks**', (route) => {
      const req = route.request();
      if (req.method() === 'PATCH') {
        const patch = req.postDataJSON();
        if (patch.accepted === true) accepted = true;
        if (patch.status === 'completed') completed = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'dep-1', title: 'Design sign-off', ...patch }),
        });
      }
      // GET (fetchMyTasks for Marcus) — reflects whichever step we're at.
      const depTask = {
        id: 'dep-1', title: 'Design sign-off', due_date: TODAY,
        owner_id: 'demo-u3', created_by: 'demo-u2',
        accepted: accepted ? true : false,
        status: completed ? 'completed' : 'planned',
        blocked: false, blocked_reason: null,
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([depTask]) });
    });

    await page.goto('/?demoRole=employee2#/dashboard');
    await expect(page.getByText('Pending your acceptance')).toBeVisible();
    await expect(page.locator('[data-action="status-select"]')).toHaveCount(0);

    await page.click('[data-action="accept-task"]');
    await expect(page.locator('[data-action="status-select"]')).toBeVisible();
    await expect(page.getByText('Pending your acceptance')).toHaveCount(0);

    await page.selectOption('[data-action="status-select"]', 'completed');
    await expect.poll(() => completed).toBe(true);

    // ---- Phase 3: Employee A (David) sees the original task auto-unblocked, with an activity entry ----
    await page.unroute('**/rest/v1/tasks**');
    await page.route('**/rest/v1/tasks**', (route) => {
      if (route.request().method() !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'primary-1', title: 'Write Q3 report', status: 'in-progress', due_date: TODAY,
          blocked: false, blocked_reason: null,
          owner_id: 'demo-u2', created_by: 'demo-u2', accepted: null,
        }]),
      });
    });
    await page.unroute('**/rest/v1/activity_log**');
    await page.route('**/rest/v1/activity_log**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'a1',
          actor: { name: 'Marcus Cole' },
          verb: 'unblocked',
          detail: 'Write Q3 report — no longer blocked, Design sign-off was completed',
          created_at: new Date().toISOString(),
        }]),
      })
    );
    await page.route('**/rest/v1/rpc/team_member_ids**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['demo-u1', 'demo-u2', 'demo-u3']) })
    );
    await page.route('**/rest/v1/users**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    await page.goto('/?demoRole=employee#/dashboard');
    await expect(page.getByText(/Waiting on/)).toHaveCount(0);
    await expect(page.locator('[data-action="status-select"]')).toBeVisible();

    await page.goto('/?demoRole=employee#/team');
    await expect(page.getByText(/no longer blocked/)).toBeVisible();
  });
});
