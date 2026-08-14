import { describe, it, expect } from 'vitest';
import { computeTeamPulse, computeBlockers, computeTodaysFocus } from './teamStats.js';

describe('computeTeamPulse', () => {
  it('computes completed/total and rounds the percentage', () => {
    const tasks = [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'planned' },
      { status: 'in-progress' },
    ];
    expect(computeTeamPulse(tasks)).toEqual({ pct: 50, completed: 2, active: 2, total: 4 });
  });

  it('returns 0% for an empty team task list rather than dividing by zero', () => {
    expect(computeTeamPulse([])).toEqual({ pct: 0, completed: 0, active: 0, total: 0 });
  });
});

describe('computeBlockers', () => {
  it('returns only blocked tasks with their title and reason', () => {
    const tasks = [
      { id: 't1', title: 'A', blocked: false, blocked_reason: null },
      { id: 't2', title: 'B', blocked: true, blocked_reason: 'Waiting on legal' },
    ];
    expect(computeBlockers(tasks)).toEqual([{ id: 't2', title: 'B', detail: 'Waiting on legal' }]);
  });

  it('falls back to an empty detail string when blocked_reason is null', () => {
    const tasks = [{ id: 't1', title: 'A', blocked: true, blocked_reason: null }];
    expect(computeBlockers(tasks)).toEqual([{ id: 't1', title: 'A', detail: '' }]);
  });
});

describe('computeTodaysFocus', () => {
  const tasks = [
    { id: 't1', owner_id: 'u1', title: 'Owned by u1, due today', status: 'planned', due_date: '2026-08-14' },
    { id: 't2', owner_id: 'u1', title: 'Owned by u1, due later', status: 'planned', due_date: '2026-08-20' },
    { id: 't3', owner_id: 'u2', title: 'Owned by u2, due today', status: 'completed', due_date: '2026-08-14' },
  ];

  it('lists only the given member\'s tasks due on the given day', () => {
    expect(computeTodaysFocus(tasks, 'u1', '2026-08-14')).toEqual([
      { id: 't1', title: 'Owned by u1, due today', done: false },
    ]);
  });

  it('marks completed tasks as done', () => {
    expect(computeTodaysFocus(tasks, 'u2', '2026-08-14')).toEqual([
      { id: 't3', title: 'Owned by u2, due today', done: true },
    ]);
  });

  it('returns an empty list when the member has nothing due that day', () => {
    expect(computeTodaysFocus(tasks, 'u1', '2026-08-21')).toEqual([]);
  });
});
