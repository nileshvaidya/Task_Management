import { describe, it, expect } from 'vitest';
import { getByText } from '@testing-library/dom';
import { escapeHtml, initials, renderIdentityBlock, renderTaskRow } from './components.js';

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
