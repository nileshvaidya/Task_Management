// Shared authenticated-app shell: desktop sidebar / mobile top bar +
// bottom tabs. Both variants render into the same DOM simultaneously and
// are shown/hidden purely by Tailwind's responsive classes (`hidden
// md:flex` etc.) — per the build brief, this must be real CSS breakpoints,
// not a JS device-state switch like the design prototype used.
import { escapeHtml, renderIdentityBlock, initials } from './components.js';
import { signOutUser } from './auth.js';
import { open as openNewTaskDialog } from './dialogs/newTaskDialog.js';
import { installState, promptInstall } from './pwaInstall.js';

const NAV_ITEMS = [
  { route: '/dashboard', label: 'Dashboard', mobileLabel: 'Dashboard' },
  { route: '/team', label: 'Team Feed', mobileLabel: 'Team' },
  { route: '/admin', label: 'User Admin', mobileLabel: 'Admin' },
];

const NAV_ICONS = {
  '/dashboard':
    '<path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM104,200H40V56h64Zm112,0H120V56h96Z"/>',
  '/team':
    '<path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"/>',
  '/admin':
    '<path d="M208,40H48A16,16,0,0,0,32,56v58.78c0,89.61,75.82,119.34,91,124.39a15.53,15.53,0,0,0,10,0c15.2-5.05,91-34.78,91-124.39V56A16,16,0,0,0,208,40Zm-16,74.79c0,78-66.86,101.13-79,105-1.19.39-2.79.39-4,0-12.15-3.83-79-27-79-105V56H192Z"/>',
};

/**
 * @param {HTMLElement} container
 * @param {{ activeRoute: string, user: { id: string, name: string, email: string, role: string } }} opts
 * @returns {HTMLElement} the content mount point for the calling screen to render into
 */
export function renderShell(container, { activeRoute, user }) {
  // User Admin is restricted to managers (Phase 4 test case 1) — no point
  // showing a nav link that would just redirect an employee away.
  const visibleNavItems = NAV_ITEMS.filter((item) => item.route !== '/admin' || user.role === 'manager');

  const navHtml = (mobile) =>
    visibleNavItems.map((item) => {
      const active = item.route === activeRoute;
      const cls = mobile
        ? `flex-1 text-center text-[11px] ${active ? 'text-accent' : 'text-neutral-500'}`
        : `wsnav-item ${active ? 'wsnav-item-active' : ''}`;
      return `
        <a href="#${item.route}" class="${cls}" data-nav="${item.route}">
          <svg width="${mobile ? 18 : 16}" height="${mobile ? 18 : 16}" viewBox="0 0 256 256" fill="currentColor"${mobile ? ' style="margin:0 auto 2px"' : ''}>${NAV_ICONS[item.route]}</svg>
          <span>${mobile ? item.mobileLabel : item.label}</span>
        </a>`;
    }).join('');

  container.innerHTML = `
    <style>
      .wsnav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-sm);font-size:14px;color:var(--color-neutral-300);border-left:2px solid transparent;text-decoration:none}
      .wsnav-item:hover{background:color-mix(in srgb, var(--color-text) 6%, transparent)}
      .wsnav-item-active{background:var(--color-accent-800);color:var(--color-accent-100);border-left-color:var(--color-accent)}
    </style>
    <div class="min-h-screen md:flex">
      <aside class="hidden md:flex md:flex-col w-60 flex-none p-4" style="background:var(--color-surface);border-right:1px solid var(--color-divider)">
        <div class="flex items-center gap-2 px-1.5 pb-5">
          <svg width="20" height="20" viewBox="0 0 256 256" fill="var(--color-accent)"><path d="M216,56H176V48a24,24,0,0,0-24-24H104A24,24,0,0,0,80,48v8H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V72A16,16,0,0,0,216,56ZM96,48a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Z"/></svg>
          <span style="font-family:var(--font-heading);font-weight:600;font-size:17px">WorkSync</span>
        </div>
        <button type="button" class="btn btn-primary btn-block mb-4" data-action="open-new-task">+ New Task</button>
        <nav class="flex flex-col gap-1">${navHtml(false)}</nav>
        <div class="flex-1"></div>
        <button type="button" class="btn btn-secondary mb-2 ${installState.getState().available ? '' : 'hidden'}" data-action="install-app">Install App</button>
        <a href="#/help" class="btn btn-ghost mb-2" data-nav="/help" style="text-decoration:none;text-align:center">Help</a>
        <div data-role="sidebar-identity" class="p-2 mt-3" style="border-top:1px solid var(--color-divider)"></div>
        <button type="button" class="btn btn-ghost mt-2" data-action="sign-out">Sign out</button>
      </aside>

      <div class="flex md:hidden items-center justify-between px-4 py-3" style="border-bottom:1px solid var(--color-divider)">
        <div class="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 256 256" fill="var(--color-accent)"><path d="M216,56H176V48a24,24,0,0,0-24-24H104A24,24,0,0,0,80,48v8H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V72A16,16,0,0,0,216,56Z"/></svg>
          <span style="font-family:var(--font-heading);font-weight:600;font-size:16px">WorkSync</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="wsicon-btn ${installState.getState().available ? '' : 'hidden'}" data-action="install-app" aria-label="Install App" title="Install App" style="width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-400)">⭳</button>
          <a href="#/help" class="wsicon-btn" data-nav="/help" aria-label="Help" title="Help" style="width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-400);text-decoration:none;display:flex;align-items:center;justify-content:center">?</a>
          <button type="button" class="wsicon-btn" data-action="sign-out" aria-label="Sign out" style="width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-400)">⎋</button>
          <div style="width:28px;height:28px;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">${escapeHtml(initials(user.name))}</div>
        </div>
      </div>

      <main class="flex-1 min-w-0 p-4 md:p-8 pb-24 md:pb-8" data-role="content"></main>

      <button type="button" data-action="open-new-task" class="md:hidden fixed bottom-20 right-5 w-13 h-13 rounded-full flex items-center justify-center text-2xl" style="width:52px;height:52px;background:var(--color-accent);color:var(--color-bg);border:none;box-shadow:var(--shadow-md)">+</button>

      <div class="md:hidden fixed bottom-0 left-0 right-0 flex py-2" style="background:var(--color-surface);border-top:1px solid var(--color-divider)">
        ${navHtml(true)}
      </div>
    </div>
  `;

  const identityMount = container.querySelector('[data-role="sidebar-identity"]');
  if (identityMount) identityMount.appendChild(renderIdentityBlock(user));

  container.querySelectorAll('[data-action="sign-out"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await signOutUser();
      window.location.hash = '#/login';
    });
  });

  container.querySelectorAll('[data-action="open-new-task"]').forEach((btn) => {
    btn.addEventListener('click', () => openNewTaskDialog(user));
  });

  const installButtons = container.querySelectorAll('[data-action="install-app"]');
  installButtons.forEach((btn) => btn.addEventListener('click', () => promptInstall()));
  // beforeinstallprompt can fire at any point after page load — including
  // after this shell already rendered — so keep the button(s) in sync with
  // installState for as long as this screen is mounted, same cleanup
  // pattern as the other cross-cutting window-event subscriptions in this
  // codebase (dashboard.js's worksync:task-created, admin.js's
  // worksync:user-invited).
  const unsubscribeInstall = installState.subscribe(() => {
    installButtons.forEach((btn) => btn.classList.toggle('hidden', !installState.getState().available));
  });
  window.addEventListener('hashchange', unsubscribeInstall, { once: true });

  return container.querySelector('[data-role="content"]');
}
