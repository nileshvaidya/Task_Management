// Help screen is pure static content (no fetch, no loading/error state),
// so unlike the other screens' render coverage this just checks the
// structural contract: every table-of-contents entry has a matching
// section, every referenced screenshot resolves to a real file, and no
// user-controlled string is left unescaped.
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderHelp } from './help.js';

const SCREENSHOTS_DIR = resolve(process.cwd(), 'public/help/screenshots');

const user = { id: 'u1', name: 'Sarah Jenkins', email: 'sarah.j@company.com', role: 'manager' };

function mount(u = user) {
  const el = document.createElement('div');
  el.innerHTML = renderHelp(u);
  return el;
}

describe('help renderHelp', () => {
  it('renders a heading and a table of contents', () => {
    const el = mount();
    expect(el.querySelector('h1').textContent).toMatch(/help.*user manual/i);
    expect(el.querySelectorAll('[data-toc-link]').length).toBeGreaterThan(0);
  });

  it('every table-of-contents link points at a section that actually exists in the page', () => {
    const el = mount();
    const links = Array.from(el.querySelectorAll('[data-toc-link]'));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const targetId = link.getAttribute('href').slice(1);
      expect(el.querySelector(`#${targetId}`), `missing section for ${targetId}`).toBeTruthy();
    }
  });

  it('covers every major screen in the app (Dashboard, New Task, Dependencies, Team, Export, Admin, PWA, Troubleshooting)', () => {
    const el = mount();
    const text = el.textContent;
    expect(text).toMatch(/Dashboard/);
    expect(text).toMatch(/New Task/);
    expect(text).toMatch(/Has Dependency/);
    expect(text).toMatch(/Team Overview/);
    expect(text).toMatch(/Export CSV/);
    expect(text).toMatch(/Export PDF/);
    expect(text).toMatch(/Add User/);
    expect(text).toMatch(/Install App/);
    expect(text).toMatch(/inactive/i);
  });

  it('every screenshot <img> src points at a file that actually exists in public/help/screenshots', () => {
    const el = mount();
    const files = new Set(readdirSync(SCREENSHOTS_DIR));
    const imgs = Array.from(el.querySelectorAll('img'));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      const filename = img.getAttribute('src').split('/').pop();
      expect(files.has(filename), `${filename} referenced but not found on disk`).toBe(true);
    }
  });

  it('every <img> has non-empty alt text', () => {
    const el = mount();
    el.querySelectorAll('img').forEach((img) => {
      expect(img.getAttribute('alt')?.length).toBeGreaterThan(0);
    });
  });

  it('escapes the signed-in user\'s name in the footer line', () => {
    const el = mount({ ...user, name: '<script>alert(1)</script>' });
    expect(el.querySelector('script')).toBeNull();
  });

  it('mentions the signed-in user\'s role in the footer line', () => {
    const el = mount({ ...user, role: 'employee' });
    expect(el.textContent).toMatch(/employee/);
  });
});
