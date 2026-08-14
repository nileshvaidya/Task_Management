// Dev-only convenience: `?demoRole=manager` or `?demoRole=employee` in the
// URL bypasses real Supabase auth entirely, behind VITE_DEMO_MODE so it can
// never activate in a production build unless explicitly enabled. Matches
// the seed data (scripts/seed.js) so screens look right without a live
// session. Never reference this from auth.js's real sign-in/sign-up path.
export const DEMO_USERS = {
  manager: {
    id: 'demo-u1',
    name: 'Sarah Jenkins',
    email: 'sarah.j@company.com',
    role: 'manager',
    manager_id: null,
    status: 'active',
  },
  employee: {
    id: 'demo-u2',
    name: 'David Chen',
    email: 'd.chen@company.com',
    role: 'employee',
    manager_id: 'demo-u1',
    status: 'active',
  },
};

/**
 * @param {boolean} [demoModeEnabled]
 * @param {string} [search]
 */
export function getDemoUser(
  demoModeEnabled = import.meta.env.VITE_DEMO_MODE === 'true',
  search = window.location.search
) {
  if (!demoModeEnabled) return null;
  const role = new URLSearchParams(search).get('demoRole');
  return role === 'manager' || role === 'employee' ? DEMO_USERS[role] : null;
}
