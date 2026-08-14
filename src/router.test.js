import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getByText } from '@testing-library/dom';
import { renderRoute, normalizePath } from './router.js';

const authed = async () => ({ id: 'u1' });
const anon = async () => null;

// The router's own guard (mocked per-test via the sessionCheck param below)
// is separate from each screen module's own getCurrentProfile() call,
// which it uses to render the user's name/identity block. Override only
// that export — getSessionUser must stay real, since login.js's own
// "already signed in, redirect forward" check also calls it, and a global
// fake session there would break every "shows the login screen" case.
vi.mock('./auth.js', async (importOriginal) => {
  const actual = /** @type {object} */ (await importOriginal());
  return {
    ...actual,
    getCurrentProfile: vi.fn(async () => ({ id: 'u1', name: 'Test User', email: 'test@example.com', role: 'employee' })),
  };
});

// dashboard.js fetches tasks on render. Unit tests must never depend on
// network reachability regardless of what VITE_SUPABASE_URL happens to be
// set to in the ambient environment — mock this unconditionally rather
// than relying on it being unset (see CHANGELOG for the CI incident this
// gap caused).
vi.mock('./tasks.js', () => ({
  fetchMyTasks: vi.fn(async () => []),
  fetchTeamTasks: vi.fn(async () => []),
  createTask: vi.fn(),
  setTaskStatus: vi.fn(),
  toggleTaskDone: vi.fn(),
}));

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

describe('renderRoute — protected routes with a session', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('mounts the dashboard screen for #/dashboard when signed in', async () => {
    const path = await renderRoute(container, '#/dashboard', authed);
    expect(path).toBe('/dashboard');
    expect(container.querySelector('[data-screen="dashboard"]')).toBeTruthy();
    expect(getByText(container, /good morning/i)).toBeTruthy();
  });

  it('mounts the team screen for #/team when signed in', async () => {
    await renderRoute(container, '#/team', authed);
    expect(container.querySelector('[data-screen="team"]')).toBeTruthy();
  });

  it('mounts the admin screen for #/admin when signed in', async () => {
    await renderRoute(container, '#/admin', authed);
    expect(container.querySelector('[data-screen="admin"]')).toBeTruthy();
  });
});

describe('renderRoute — auth guard', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('redirects an unauthenticated visitor to login instead of the dashboard', async () => {
    const path = await renderRoute(container, '#/dashboard', anon);
    expect(path).toBe('/login');
    expect(container.querySelector('[data-screen="login"]')).toBeTruthy();
  });

  it('redirects an unauthenticated visitor away from team and admin too', async () => {
    expect(await renderRoute(container, '#/team', anon)).toBe('/login');
    expect(await renderRoute(container, '#/admin', anon)).toBe('/login');
  });

  it('never calls the session check for the public login route', async () => {
    let called = false;
    const spy = async () => {
      called = true;
      return null;
    };
    await renderRoute(container, '#/login', spy);
    expect(called).toBe(false);
  });
});

describe('renderRoute — unknown hash', () => {
  it('mounts the login screen by default for an unrecognized hash', async () => {
    const container = document.createElement('div');
    const path = await renderRoute(container, '#/nonexistent', anon);
    expect(path).toBe('/login');
    expect(container.querySelector('[data-screen="login"]')).toBeTruthy();
  });
});
