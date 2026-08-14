// Pure calculations over a task list — no fetching, no DOM — so the
// numbers shown on cards (Weekly Progress, etc.) are cheap to unit test
// against fixture data (build brief Phase 2 test case 6).
import { weekRange, isInRange, todayISODate } from './dateUtils.js';

/**
 * @param {Array<{ due_date: string, status: string }>} tasks
 * @param {string} [today] YYYY-MM-DD
 */
export function computeWeeklyProgress(tasks, today = todayISODate()) {
  const [start, end] = weekRange(today);
  const dueThisWeek = tasks.filter((t) => isInRange(t.due_date, start, end));
  const done = dueThisWeek.filter((t) => t.status === 'completed').length;
  const total = dueThisWeek.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}
