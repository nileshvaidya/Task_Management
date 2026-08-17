// Loading/empty/error render coverage (Phase 6) for the Admin screen's two
// tables, isolated from render()'s Supabase/auth wiring by calling
// renderContent directly with a fake state.
import { describe, it, expect } from 'vitest';
import { renderContent } from './admin.js';

function baseState(overrides = {}) {
  return {
    users: [],
    tasks: [],
    loading: false,
    loadError: false,
    search: '',
    confirmDeleteId: null,
    overrideTaskId: null,
    actionError: '',
    ...overrides,
  };
}

describe('admin renderContent — async states', () => {
  it('shows a loading skeleton in both tables while loading', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ loading: true }), 'me');
    expect(content.querySelectorAll('[data-role="list-skeleton"]').length).toBe(2);
  });

  it('shows an error state with a retry action in both tables when the load failed', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ loadError: true }), 'me');
    expect(content.querySelectorAll('[data-role="error-state"]').length).toBe(2);
    expect(content.querySelectorAll('[data-action="retry"]').length).toBe(2);
  });

  it('shows the empty-state messages when genuinely no users/tasks', () => {
    const content = document.createElement('div');
    renderContent(content, baseState(), 'me');
    expect(content.textContent).toMatch(/no users found/i);
    expect(content.textContent).toMatch(/no tasks found/i);
  });

  it('renders rows once loaded successfully with data', () => {
    const content = document.createElement('div');
    const users = [{ id: 'u1', name: 'Sarah Jenkins', email: 's@x.com', role: 'manager', status: 'active', last_active: null }];
    renderContent(content, baseState({ users }), 'me');
    expect(content.querySelector('[data-user-row="u1"]')).toBeTruthy();
  });
});
