// In-app Help / User Manual — a static, click-by-click walkthrough of
// every screen, illustrated with real screenshots (public/help/screenshots/,
// captured via scripts/capture-help-screenshots.mjs against demo mode; see
// that script's own comment for how to regenerate them after a UI change).
// No data fetching — this screen is pure static content, unlike every
// other authenticated screen, so it has no loading/error/empty states.
import { getCurrentProfile } from '../auth.js';
import { renderShell } from '../layout.js';
import { escapeHtml } from '../components.js';

const SHOT = '/help/screenshots';

export async function render(container) {
  const user = await getCurrentProfile();
  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  const content = renderShell(container, { activeRoute: '/help', user });
  content.setAttribute('data-screen', 'help');
  content.innerHTML = renderHelp(user);

  content.querySelectorAll('[data-toc-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = content.querySelector(link.getAttribute('href'));
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function img(src, alt) {
  return `<img src="${SHOT}/${src}" alt="${escapeHtml(alt)}" style="width:100%;max-width:640px;border-radius:var(--radius-md);border:1px solid var(--color-divider);margin:10px 0 16px;display:block" />`;
}

function section(id, title, bodyHtml) {
  return `
    <section id="${id}" class="card elev-sm p-5 mb-5" style="scroll-margin-top:16px">
      <h2 class="text-xl font-heading mb-3">${escapeHtml(title)}</h2>
      ${bodyHtml}
    </section>`;
}

function ol(items) {
  return `<ol style="padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:14px;color:var(--color-neutral-300)">${items
    .map((i) => `<li>${i}</li>`)
    .join('')}</ol>`;
}

const TOC = [
  ['help-getting-started', 'Getting Started'],
  ['help-dashboard', 'Dashboard'],
  ['help-new-task', 'Creating a Task'],
  ['help-dependencies', 'Task Dependencies & Acceptance'],
  ['help-team', 'Team Feed & Team Overview'],
  ['help-export', 'Exporting Reports'],
  ['help-admin', 'User Admin (Managers)'],
  ['help-pwa', 'Installing WorkSync as an App'],
  ['help-troubleshooting', 'Troubleshooting'],
];

export function renderHelp(user) {
  return `
    <div class="mb-6">
      <h1 class="text-2xl font-heading mb-1">Help &amp; User Manual</h1>
      <p class="text-neutral-400 m-0">A click-by-click guide to everything in WorkSync, illustrated with real screenshots.</p>
    </div>

    <nav class="card elev-sm p-4 mb-5" aria-label="Table of contents">
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${TOC.map(
          ([id, label]) =>
            `<a href="#${id}" data-toc-link class="tag tag-neutral" style="text-decoration:none;cursor:pointer">${escapeHtml(label)}</a>`
        ).join('')}
      </div>
    </nav>

    ${section(
      'help-getting-started',
      'Getting Started',
      `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:6px">Signing in</h3>
      ${ol([
        'Open WorkSync in your browser. If you already have an account, the <strong>Sign In</strong> tab is selected by default.',
        'Click the <strong>Email</strong> field and type your email address.',
        'Click the <strong>Password</strong> field and type your password.',
        'Click the <strong>Sign In</strong> button.',
        'You\'ll land on the Dashboard. If your account has been deactivated, you\'ll see a message asking you to contact your admin instead — see <a href="#help-troubleshooting" data-toc-link>Troubleshooting</a>.',
      ])}
      ${img('01-login-signin.png', 'The Sign In screen, with the Email and Password fields and the Sign In button')}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">Creating an account</h3>
      ${ol([
        'On the login screen, click the <strong>Sign Up</strong> tab.',
        'Fill in your <strong>Name</strong>, <strong>Email</strong>, and <strong>Password</strong> (minimum 6 characters).',
        'Click the <strong>Role</strong> dropdown and choose <strong>Manager</strong> or <strong>Employee</strong>.',
        'If you chose Employee, a new <strong>Reports to</strong> field appears — click it and select your manager from the list.',
        'Click <strong>Create Account</strong>. You\'ll be signed in immediately and land on the Dashboard.',
      ])}
      ${img('02-login-signup.png', 'The Sign Up tab, showing Name/Email/Password/Role fields and the Reports To field for an employee')}
      `
    )}

    ${section(
      'help-dashboard',
      'Dashboard',
      `
      <p style="font-size:14px;color:var(--color-neutral-300);margin-bottom:10px">Your Dashboard has four cards: <strong>Plan Today</strong> (quick-add a task due today), <strong>Active Tasks</strong> (your task list), <strong>Weekly Progress</strong> (a completion tally), and <strong>Advance Planning</strong> (a calendar).</p>
      ${img('03-dashboard-manager.png', "A manager's Dashboard showing all four cards and a task list with mixed statuses")}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">Quick-adding a task due today</h3>
      ${ol([
        'Click the <strong>"What needs to be done today?"</strong> field under Plan Today.',
        'Type a title.',
        'Click <strong>Add</strong>. The task appears at the top of Active Tasks, due today, with no further setup — for a fully-detailed task (project, priority, dependencies), use <a href="#help-new-task" data-toc-link>+ New Task</a> instead.',
      ])}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">Filtering the Active Tasks list</h3>
      ${ol([
        '<strong>Mine / My Team</strong> (managers only): click <strong>My Team</strong> to see every direct report\'s tasks instead of just your own; click <strong>Mine</strong> to switch back.',
        '<strong>All / Pending</strong>: click <strong>Pending</strong> to hide completed tasks; click <strong>All</strong> to show everything again.',
      ])}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">Marking a task done</h3>
      ${ol([
        'Click the round circle button to the left of a task\'s title to toggle it between <strong>Completed</strong> and <strong>Planned</strong>. A completed task\'s title shows with a strikethrough.',
        'Or, click the status dropdown next to the task (Planned / In-Progress / Completed) to set a specific status directly.',
      ])}
      <p style="font-size:13px;color:var(--color-neutral-500)">Note: a task waiting on your acceptance (see <a href="#help-dependencies" data-toc-link>Task Dependencies &amp; Acceptance</a>) shows neither of these controls until you accept it.</p>
      `
    )}

    ${section(
      'help-new-task',
      'Creating a Task',
      `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:6px">Opening the New Task dialog</h3>
      ${ol([
        'Click <strong>+ New Task</strong> in the sidebar (or the floating <strong>+</strong> button in the bottom-right on mobile).',
      ])}
      ${img('04-new-task-basic.png', 'The New Task dialog with the Project, Task Title, Description, Date, Estimated Time, Assign To, and Priority Level fields')}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">Filling in the basics</h3>
      ${ol([
        '<strong>Project</strong> (optional): click the dropdown to pick an existing project, or click <strong>+ New</strong> next to it, type a name in the field that appears, and click <strong>Add</strong>.',
        '<strong>Task Title</strong>: click the field and type a title (required).',
        '<strong>Description</strong> (optional): click the text area and type any extra detail.',
        '<strong>Date</strong>: click the date field and pick a due date. It defaults to today and can\'t be set in the past.',
        '<strong>Estimated Time (hrs)</strong> (optional): click the field and type a number.',
        '<strong>Assign To</strong>: as a manager, click the dropdown to assign the task to yourself or a direct report. As an employee, this is locked to yourself for a primary task — use dependencies (below) to hand work to someone else.',
        '<strong>Priority Level</strong>: click one of <strong>Low</strong>, <strong>Medium</strong>, <strong>High</strong>, or <strong>Critical</strong>.',
      ])}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">Submitting</h3>
      ${ol([
        'Click <strong>Create Task</strong> at the bottom of the dialog. If anything required is missing or invalid, an error message appears above the form and nothing is submitted — fix it and click Create Task again.',
        'Click <strong>Cancel</strong> (or the <strong>✕</strong> in the top-right corner) at any point to close the dialog without creating anything.',
      ])}
      `
    )}

    ${section(
      'help-dependencies',
      'Task Dependencies & Acceptance',
      `
      <p style="font-size:14px;color:var(--color-neutral-300);margin-bottom:10px">A dependency links your task to another task — your own or someone else's — so you can track what you're waiting on, or hand off a prerequisite to a specific person, company-wide (not just your own team).</p>

      <h3 style="font-size:15px;font-weight:600;margin-bottom:6px">Adding a dependency while creating a task</h3>
      ${ol([
        'In the New Task dialog, click the <strong>Has Dependency</strong> toggle switch to turn it on.',
        'Choose a mode: click <strong>Create New</strong> to define a brand-new dependency task, or <strong>Search Existing</strong> to link to a task that already exists.',
        '<u>Create New</u>: type a <strong>New Dependency Title</strong>, then click the <strong>Assign To</strong> dropdown and pick anyone in the company (not limited to your team).',
        '<u>Search Existing</u>: type in the search box to filter the company-wide task list by title or owner, then click a result to select it.',
        'Tick <strong>Requires acceptance by assignee</strong> if the primary task should stay blocked until the person you assigned the dependency to explicitly accepts it. Leave it unchecked to just link the two tasks without blocking anything.',
        'Click <strong>Create Task</strong>. If you checked "Requires acceptance," your primary task immediately shows a <strong>"Waiting on: ..."</strong> line and its status locks to Planned until the dependency is accepted and completed.',
      ])}
      ${img('05-new-task-dependency.png', 'The Has Dependency section expanded: Create New / Search Existing tabs, New Dependency Title, Assign To, and the Requires acceptance checkbox')}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">Accepting a task assigned to you</h3>
      ${ol([
        'When someone assigns you a task that requires acceptance, it shows a <strong>"Pending your acceptance"</strong> tag on your Dashboard instead of the usual status controls.',
        'Tick the <strong>Task Accepted</strong> checkbox next to it.',
        'The tag disappears and the normal status controls (round toggle + dropdown) appear — you can now move the task through its statuses as usual.',
      ])}
      ${img('06-dashboard-employee-pending-acceptance.png', 'An employee\'s Dashboard showing a task tagged "Pending your acceptance" with a Task Accepted checkbox')}
      <p style="font-size:13px;color:var(--color-neutral-500)">When you complete a dependency task, whoever's task was waiting on it automatically unblocks — no extra step needed — and it shows up as an "unblocked" entry in their <a href="#help-team" data-toc-link>Team Feed</a>.</p>
      `
    )}

    ${section(
      'help-team',
      'Team Feed & Team Overview',
      `
      <p style="font-size:14px;color:var(--color-neutral-300);margin-bottom:10px">Click <strong>Team Feed</strong> in the sidebar. This screen has two tabs, both scoped to your own team (your manager plus your teammates, or your direct reports).</p>

      <h3 style="font-size:15px;font-weight:600;margin-bottom:6px">Activity Feed tab</h3>
      ${ol([
        'Click the <strong>Activity Feed</strong> tab (selected by default).',
        'Scroll through a live, newest-first log of what your team has done — tasks created, status changes, acceptances, blockers raised and cleared.',
      ])}
      ${img('07-team-activity-feed.png', 'The Activity Feed tab with a list of team activity entries')}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">Team Overview tab</h3>
      ${ol([
        'Click the <strong>Team Overview</strong> tab.',
        '<strong>Team Pulse</strong> shows your team\'s average completion percentage across active and completed tasks.',
        '<strong>Blockers & Alerts</strong> lists every currently-blocked task and why.',
        'Each team member\'s card shows their <strong>Today\'s Focus</strong> — whatever they have due today.',
      ])}
      ${img('08-team-overview.png', 'The Team Overview tab showing Team Pulse, Blockers & Alerts, and per-member Today\'s Focus cards')}
      `
    )}

    ${section(
      'help-export',
      'Exporting Reports',
      `
      <p style="font-size:14px;color:var(--color-neutral-300);margin-bottom:10px">From the <strong>Team Feed</strong> screen (either tab), you can export your team's task history.</p>
      ${ol([
        'Click <strong>Export CSV</strong> to download a spreadsheet-friendly file (title, owner, status, due date, priority, and blocked reason for every team task).',
        'Click <strong>Export PDF</strong> to download the same data as a formatted PDF document.',
        'Both buttons are disabled while the screen is still loading, or if it failed to load — wait for the page to finish loading, or click <strong>Retry</strong> if you see an error.',
      ])}
      <p style="font-size:13px;color:var(--color-neutral-500)">Both buttons are visible in the Team Overview screenshot above, next to the Activity Feed / Team Overview tab switcher.</p>
      `
    )}

    ${section(
      'help-admin',
      'User Admin (Managers)',
      `
      <p style="font-size:14px;color:var(--color-neutral-300);margin-bottom:10px">Click <strong>User Admin</strong> in the sidebar (only visible if you're a manager — this screen manages every user and task in the company, not just your own team).</p>
      ${img('09-admin-user-management.png', 'The Admin screen: User Management table and Global Task Control table')}

      <h3 style="font-size:15px;font-weight:600;margin-bottom:6px">Adding a user</h3>
      ${ol([
        'Click <strong>Add User</strong>.',
        'Fill in <strong>Name</strong> and <strong>Email</strong>.',
        'Click the <strong>Role</strong> dropdown and choose Manager or Employee — for an employee, also pick who they report to.',
        'Click <strong>Send Invite</strong>. The new user receives an email to set their password and can then sign in.',
      ])}
      ${img('10-admin-add-user.png', 'The Add User dialog with Name and Email fields filled in')}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">Managing existing users</h3>
      ${ol([
        'Type in the <strong>Search users…</strong> field to filter the table by name or email.',
        'Click the <strong>⏻</strong> icon next to a user to toggle them between Active and Inactive — an inactive user is blocked from signing in.',
        'Click the <strong>🗑</strong> icon to delete a user; click <strong>Yes, delete</strong> to confirm or <strong>Cancel</strong> to back out. Their open tasks are automatically reassigned to their manager (or to you, for a deleted manager) for triage.',
      ])}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">Overriding any task</h3>
      ${ol([
        'In the Global Task Control table, click <strong>OVERRIDE</strong> next to any task, company-wide.',
        'Click the status dropdown and/or the owner dropdown that appear to set either.',
        'Click <strong>Apply</strong> to save, or <strong>Cancel</strong> to back out. This bypasses the normal acceptance/ownership rules — use it to unstick a task that\'s genuinely stuck.',
      ])}
      `
    )}

    ${section(
      'help-pwa',
      'Installing WorkSync as an App',
      `
      ${ol([
        'If your browser supports it, an <strong>Install App</strong> button appears in the sidebar (desktop) or as an icon in the top bar (mobile) once it\'s ready.',
        'Click it, then confirm in the browser\'s own install prompt.',
        'WorkSync now opens like a native app, works offline for anything already loaded, and stays up to date automatically.',
      ])}
      <p style="font-size:13px;color:var(--color-neutral-500)">The button only appears when your browser decides the app is installable — this can take a moment on first visit, and some browsers (e.g. Firefox) don't support it at all.</p>
      `
    )}

    ${section(
      'help-troubleshooting',
      'Troubleshooting',
      `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:6px">"This account is inactive. Contact your admin."</h3>
      <p style="font-size:14px;color:var(--color-neutral-300)">A manager has deactivated your account. Ask a manager to reactivate you from <a href="#help-admin" data-toc-link>User Admin</a>.</p>

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">The app looks out of date, or a page doesn't respond to clicks</h3>
      <p style="font-size:14px;color:var(--color-neutral-300);margin-bottom:6px">WorkSync installs a service worker for offline support, which can occasionally hold onto an old cached version. To force a fresh copy:</p>
      ${ol([
        'Open your browser\'s developer tools (usually <strong>F12</strong>).',
        'Go to the <strong>Application</strong> tab → <strong>Service Workers</strong>, and click <strong>Unregister</strong>.',
        'Still in the Application tab, click <strong>Storage</strong> → <strong>Clear site data</strong>.',
        'Close the tab, then open WorkSync again.',
      ])}

      <h3 style="font-size:15px;font-weight:600;margin:14px 0 6px">A list shows an error instead of my data</h3>
      <p style="font-size:14px;color:var(--color-neutral-300)">Click the <strong>Retry</strong> button shown with the error. If it keeps failing, check your internet connection, or contact your admin — the underlying service may be temporarily unavailable.</p>
      `
    )}

    <p style="font-size:13px;color:var(--color-neutral-500);text-align:center;margin-top:8px">Signed in as ${escapeHtml(user.name)} (${escapeHtml(user.role)}). For anything not covered here, contact your manager or admin.</p>
  `;
}
