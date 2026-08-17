// Loading/empty/error render coverage (Phase 6) for the Dashboard's Active
// Tasks list — the async-state part of renderContent, isolated from
// render()'s Supabase/auth wiring by calling it directly with a fake state.
import { describe, it, expect } from 'vitest';
import { renderContent } from './dashboard.js';

const user = { id: 'u1', name: 'Sarah Jenkins', role: 'employee' };

function baseState(overrides = {}) {
  return {
    tasks: [],
    loading: false,
    error: false,
    filter: 'all',
    viewingTeam: false,
    quickAddValue: '',
    calMonth: 7,
    calYear: 2026,
    ...overrides,
  };
}

describe('dashboard renderContent — Active Tasks async states', () => {
  it('shows a loading skeleton while loading', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ loading: true }), user);
    const list = content.querySelector('[data-role="task-list"]');
    expect(list.querySelector('[data-role="list-skeleton"]')).toBeTruthy();
  });

  it('shows an error state with a retry action when the load failed', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ error: true }), user);
    const list = content.querySelector('[data-role="task-list"]');
    expect(list.querySelector('[data-role="error-state"]')).toBeTruthy();
    expect(list.querySelector('[data-action="retry"]')).toBeTruthy();
  });

  it('shows the empty-state message when genuinely no tasks', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ tasks: [] }), user);
    const list = content.querySelector('[data-role="task-list"]');
    expect(list.textContent).toMatch(/no tasks here/i);
    expect(list.querySelector('[data-role="error-state"]')).toBeNull();
  });

  it('renders task rows once loaded successfully with data', () => {
    const content = document.createElement('div');
    const tasks = [{ id: 't1', title: 'Write report', status: 'planned', due_date: '2026-08-20', blocked: false, blocked_reason: null }];
    renderContent(content, baseState({ tasks }), user);
    expect(content.querySelector('[data-task-id="t1"]')).toBeTruthy();
  });
});
