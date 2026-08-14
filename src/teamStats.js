// Pure calculations over a team's task list — no fetching, no DOM — for
// Team Overview's Team Pulse, Blockers & Alerts, and per-member Today's
// Focus cards (build brief Phase 3 test cases 2-4).
import { todayISODate } from './dateUtils.js';

/**
 * @param {Array<{ status: string }>} tasks
 */
export function computeTeamPulse(tasks) {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { pct, completed, active: total - completed, total };
}

/**
 * @param {Array<{ id: string, title: string, blocked: boolean, blocked_reason: string|null }>} tasks
 */
export function computeBlockers(tasks) {
  return tasks
    .filter((t) => t.blocked)
    .map((t) => ({ id: t.id, title: t.title, detail: t.blocked_reason || '' }));
}

/**
 * A single team member's tasks due today, for their "Today's Focus" card.
 * @param {Array<{ id: string, owner_id: string, title: string, status: string, due_date: string }>} tasks
 * @param {string} ownerId
 * @param {string} [today] YYYY-MM-DD
 */
export function computeTodaysFocus(tasks, ownerId, today = todayISODate()) {
  return tasks
    .filter((t) => t.owner_id === ownerId && t.due_date === today)
    .map((t) => ({ id: t.id, title: t.title, done: t.status === 'completed' }));
}
