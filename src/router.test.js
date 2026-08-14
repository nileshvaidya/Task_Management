import { describe, it, expect, beforeEach } from 'vitest';
import { getByRole } from '@testing-library/dom';
import { renderRoute, normalizePath } from './router.js';

describe('normalizePath', () => {
  it('maps known hashes to their route', () => {
    expect(normalizePath('#/dashboard')).toBe('/dashboard');
    expect(normalizePath('#/team')).toBe('/team');
    expect(normalizePath('#/admin')).toBe('/admin');
  });

  it('falls back to the default route for unknown or empty hashes', () => {
    expect(normalizePath('')).toBe('/login');
    expect(normalizePath('#/nope')).toBe('/login');
  });
});

describe('renderRoute', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('mounts the dashboard screen for #/dashboard', async () => {
    const path = await renderRoute(container, '#/dashboard');
    expect(path).toBe('/dashboard');
    expect(container.querySelector('[data-screen="dashboard"]')).toBeTruthy();
    expect(getByRole(container, 'heading', { name: /dashboard/i })).toBeTruthy();
  });

  it('mounts the team screen for #/team', async () => {
    await renderRoute(container, '#/team');
    expect(container.querySelector('[data-screen="team"]')).toBeTruthy();
  });

  it('mounts the admin screen for #/admin', async () => {
    await renderRoute(container, '#/admin');
    expect(container.querySelector('[data-screen="admin"]')).toBeTruthy();
  });

  it('mounts the login screen by default for an unrecognized hash', async () => {
    const path = await renderRoute(container, '#/nonexistent');
    expect(path).toBe('/login');
    expect(container.querySelector('[data-screen="login"]')).toBeTruthy();
  });
});
