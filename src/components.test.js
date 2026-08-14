import { describe, it, expect } from 'vitest';
import { escapeHtml } from './components.js';

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
