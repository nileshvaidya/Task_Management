// Loading/empty/error render coverage (Phase 6) for the Team screen,
// isolated from render()'s Supabase/auth wiring by calling renderContent
// directly with a fake state.
import { describe, it, expect } from 'vitest';
import { renderContent } from './team.js';

function baseState(overrides = {}) {
  return {
    tab: 'feed',
    activity: [],
    teamTasks: [],
    teamMembers: [],
    loading: false,
    error: false,
    ...overrides,
  };
}

describe('team renderContent — async states', () => {
  it('shows a loading skeleton while loading', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ loading: true }));
    expect(content.querySelector('[data-role="list-skeleton"]')).toBeTruthy();
  });

  it('shows an error state with a retry action when the load failed', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ error: true }));
    expect(content.querySelector('[data-role="error-state"]')).toBeTruthy();
    expect(content.querySelector('[data-action="retry"]')).toBeTruthy();
  });

  it('shows the empty-state message for the feed tab when genuinely no activity', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ tab: 'feed', activity: [] }));
    expect(content.querySelector('[data-tab="feed"]').textContent).toMatch(/no team activity yet/i);
  });

  it('renders activity cards once loaded successfully with data', () => {
    const content = document.createElement('div');
    const activity = [{ actor: { name: 'Sarah' }, verb: 'created', detail: 'x', created_at: new Date().toISOString() }];
    renderContent(content, baseState({ tab: 'feed', activity }));
    expect(content.querySelector('[data-tab="feed"]').textContent).toMatch(/Sarah/);
  });

  it('shows the overview tab empty-state message when there are no team members', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ tab: 'overview', teamMembers: [] }));
    expect(content.querySelector('[data-role="member-cards"]').textContent).toMatch(/no team members found/i);
  });
});

describe('team renderContent — export buttons (Phase 7)', () => {
  it('renders Export CSV/PDF buttons, enabled once data has loaded', () => {
    const content = document.createElement('div');
    renderContent(content, baseState());
    const csvBtn = content.querySelector('[data-action="export-csv"]');
    const pdfBtn = content.querySelector('[data-action="export-pdf"]');
    expect(csvBtn).toBeTruthy();
    expect(pdfBtn).toBeTruthy();
    expect(csvBtn.hasAttribute('disabled')).toBe(false);
    expect(pdfBtn.hasAttribute('disabled')).toBe(false);
  });

  it('disables the export buttons while loading', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ loading: true }));
    expect(content.querySelector('[data-action="export-csv"]').hasAttribute('disabled')).toBe(true);
    expect(content.querySelector('[data-action="export-pdf"]').hasAttribute('disabled')).toBe(true);
  });

  it('disables the export buttons on error (nothing loaded to export)', () => {
    const content = document.createElement('div');
    renderContent(content, baseState({ error: true }));
    expect(content.querySelector('[data-action="export-csv"]').hasAttribute('disabled')).toBe(true);
    expect(content.querySelector('[data-action="export-pdf"]').hasAttribute('disabled')).toBe(true);
  });
});
