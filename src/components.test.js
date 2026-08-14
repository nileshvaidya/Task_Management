import { describe, it, expect } from 'vitest';
import { getByText } from '@testing-library/dom';
import { escapeHtml, initials, renderIdentityBlock } from './components.js';

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
