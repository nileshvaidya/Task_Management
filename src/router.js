// Hash-based router for the single-shell app. Screens are lazy-loaded ES
// modules, each exporting render(container). Kept decoupled from
// window.location where possible so renderRoute() is unit-testable without
// touching global browser state.
export const routes = {
  '/login': () => import('./screens/login.js'),
  '/dashboard': () => import('./screens/dashboard.js'),
  '/team': () => import('./screens/team.js'),
  '/admin': () => import('./screens/admin.js'),
};

export const DEFAULT_ROUTE = '/login';

export function normalizePath(hash) {
  const path = String(hash || '').replace(/^#/, '');
  return path in routes ? path : DEFAULT_ROUTE;
}

export async function renderRoute(container, hash = window.location.hash) {
  const path = normalizePath(hash);
  const mod = await routes[path]();
  container.innerHTML = '';
  mod.render(container);
  return path;
}

export function startRouter(container) {
  const handler = () => renderRoute(container);
  window.addEventListener('hashchange', handler);
  if (!window.location.hash) {
    window.location.hash = `#${DEFAULT_ROUTE}`;
  } else {
    handler();
  }
  return handler;
}
