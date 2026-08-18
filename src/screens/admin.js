// User Admin: User Management table (search, Add User, toggle
// active/inactive, soft-delete) + Global Task Control table (OVERRIDE).
// Restricted to Manager role — "managers = admins" (build brief §0) — and
// deliberately company-wide, unlike the team-scoped Dashboard/Team screens;
// see supabase/schema.sql's Phase 4 section for why that's the one
// intentional exception. Inline row-level editing (confirm-delete,
// override) instead of extra modals, kept to one open editor at a time via
// simple top-level state fields.
import { getCurrentProfile } from '../auth.js';
import { renderShell } from '../layout.js';
import { escapeHtml, initials, renderListSkeleton, renderErrorState } from '../components.js';
import { createStore } from '../state.js';
import { fetchAdminUsers, fetchAdminTasks, setUserStatus, softDeleteUser, overrideTask } from '../admin.js';
import { fetchProjects, createProject } from '../projects.js';
import { filterUsers } from '../adminFilter.js';
import { formatRelativeTime } from '../dateUtils.js';
import { open as openAddUserDialog } from '../dialogs/addUserDialog.js';

const STATUS_LABEL = { planned: 'Planned', 'in-progress': 'In-Progress', completed: 'Completed' };
const STATUS_TAG_CLASS = { planned: 'tag-neutral', 'in-progress': 'tag-outline', completed: 'tag-accent' };

/**
 * A CSS selector that re-finds the same logical element after a full
 * innerHTML re-render, for focus restoration in `paint()` below — same
 * fix, same reason, as newTaskDialog.js's `focusSelectorFor` (Phase 6):
 * the user-search and new-project-name text inputs both push every
 * keystroke into the store, which re-renders the whole screen and remounts
 * them as fresh DOM nodes, silently dropping focus (and, without also
 * restoring caret position, reversing whatever gets typed next).
 * @param {Element|null} el
 */
function focusSelectorFor(el) {
  if (!el) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const role = el.getAttribute('data-role');
  if (role) return `[data-role="${role}"]`;
  return null;
}

export async function render(container) {
  const user = await getCurrentProfile();
  if (!user) {
    window.location.hash = '#/login';
    return;
  }
  if (user.role !== 'manager') {
    window.location.hash = '#/dashboard';
    return;
  }

  const content = renderShell(container, { activeRoute: '/admin', user });
  content.setAttribute('data-screen', 'admin');
  const store = createStore({
    users: [],
    tasks: [],
    projects: [],
    loading: true,
    loadError: false,
    search: '',
    confirmDeleteId: null,
    overrideTaskId: null,
    actionError: '',
    newProjectName: '',
    projectError: '',
  });

  async function loadData() {
    try {
      const [users, tasks, projects] = await Promise.all([fetchAdminUsers(), fetchAdminTasks(), fetchProjects()]);
      store.setState({ users, tasks, projects, loading: false, loadError: false });
    } catch {
      store.setState({ loading: false, loadError: true });
    }
  }

  function paint() {
    const active = content.contains(document.activeElement) ? document.activeElement : null;
    const focusSelector = focusSelectorFor(active);
    let selection = null;
    if (active && 'selectionStart' in active) {
      try {
        selection = { start: /** @type {any} */ (active).selectionStart, end: /** @type {any} */ (active).selectionEnd };
      } catch {
        // Some input types (date/number) don't support selection ranges.
      }
    }
    renderContent(content, store.getState(), user.id);
    wireEvents(content, store, loadData);
    if (focusSelector) {
      const next = /** @type {HTMLElement} */ (content.querySelector(focusSelector));
      next?.focus();
      if (selection && next && 'setSelectionRange' in next) {
        try {
          /** @type {any} */ (next).setSelectionRange(selection.start, selection.end);
        } catch {
          // Same non-text-input-type exception as above.
        }
      }
    }
  }

  store.subscribe(paint);
  paint();
  await loadData();

  const onUserInvited = () => loadData();
  window.addEventListener('worksync:user-invited', onUserInvited);
  window.addEventListener(
    'hashchange',
    () => window.removeEventListener('worksync:user-invited', onUserInvited),
    { once: true }
  );
}

export function renderContent(content, state, currentUserId) {
  const visibleUsers = filterUsers(state.users, state.search);
  const usersById = new Map(state.users.map((u) => [u.id, u]));

  content.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-heading mb-1">Admin Management</h1>
      <p class="text-neutral-400 m-0">Manage system users and oversee global task records.</p>
    </div>

    ${
      state.actionError
        ? `<p data-role="admin-error" class="text-sm mb-4" style="color:var(--color-accent-2-200);background:var(--color-accent-2-900);border:1px solid var(--color-accent-2-700);border-radius:var(--radius-md);padding:8px 12px">${escapeHtml(state.actionError)}</p>`
        : ''
    }

    <div class="card elev-sm p-5 mb-5">
      <div class="flex items-center justify-between mb-3.5 gap-3 flex-wrap">
        <div class="card-title m-0">User Management</div>
        <div class="flex gap-2.5">
          <input class="input" data-role="user-search" placeholder="Search users…" value="${escapeHtml(state.search)}" style="width:200px" />
          <button type="button" class="btn btn-primary" data-action="add-user">Add User</button>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Active</th><th>Actions</th></tr></thead>
          <tbody>
            ${
              state.loading
                ? `<tr><td colspan="5">${renderListSkeleton(2)}</td></tr>`
                : state.loadError
                  ? `<tr><td colspan="5">${renderErrorState('Could not load users.')}</td></tr>`
                  : visibleUsers.length === 0
                    ? `<tr><td colspan="5" class="text-muted text-sm">No users found.</td></tr>`
                    : visibleUsers.map((u) => renderUserRow(u, state, currentUserId)).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="card elev-sm p-5 mb-5">
      <div class="card-title mb-3.5">Global Task Control</div>
      <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>Task</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${
              state.loading
                ? `<tr><td colspan="4">${renderListSkeleton(2)}</td></tr>`
                : state.loadError
                  ? `<tr><td colspan="4">${renderErrorState('Could not load tasks.')}</td></tr>`
                  : state.tasks.length === 0
                    ? `<tr><td colspan="4" class="text-muted text-sm">No tasks found.</td></tr>`
                    : state.tasks.map((t) => renderGlobalTaskRow(t, state, usersById)).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="card elev-sm p-5" data-role="projects-card">
      <div class="card-title mb-3.5">Projects</div>
      <p class="text-neutral-400 text-sm mb-3.5" style="margin-top:-8px">Create a project here to make it available in every New Task dialog — no need to be creating a task at the same time.</p>
      <form data-form="add-project" class="flex gap-2.5 mb-3.5">
        <input class="input" data-role="new-project-name" placeholder="Project name" value="${escapeHtml(state.newProjectName)}" style="flex:1;max-width:280px" />
        <button type="submit" class="btn btn-primary">Add Project</button>
      </form>
      ${
        state.projectError
          ? `<p data-role="project-error" class="text-sm mb-3.5" style="color:var(--color-accent-2-200);background:var(--color-accent-2-900);border:1px solid var(--color-accent-2-700);border-radius:var(--radius-md);padding:8px 12px">${escapeHtml(state.projectError)}</p>`
          : ''
      }
      <div data-role="project-list">
        ${
          state.loading
            ? renderListSkeleton(2)
            : state.loadError
              ? renderErrorState('Could not load projects.')
              : state.projects.length === 0
                ? `<p class="text-muted text-sm">No projects yet.</p>`
                : `<div style="display:flex;flex-wrap:wrap;gap:8px">${state.projects.map((p) => `<span class="tag tag-neutral">${escapeHtml(p.name)}</span>`).join('')}</div>`
        }
      </div>
    </div>
  `;
}

function renderUserRow(u, state, currentUserId) {
  const isSelf = u.id === currentUserId;
  const isConfirmingDelete = state.confirmDeleteId === u.id;

  let actionsCell;
  if (isSelf) {
    actionsCell = `<span class="text-muted" style="font-size:12px">This is you</span>`;
  } else if (isConfirmingDelete) {
    actionsCell = `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--color-accent-2-200)">Delete this user?</span>
        <button type="button" class="btn btn-secondary" data-action="confirm-delete" data-user-id="${escapeHtml(u.id)}" style="padding:4px 10px;font-size:12px">Yes, delete</button>
        <button type="button" class="btn btn-ghost" data-action="cancel-delete" style="padding:4px 10px;font-size:12px">Cancel</button>
      </div>`;
  } else {
    actionsCell = `
      <div style="display:flex;gap:6px">
        <button type="button" class="wsicon-btn" data-action="toggle-status" data-user-id="${escapeHtml(u.id)}" data-current-status="${escapeHtml(u.status)}" aria-label="Toggle active status" title="Toggle active status" style="width:28px;height:28px;border-radius:var(--radius-sm);border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-400)">⏻</button>
        <button type="button" class="wsicon-btn" data-action="delete-user" data-user-id="${escapeHtml(u.id)}" aria-label="Delete user" title="Delete user" style="width:28px;height:28px;border-radius:var(--radius-sm);border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-400)">🗑</button>
      </div>`;
  }

  return `
    <tr data-user-row="${escapeHtml(u.id)}">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:30px;height:30px;border-radius:50%;background:var(--color-neutral-800);color:var(--color-neutral-200);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">${escapeHtml(initials(u.name))}</div>
          <div><div style="font-weight:500">${escapeHtml(u.name)}</div><div class="text-muted" style="font-size:12px">${escapeHtml(u.email)}</div></div>
        </div>
      </td>
      <td style="text-transform:capitalize">${escapeHtml(u.role)}</td>
      <td><span class="tag ${u.status === 'active' ? 'tag-accent' : 'tag-neutral'}">${u.status === 'active' ? 'Active' : 'Inactive'}</span></td>
      <td class="text-muted">${u.last_active ? escapeHtml(formatRelativeTime(u.last_active)) : 'Never'}</td>
      <td>${actionsCell}</td>
    </tr>`;
}

function renderGlobalTaskRow(t, state, usersById) {
  const owner = usersById.get(t.owner_id);
  const ownerName = owner ? owner.name : 'Unknown';
  const isOverriding = state.overrideTaskId === t.id;
  const statusLabel = t.blocked ? 'Blocked' : STATUS_LABEL[t.status];
  const tagClass = t.blocked ? 'tag-outline' : STATUS_TAG_CLASS[t.status];

  const statusCell = isOverriding
    ? `
      <select class="input" data-role="override-status" style="width:130px;padding:4px 8px;font-size:12px">
        <option value="planned" ${t.status === 'planned' ? 'selected' : ''}>Planned</option>
        <option value="in-progress" ${t.status === 'in-progress' ? 'selected' : ''}>In-Progress</option>
        <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
      </select>`
    : `<span class="tag ${tagClass}">${statusLabel}</span>`;

  const actionsCell = isOverriding
    ? `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select class="input" data-role="override-owner" style="width:160px;padding:4px 8px;font-size:12px">
          ${state.users.map((u) => `<option value="${escapeHtml(u.id)}" ${u.id === t.owner_id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-primary" data-action="apply-override" data-task-id="${escapeHtml(t.id)}" style="padding:4px 10px;font-size:12px">Apply</button>
        <button type="button" class="btn btn-ghost" data-action="cancel-override" style="padding:4px 10px;font-size:12px">Cancel</button>
      </div>`
    : `<a href="#" data-action="start-override" data-task-id="${escapeHtml(t.id)}">OVERRIDE</a>`;

  return `
    <tr data-task-row="${escapeHtml(t.id)}">
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(ownerName)}</td>
      <td>${statusCell}</td>
      <td>${actionsCell}</td>
    </tr>`;
}

function wireEvents(content, store, loadData) {
  content.querySelectorAll('[data-action="retry"]').forEach((btn) => {
    btn.addEventListener('click', () => loadData());
  });

  const searchInput = content.querySelector('[data-role="user-search"]');
  searchInput.addEventListener('input', () => {
    store.setState({ search: searchInput.value });
  });

  const addUserBtn = content.querySelector('[data-action="add-user"]');
  addUserBtn.addEventListener('click', () => openAddUserDialog());

  content.querySelectorAll('[data-action="toggle-status"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-user-id');
      const current = btn.getAttribute('data-current-status');
      const next = current === 'active' ? 'inactive' : 'active';
      const { error } = await setUserStatus(id, next);
      store.setState({ actionError: error ? error.message : '' });
      await loadData();
    });
  });

  content.querySelectorAll('[data-action="delete-user"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.setState({ confirmDeleteId: btn.getAttribute('data-user-id') });
    });
  });

  content.querySelectorAll('[data-action="cancel-delete"]').forEach((btn) => {
    btn.addEventListener('click', () => store.setState({ confirmDeleteId: null }));
  });

  content.querySelectorAll('[data-action="confirm-delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-user-id');
      const { error } = await softDeleteUser(id);
      store.setState({ confirmDeleteId: null, actionError: error ? error.message : '' });
      await loadData();
    });
  });

  content.querySelectorAll('[data-action="start-override"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      store.setState({ overrideTaskId: link.getAttribute('data-task-id') });
    });
  });

  content.querySelectorAll('[data-action="cancel-override"]').forEach((btn) => {
    btn.addEventListener('click', () => store.setState({ overrideTaskId: null }));
  });

  content.querySelectorAll('[data-action="apply-override"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const taskId = btn.getAttribute('data-task-id');
      const row = btn.closest('tr');
      const status = row.querySelector('[data-role="override-status"]').value;
      const ownerId = row.querySelector('[data-role="override-owner"]').value;
      const { error } = await overrideTask(taskId, status, ownerId);
      store.setState({ overrideTaskId: null, actionError: error ? error.message : '' });
      await loadData();
    });
  });

  const addProjectForm = content.querySelector('[data-form="add-project"]');
  const newProjectInput = content.querySelector('[data-role="new-project-name"]');
  newProjectInput?.addEventListener('input', () => {
    store.setState({ newProjectName: newProjectInput.value });
  });
  addProjectForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = newProjectInput.value.trim();
    if (!name) return;
    const { data, error } = await createProject(name);
    if (error) {
      store.setState({ projectError: error.message });
      return;
    }
    store.setState({
      projects: [...store.getState().projects, data],
      newProjectName: '',
      projectError: '',
    });
  });
}
