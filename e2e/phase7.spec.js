// Phase 7 — Reporting/export (CSV/PDF) of team task history. Demo mode +
// page.route mocking, same approach as every other phase's e2e suite.
// The row-building/CSV-serialization logic itself is unit-tested directly
// (src/reportExport.test.js, src/reportDownload.test.js); these tests
// prove the real browser download flow — clicking the button, the file
// that comes out, its name — which only a real browser can prove.
import { test, expect } from '@playwright/test';

async function mockTeamScreen(page) {
  await page.route('**/rest/v1/rpc/team_member_ids**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['demo-u1', 'demo-u2']) })
  );
  await page.route('**/rest/v1/activity_log**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/tasks**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 't1', title: 'Write Q3 report', status: 'planned', due_date: '2026-08-20', owner_id: 'demo-u2', priority: 'high', blocked: false, blocked_reason: null },
        { id: 't2', title: 'Fix, the thing', status: 'in-progress', due_date: '2026-08-21', owner_id: 'demo-u1', priority: null, blocked: true, blocked_reason: 'Waiting on legal' },
      ]),
    })
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
}

test.describe('Phase 7 — Team task history export', () => {
  test('Export CSV downloads a CSV file with the team\'s tasks', async ({ page }) => {
    await mockTeamScreen(page);
    await page.goto('/?demoRole=manager#/team');
    await expect(page.locator('[data-action="export-csv"]')).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="export-csv"]'),
    ]);

    expect(download.suggestedFilename()).toBe('worksync-team-tasks.csv');
    const content = await new Promise((resolve, reject) => {
      download.createReadStream().then((stream) => {
        let data = '';
        stream.on('data', (chunk) => (data += chunk));
        stream.on('end', () => resolve(data));
        stream.on('error', reject);
      });
    });
    expect(content.split('\r\n')[0]).toBe('Title,Owner,Status,Due Date,Priority,Blocked Reason');
    expect(content).toContain('Write Q3 report,David Chen,Planned,2026-08-20,High,');
    // A comma inside the title must be quoted, not split into extra columns.
    expect(content).toContain('"Fix, the thing",Sarah Jenkins,Blocked,2026-08-21,,Waiting on legal');
  });

  test('Export PDF downloads a PDF file', async ({ page }) => {
    await mockTeamScreen(page);
    await page.goto('/?demoRole=manager#/team');
    await expect(page.locator('[data-action="export-pdf"]')).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('[data-action="export-pdf"]'),
    ]);

    expect(download.suggestedFilename()).toBe('worksync-team-tasks.pdf');
  });

  test('Export buttons are disabled while the team data is still loading', async ({ page }) => {
    await page.route('**/rest/v1/rpc/team_member_ids**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/activity_log**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/tasks**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/users**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto('/?demoRole=manager#/team', { waitUntil: 'commit' });
    await expect(page.locator('[data-action="export-csv"]')).toBeDisabled();
    await expect(page.locator('[data-action="export-pdf"]')).toBeDisabled();
  });
});
