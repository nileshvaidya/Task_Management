// Team task history export (Phase 7) — pure row-building + CSV
// serialization, no DOM/download side effects, so the actual formatting
// logic is unit-testable the same way teamStats.js's calculations are.
// PDF generation (jsPDF + jspdf-autotable) and the download trigger itself
// live in team.js, since they're not meaningfully unit-testable without a
// real DOM/library integration.

const STATUS_LABEL = { planned: 'Planned', 'in-progress': 'In-Progress', completed: 'Completed' };

/**
 * Flattens a team's tasks into plain export rows — owner name resolved
 * from `membersById` (falls back to "Unknown" for an owner outside the
 * lookup, e.g. a manager themself if only their reports were passed in).
 * @param {Array<{ id: string, title: string, status: string, due_date: string, owner_id: string, priority?: string|null, blocked?: boolean, blocked_reason?: string|null }>} tasks
 * @param {Map<string, { name: string }>} membersById
 */
export function buildTaskReportRows(tasks, membersById) {
  return tasks.map((t) => ({
    title: t.title,
    owner: membersById.get(t.owner_id)?.name || 'Unknown',
    status: t.blocked ? 'Blocked' : STATUS_LABEL[t.status] || t.status,
    dueDate: t.due_date,
    priority: t.priority ? t.priority[0].toUpperCase() + t.priority.slice(1) : '',
    blockedReason: t.blocked ? t.blocked_reason || '' : '',
  }));
}

const CSV_COLUMNS = [
  { key: 'title', label: 'Title' },
  { key: 'owner', label: 'Owner' },
  { key: 'status', label: 'Status' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'priority', label: 'Priority' },
  { key: 'blockedReason', label: 'Blocked Reason' },
];

/** RFC 4180 field escaping — quote whenever a comma/quote/newline is present. */
function escapeCsvField(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * @param {ReturnType<typeof buildTaskReportRows>} rows
 */
export function tasksToCSV(rows) {
  const header = CSV_COLUMNS.map((c) => c.label).join(',');
  const lines = rows.map((row) => CSV_COLUMNS.map((c) => escapeCsvField(row[c.key])).join(','));
  return [header, ...lines].join('\r\n');
}

export const REPORT_TABLE_HEAD = CSV_COLUMNS.map((c) => c.label);

/** @param {ReturnType<typeof buildTaskReportRows>} rows */
export function toReportTableBody(rows) {
  return rows.map((row) => CSV_COLUMNS.map((c) => row[c.key] ?? ''));
}
