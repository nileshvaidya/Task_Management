// Pure search-filter logic for the User Management table (Phase 4 test
// case 2) — no DOM, no fetching, so it's cheap to unit test against
// fixture data independent of the live-typing UI behavior (covered by
// e2e instead).

/**
 * Case-insensitive substring match against name or email. An empty/blank
 * query returns every user unchanged.
 * @param {Array<{ name: string, email: string }>} users
 * @param {string} query
 */
export function filterUsers(users, query) {
  const q = query.trim().toLowerCase();
  if (!q) return users;
  return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
}
