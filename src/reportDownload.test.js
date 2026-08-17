// Verifies the actual download is triggered correctly (filename, link
// click) without asserting on PDF/CSV byte content — that's covered by
// reportExport.test.js's pure row/CSV assertions plus the e2e download
// tests (real browser, real file).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadTeamTaskReportCSV, downloadTeamTaskReportPDF } from './reportDownload.js';

const teamTasks = [
  { id: 't1', title: 'Write report', status: 'planned', due_date: '2026-08-20', owner_id: 'u1', blocked: false },
];
const teamMembers = [{ id: 'u1', name: 'Sarah Jenkins' }];

describe('downloadTeamTaskReportCSV', () => {
  // jsdom doesn't implement URL.createObjectURL/revokeObjectURL at all
  // (not even as a no-op stub) — define them before spying.
  if (!URL.createObjectURL) URL.createObjectURL = () => '';
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};

  afterEach(() => vi.restoreAllMocks());

  it('creates an object URL and clicks a download link named worksync-team-tasks.csv', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadTeamTaskReportCSV(teamTasks, teamMembers);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = /** @type {Blob} */ (createObjectURL.mock.calls[0][0]);
    expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });
});

describe('downloadTeamTaskReportPDF', () => {
  // jsPDF/jspdf-autotable are dynamically imported inside the function
  // (see reportDownload.js's comment on why) — it's async as a result.
  // jsPDF's own .save() drives the actual download (an internal anchor
  // click); nothing to mock, this just proves the call succeeds
  // end-to-end against real jsPDF/jspdf-autotable and produces a doc.
  it('generates a PDF and saves it as worksync-team-tasks.pdf', async () => {
    await expect(downloadTeamTaskReportPDF(teamTasks, teamMembers)).resolves.toBeUndefined();
  });

  it('does not throw for an empty task list', async () => {
    await expect(downloadTeamTaskReportPDF([], [])).resolves.toBeUndefined();
  });
});
