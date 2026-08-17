// Loading/empty/error render coverage (Phase 6) for the Admin screen's two
// tables, isolated from render()'s Supabase/auth wiring by calling
// renderContent directly with a fake state.
import { describe, it, expect } from 'vitest';
import { renderContent } from './admin.js';

function baseState(overrides = {}) {
  return {
    users: [],
    tasks: [],
    projects: [],
    loading: false,
    loadError: false,
    search: '',
    confirmDeleteId: null,
    overrideTaskId: null,
    actionError: '',
    newProjectName: '',
    projectError: '',
    ...overrides,
  };
}

describe('admin renderContent — async states', () => {
  it('shows a loading skeleton in all three lists while loading', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ loading: true }), 'me');
    expect(content.querySelectorAll('[data-role="list-skeleton"]').length).toBe(3);
  });

  it('shows an error state with a retry action in all three lists when the load failed', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ loadError: true }), 'me');
    expect(content.querySelectorAll('[data-role="error-state"]').length).toBe(3);
    expect(content.querySelectorAll('[data-action="retry"]').length).toBe(3);
  });

  it('shows the empty-state messages when genuinely no users/tasks/projects', () => {
    const content = document.createElement('div');
    renderContent(content, baseState(), 'me');
    expect(content.textContent).toMatch(/no users found/i);
    expect(content.textContent).toMatch(/no tasks found/i);
    expect(content.textContent).toMatch(/no projects yet/i);
  });

  it('renders rows once loaded successfully with data', () => {
    const content = document.createElement('div');
    const users = [{ id: 'u1', name: 'Sarah Jenkins', email: 's@x.com', role: 'manager', status: 'active', last_active: null }];
    renderContent(content, baseState({ users }), 'me');
    expect(content.querySelector('[data-user-row="u1"]')).toBeTruthy();
  });
});

describe('admin renderContent — Projects', () => {
  it('lists existing projects as tags', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ projects: [{ id: 'p1', name: 'Q3 Planning' }] }), 'me');
    expect(content.querySelector('[data-role="project-list"]').textContent).toContain('Q3 Planning');
  });

  it('shows a project-add validation error inline', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ projectError: 'Something went wrong.' }), 'me');
    expect(content.querySelector('[data-role="project-error"]').textContent).toBe('Something went wrong.');
  });
});
