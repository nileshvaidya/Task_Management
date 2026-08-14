import { describe, it, expect } from 'vitest';
import { computeWeeklyProgress } from './taskStats.js';

describe('computeWeeklyProgress', () => {
  const today = '2026-08-14'; // Friday; week is Sun 08-09 .. Sat 08-15

  it('counts only tasks due within the current week', () => {
    const tasks = [
      { due_date: '2026-08-10', status: 'completed' }, // in week
      { due_date: '2026-08-14', status: 'planned' }, // in week
      { due_date: '2026-08-20', status: 'completed' }, // next week, excluded
      { due_date: '2026-08-01', status: 'completed' }, // last week, excluded
    ];
    const { done, total } = computeWeeklyProgress(tasks, today);
    expect(total).toBe(2);
    expect(done).toBe(1);
  });

  it('computes percent complete, rounded', () => {
    const tasks = [
      { due_date: '2026-08-11', status: 'completed' },
      { due_date: '2026-08-12', status: 'completed' },
      { due_date: '2026-08-13', status: 'planned' },
    ];
    expect(computeWeeklyProgress(tasks, today).pct).toBe(67);
  });

  it('returns 0% for an empty week rather than dividing by zero', () => {
    expect(computeWeeklyProgress([], today)).toEqual({ done: 0, total: 0, pct: 0 });
  });
});
