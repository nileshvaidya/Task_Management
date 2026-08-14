// Pure date helpers — no Date.now()/timezone surprises leak into callers
// without an explicit "now", so these are cheap to unit test with fixtures.

/** @param {Date} [now] */
export function todayISODate(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} [today] YYYY-MM-DD, defaults to the real today
 */
export function isPastDate(dateStr, today = todayISODate()) {
  return dateStr < today;
}

/** Sunday-Saturday window containing `dateStr`, as [startISO, endISO]. */
export function weekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [todayISODate(start), todayISODate(end)];
}

/** @param {string} dateStr YYYY-MM-DD */
export function isInRange(dateStr, startISO, endISO) {
  return dateStr >= startISO && dateStr <= endISO;
}

/**
 * Calendar grid cells for a month (Sunday-first), with leading blanks for
 * the offset before the 1st. `today` (YYYY-MM-DD) marks the highlighted
 * cell, if it falls in this month.
 * @param {number} year
 * @param {number} month 0-indexed, matching Date's convention
 * @param {string} [today]
 */
export function buildCalendarCells(year, month, today = todayISODate()) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push({ label: '', dateISO: null, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ label: String(d), dateISO, isToday: dateISO === today });
  }
  return cells;
}

/**
 * "just now" / "12m ago" / "3h ago" / "2d ago" — the Activity Feed's
 * timestamp label. Falls back to a calendar date once it's more than a
 * week old rather than growing an ever-larger day count.
 * @param {string} isoTimestamp
 * @param {Date} [now]
 */
export function formatRelativeTime(isoTimestamp, now = new Date()) {
  const then = new Date(isoTimestamp);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Due today" / "Due tomorrow" / "Due Aug 20" relative to `today`. */
export function formatDueLabel(dateStr, today = todayISODate()) {
  if (dateStr === today) return 'Due today';
  const t = new Date(today + 'T00:00:00');
  const tomorrow = new Date(t);
  tomorrow.setDate(t.getDate() + 1);
  if (dateStr === todayISODate(tomorrow)) return 'Due tomorrow';
  const d = new Date(dateStr + 'T00:00:00');
  return 'Due ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
