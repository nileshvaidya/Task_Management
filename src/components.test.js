import { describe, it, expect } from 'vitest';
import { getByText } from '@testing-library/dom';
import {
  escapeHtml,
  initials,
  renderIdentityBlock,
  renderTaskRow,
  renderActivityCard,
  renderMemberCard,
} from './components.js';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands and single quotes', () => {
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });

  it('passes plain text through unchanged', () => {
    expect(escapeHtml('Review PR #12')).toBe('Review PR #12');
  });

  it('coerces non-string input', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Sarah Jenkins')).toBe('SJ');
  });

  it('handles a single-word name', () => {
    expect(initials('Cher')).toBe('C');
  });

  it('caps at two characters for long names', () => {
    expect(initials('Sarah Jane Jenkins')).toBe('SJ');
  });
});

describe('renderIdentityBlock', () => {
  const user = { name: 'Sarah Jenkins', email: 'sarah.j@company.com' };

  it('renders the name, email, and initials', () => {
    const el = renderIdentityBlock(user);
    expect(getByText(el, 'Sarah Jenkins')).toBeTruthy();
    expect(getByText(el, 'sarah.j@company.com')).toBeTruthy();
    expect(getByText(el, 'SJ')).toBeTruthy();
  });

  it('escapes HTML in the name and email', () => {
    const el = renderIdentityBlock({ name: '<b>Evil</b>', email: 'x@x.com' });
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('[data-role="identity-name"]').textContent).toBe('<b>Evil</b>');
  });
});

describe('renderTaskRow', () => {
  const baseTask = {
    id: 't1',
    title: 'Write report',
    status: 'planned',
    due_date: '2026-08-20',
    blocked: false,
    blocked_reason: null,
  };

  function mount(task) {
    const el = document.createElement('div');
    el.innerHTML = renderTaskRow(task);
    return el;
  }

  it('renders the title without strikethrough for a planned task', () => {
    const el = mount(baseTask);
    const title = el.querySelector('.task-row > div:nth-child(2) > div');
    expect(title.textContent).toBe('Write report');
    expect(title.className).not.toMatch(/line-through/);
  });

  it('applies the strikethrough class when the task is completed', () => {
    const el = mount({ ...baseTask, status: 'completed' });
    const title = el.querySelector('.task-row > div:nth-child(2) > div');
    expect(title.className).toMatch(/line-through/);
  });

  it('the round toggle reflects done state via data attributes and aria-label', () => {
    const notDone = mount(baseTask).querySelector('[data-action="toggle-done"]');
    expect(notDone.getAttribute('aria-label')).toMatch(/mark as completed/i);

    const done = mount({ ...baseTask, status: 'completed' }).querySelector('[data-action="toggle-done"]');
    expect(done.getAttribute('aria-label')).toMatch(/mark as planned/i);
  });

  it('shows the status select with the current status selected', () => {
    const el = mount({ ...baseTask, status: 'in-progress' });
    const select = /** @type {HTMLSelectElement} */ (el.querySelector('[data-action="status-select"]'));
    expect(select.value).toBe('in-progress');
  });

  it('shows a blocked line with the reason when blocked, and a Blocked tag', () => {
    const el = mount({ ...baseTask, blocked: true, blocked_reason: 'Waiting on legal' });
    expect(getByText(el, /Waiting on: Waiting on legal/)).toBeTruthy();
    expect(getByText(el, 'Blocked')).toBeTruthy();
  });

  it('shows no blocked line when not blocked', () => {
    const el = mount(baseTask);
    expect(el.textContent).not.toMatch(/Waiting on/);
  });

  it('escapes HTML in the title', () => {
    const el = mount({ ...baseTask, title: '<img src=x onerror=alert(1)>' });
    expect(el.querySelector('img')).toBeNull();
  });
});

describe('renderActivityCard', () => {
  function mount(entry) {
    const el = document.createElement('div');
    el.innerHTML = renderActivityCard(entry);
    return el;
  }

  it('renders the actor name, verb text, and detail', () => {
    const el = mount({
      actor: { name: 'Sarah Jenkins' },
      verb: 'created',
      detail: 'Write report',
      created_at: new Date().toISOString(),
    });
    expect(getByText(el, /Sarah Jenkins/)).toBeTruthy();
    expect(getByText(el, /created a task/)).toBeTruthy();
    expect(getByText(el, 'Write report')).toBeTruthy();
    expect(getByText(el, 'Created')).toBeTruthy();
  });

  it('falls back to "Someone" when the actor is missing', () => {
    const el = mount({ actor: null, verb: 'created', detail: 'x', created_at: new Date().toISOString() });
    expect(getByText(el, /Someone/)).toBeTruthy();
  });

  it('shows the Status Update tag for a status_changed entry', () => {
    const el = mount({
      actor: { name: 'David Chen' },
      verb: 'status_changed',
      detail: 'Write report → completed',
      created_at: new Date().toISOString(),
    });
    expect(getByText(el, 'Status Update')).toBeTruthy();
  });

  it('escapes HTML in the actor name and detail', () => {
    const el = mount({
      actor: { name: '<b>Evil</b>' },
      verb: 'created',
      detail: '<img src=x onerror=alert(1)>',
      created_at: new Date().toISOString(),
    });
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('b')).toBeNull();
  });
});

describe('renderMemberCard', () => {
  const member = { id: 'u1', name: 'Sarah Jenkins', role: 'manager', status: 'active' };

  function mount(m, focus) {
    const el = document.createElement('div');
    el.innerHTML = renderMemberCard(m, focus);
    return el;
  }

  it('renders the member name, role label, and status tag', () => {
    const el = mount(member, []);
    expect(getByText(el, 'Sarah Jenkins')).toBeTruthy();
    expect(getByText(el, 'Manager')).toBeTruthy();
    expect(getByText(el, 'Active')).toBeTruthy();
  });

  it("shows each focus item, striking through completed ones", () => {
    const el = mount(member, [
      { id: 't1', title: 'Not done yet', done: false },
      { id: 't2', title: 'Already done', done: true },
    ]);
    const notDone = getByText(el, 'Not done yet');
    const done = getByText(el, 'Already done');
    expect(notDone.getAttribute('style')).not.toMatch(/line-through/);
    expect(done.getAttribute('style')).toMatch(/line-through/);
  });

  it('shows a placeholder when nothing is due today', () => {
    const el = mount(member, []);
    expect(getByText(el, /Nothing due today/)).toBeTruthy();
  });

  it('labels an employee correctly', () => {
    const el = mount({ ...member, role: 'employee' }, []);
    expect(getByText(el, 'Employee')).toBeTruthy();
  });
});
