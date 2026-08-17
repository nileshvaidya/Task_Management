import { describe, it, expect } from 'vitest';
import { buildTaskReportRows, tasksToCSV, toReportTableBody, REPORT_TABLE_HEAD } from './reportExport.js';

describe('buildTaskReportRows', () => {
  const membersById = new Map([
    ['u1', { name: 'Sarah Jenkins' }],
    ['u2', { name: 'David Chen' }],
  ]);

  it('resolves the owner name and maps status/priority to display labels', () => {
    const rows = buildTaskReportRows(
      [{ id: 't1', title: 'Write report', status: 'in-progress', due_date: '2026-08-20', owner_id: 'u1', priority: 'high', blocked: false }],
      membersById
    );
    expect(rows).toEqual([
      { title: 'Write report', owner: 'Sarah Jenkins', status: 'In-Progress', dueDate: '2026-08-20', priority: 'High', blockedReason: '' },
    ]);
  });

  it('shows "Blocked" as the status and includes the reason when a task is blocked, regardless of its underlying status field', () => {
    const rows = buildTaskReportRows(
      [{ id: 't1', title: 'X', status: 'in-progress', due_date: '2026-08-20', owner_id: 'u1', blocked: true, blocked_reason: 'Waiting on legal' }],
      membersById
    );
    expect(rows[0].status).toBe('Blocked');
    expect(rows[0].blockedReason).toBe('Waiting on legal');
  });

  it('falls back to "Unknown" for an owner not present in the lookup map', () => {
    const rows = buildTaskReportRows(
      [{ id: 't1', title: 'X', status: 'planned', due_date: '2026-08-20', owner_id: 'ghost' }],
      membersById
    );
    expect(rows[0].owner).toBe('Unknown');
  });

  it('leaves priority blank when the task has none', () => {
    const rows = buildTaskReportRows(
      [{ id: 't1', title: 'X', status: 'planned', due_date: '2026-08-20', owner_id: 'u1' }],
      membersById
    );
    expect(rows[0].priority).toBe('');
  });

  it('returns an empty array for an empty task list', () => {
    expect(buildTaskReportRows([], membersById)).toEqual([]);
  });
});

describe('tasksToCSV', () => {
  it('writes a header row followed by one row per task, comma-separated', () => {
    const csv = tasksToCSV([
      { title: 'Write report', owner: 'Sarah Jenkins', status: 'Planned', dueDate: '2026-08-20', priority: 'Low', blockedReason: '' },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Title,Owner,Status,Due Date,Priority,Blocked Reason');
    expect(lines[1]).toBe('Write report,Sarah Jenkins,Planned,2026-08-20,Low,');
  });

  it('returns just the header row for an empty task list', () => {
    expect(tasksToCSV([])).toBe('Title,Owner,Status,Due Date,Priority,Blocked Reason');
  });

  it('quotes a field containing a comma', () => {
    const csv = tasksToCSV([{ title: 'Review PR #12, take 2', owner: 'x', status: 'Planned', dueDate: '2026-08-20', priority: '', blockedReason: '' }]);
    expect(csv.split('\r\n')[1]).toMatch(/^"Review PR #12, take 2"/);
  });

  it('quotes and escapes a field containing a double quote', () => {
    const csv = tasksToCSV([{ title: 'Say "hi"', owner: 'x', status: 'Planned', dueDate: '2026-08-20', priority: '', blockedReason: '' }]);
    expect(csv.split('\r\n')[1]).toMatch(/^"Say ""hi"""/);
  });

  it('quotes a field containing a newline', () => {
    const csv = tasksToCSV([{ title: 'Line1\nLine2', owner: 'x', status: 'Planned', dueDate: '2026-08-20', priority: '', blockedReason: '' }]);
    expect(csv.split('\r\n')[1]).toBe('"Line1\nLine2",x,Planned,2026-08-20,,');
  });
});

describe('toReportTableBody / REPORT_TABLE_HEAD', () => {
  it('has one header label per CSV column', () => {
    expect(REPORT_TABLE_HEAD).toEqual(['Title', 'Owner', 'Status', 'Due Date', 'Priority', 'Blocked Reason']);
  });

  it('converts rows into arrays matching the header order, for jspdf-autotable', () => {
    const body = toReportTableBody([
      { title: 'Write report', owner: 'Sarah Jenkins', status: 'Planned', dueDate: '2026-08-20', priority: 'Low', blockedReason: '' },
    ]);
    expect(body).toEqual([['Write report', 'Sarah Jenkins', 'Planned', '2026-08-20', 'Low', '']]);
  });
});
