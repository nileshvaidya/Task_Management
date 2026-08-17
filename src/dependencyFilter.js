// Pure search-filter logic for the New Task dialog's "search existing
// tasks" dependency picker (Phase 5 test case 3) — no DOM, no fetching, so
// it's cheap to unit test against fixture data independent of the
// live-typing UI behavior (covered by e2e instead). Mirrors
// adminFilter.js's filterUsers shape.

/**
 * Case-insensitive substring match against a task's title or owner name.
 * A task can never depend on itself, so `excludeTaskId` (the task being
 * created/edited, if any) is always filtered out of the candidate list.
 * @param {Array<{ id: string, title: string, owner_name?: string }>} tasks
 * @param {string} query
 * @param {string} [excludeTaskId]
 */
export function filterTasksForDependency(tasks, query, excludeTaskId) {
  const candidates = excludeTaskId ? tasks.filter((t) => t.id !== excludeTaskId) : tasks;
  const q = query.trim().toLowerCase();
  if (!q) return candidates;
  return candidates.filter(
    (t) => t.title.toLowerCase().includes(q) || (t.owner_name || '').toLowerCase().includes(q)
  );
}
