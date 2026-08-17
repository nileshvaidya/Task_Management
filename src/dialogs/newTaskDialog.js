// Full New Task dialog (Phase 5): Project (+New), Priority, role-gated
// Assign To, and the Has Dependency section (search existing tasks OR
// create a new dependency + "Requires acceptance by assignee"). Dispatches
// a window event on success so any open screen can refresh its task list
// without a direct coupling back to this module.
import { createTaskWithDependency, fetchAssignableUsers, fetchDependencyCandidates } from '../tasks.js';
import { fetchProjects, createProject } from '../projects.js';
import { fetchTeamMembers } from '../users.js';
import { validateNewTaskForm, validateDependencyForm } from '../validation.js';
import { filterTasksForDependency } from '../dependencyFilter.js';
import { todayISODate } from '../dateUtils.js';
import { escapeHtml } from '../components.js';
import { createStore } from '../state.js';

const ROOT_ID = 'dialog-root';
const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

/** @param {{ id: string, name: string, role: string }} user */
export function open(user) {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  const today = todayISODate();

  const store = createStore({
    loading: true,
    error: '',
    projects: [],
    addingProject: false,
    newProjectName: '',
    primaryAssignOptions: [{ id: user.id, name: user.name }],
    assignableUsers: [],
    dependencyCandidates: [],
    // form fields
    title: '',
    description: '',
    dueDate: today,
    estimatedHours: '',
    projectId: '',
    priority: 'low',
    assignToId: user.id,
    hasDependency: false,
    depMode: 'new',
    depSearch: '',
    depSelectedTaskId: '',
    depTitle: '',
    depAssigneeId: '',
    requiresAcceptance: false,
  });

  function paint() {
    root.innerHTML = renderDialog(store.getState(), user, today);
    wireEvents(root, store, user);
  }

  store.subscribe(paint);
  paint();

  Promise.all([
    fetchProjects(),
    user.role === 'manager' ? fetchTeamMembers(user.id) : Promise.resolve([{ id: user.id, name: user.name }]),
  ]).then(([projects, primaryAssignOptions]) => {
    store.setState({ projects, primaryAssignOptions, loading: false });
  });
}

function renderDialog(state, user, today) {
  return `
    <div class="dialog-backdrop" data-dialog="new-task">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="new-task-title" style="max-width:600px;width:100%;max-height:90vh;overflow-y:auto">
        <div class="flex items-start justify-between">
          <div>
            <div class="dialog-title" id="new-task-title" style="color:var(--color-accent-200)">New Task</div>
            <p class="text-sm text-neutral-400 mb-4">Log daily activities or plan ahead.</p>
          </div>
          <button type="button" class="wsicon-btn" data-action="close" aria-label="Close" style="width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-400)">✕</button>
        </div>

        <p data-role="error" class="${state.error ? '' : 'hidden'} text-sm mb-3" style="color:var(--color-accent-2-200);background:var(--color-accent-2-900);border:1px solid var(--color-accent-2-700);border-radius:var(--radius-md);padding:8px 12px">${escapeHtml(state.error)}</p>

        <!-- novalidate: the date input's min attribute would otherwise let
             the browser's native constraint validation silently block
             submission (no submit event at all) instead of our own
             validateNewTaskForm error banner running. -->
        <form data-form="new-task" novalidate>
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:14px">
            <div class="field"><label for="new-task-project">Project</label>
              <select class="input" id="new-task-project" data-role="project-select">
                <option value="">Select a project…</option>
                ${state.projects.map((p) => `<option value="${escapeHtml(p.id)}" ${state.projectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
              </select>
            </div>
            <div style="display:flex;align-items:flex-end">
              <button type="button" class="btn btn-secondary" data-action="toggle-add-project">+ New</button>
            </div>
          </div>
          ${
            state.addingProject
              ? `
            <div class="flex gap-2.5 mb-3.5">
              <input class="input" id="new-project-name" placeholder="Project name" value="${escapeHtml(state.newProjectName)}" style="flex:1" />
              <button type="button" class="btn btn-primary" data-action="add-project">Add</button>
            </div>`
              : ''
          }

          <div class="field"><label for="new-task-title-input">Task Title</label>
            <input class="input" id="new-task-title-input" name="title" placeholder="e.g., Update Q3 Financial Model" value="${escapeHtml(state.title)}" />
          </div>
          <div class="field"><label for="new-task-desc">Description</label>
            <textarea class="input" id="new-task-desc" name="description" rows="3" placeholder="Brief details about the task…">${escapeHtml(state.description)}</textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
            <div class="field"><label for="new-task-date">Date</label>
              <input class="input" id="new-task-date" name="dueDate" type="date" value="${escapeHtml(state.dueDate)}" min="${escapeHtml(today)}" />
            </div>
            <div class="field"><label for="new-task-hours">Estimated Time (hrs)</label>
              <input class="input" id="new-task-hours" type="number" step="0.5" min="0" placeholder="0.0" value="${escapeHtml(state.estimatedHours)}" />
            </div>
          </div>

          <div class="field"><label for="new-task-assignee">Assign To</label>
            <select class="input" id="new-task-assignee" data-role="assign-to" ${user.role === 'manager' ? '' : 'disabled'}>
              ${state.primaryAssignOptions.map((o) => `<option value="${escapeHtml(o.id)}" ${state.assignToId === o.id ? 'selected' : ''}>${o.id === user.id ? 'Myself' : escapeHtml(o.name)}</option>`).join('')}
            </select>
          </div>

          <div class="field mb-4"><label>Priority Level</label>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
              ${PRIORITIES.map(
                (p) => `
                <button type="button" data-action="set-priority" data-priority="${p.value}" style="padding:10px;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;${
                  state.priority === p.value
                    ? 'background:var(--color-accent-800);border:1px solid var(--color-accent);color:var(--color-accent-100)'
                    : 'background:transparent;border:1px solid var(--color-divider);color:var(--color-neutral-300)'
                }">${p.label}</button>`
              ).join('')}
            </div>
          </div>

          <div style="border-top:1px solid var(--color-divider);padding-top:14px;margin-bottom:14px">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--color-neutral-400)">Task Dependencies &amp; Assignment</div>
                <div style="font-size:12px;color:var(--color-neutral-500);margin-top:2px">Link this task to others or assign dependencies</div>
              </div>
              <div class="flex items-center gap-2" style="flex:none">
                <div class="wsswitch" data-action="toggle-has-dependency" style="${state.hasDependency ? 'background:var(--color-accent-800);border-color:var(--color-accent)' : ''}"><i style="${state.hasDependency ? 'transform:translateX(14px);background:var(--color-accent-200)' : ''}"></i></div>
                <span style="font-size:13px">Has Dependency</span>
              </div>
            </div>

            ${state.hasDependency ? renderDependencySection(state) : ''}
          </div>

          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" data-action="close">Cancel</button>
            <button type="submit" class="btn btn-primary" data-action="submit">Create Task</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderDependencySection(state) {
  const results = filterTasksForDependency(state.dependencyCandidates, state.depSearch);
  return `
    <div class="mt-3.5">
      <div class="seg mb-3" role="radiogroup" aria-label="Dependency mode">
        <label class="seg-opt"><input type="radio" name="dep-mode" value="new" ${state.depMode === 'new' ? 'checked' : ''} />Create New</label>
        <label class="seg-opt"><input type="radio" name="dep-mode" value="existing" ${state.depMode === 'existing' ? 'checked' : ''} />Search Existing</label>
      </div>

      ${
        state.depMode === 'existing'
          ? `
        <div class="field"><label for="new-task-dep-search">Search existing tasks</label>
          <input class="input" id="new-task-dep-search" placeholder="Search by title or owner…" value="${escapeHtml(state.depSearch)}" />
        </div>
        <div data-role="dep-results" style="max-height:160px;overflow-y:auto;border:1px solid var(--color-divider);border-radius:var(--radius-md);margin-bottom:10px">
          ${
            results.length === 0
              ? `<p class="text-muted text-sm" style="padding:10px">No matching tasks.</p>`
              : results
                  .map(
                    (t) => `
              <button type="button" data-action="select-dep-task" data-task-id="${escapeHtml(t.id)}" data-task-title="${escapeHtml(t.title)}" data-owner-name="${escapeHtml(t.owner_name)}"
                style="display:block;width:100%;text-align:left;padding:8px 10px;font-size:13px;background:${state.depSelectedTaskId === t.id ? 'var(--color-accent-800)' : 'transparent'};border:none;border-top:1px solid var(--color-divider);cursor:pointer;color:${state.depSelectedTaskId === t.id ? 'var(--color-accent-100)' : 'var(--color-text)'}">
                ${escapeHtml(t.title)} <span class="text-muted">— ${escapeHtml(t.owner_name)}</span>
              </button>`
                  )
                  .join('')
          }
        </div>`
          : `
        <div class="card" style="padding:14px;background:var(--color-neutral-900)">
          <div class="field"><label for="new-task-dep-title">New Dependency Title</label>
            <input class="input" id="new-task-dep-title" placeholder="e.g., Review PR #12" value="${escapeHtml(state.depTitle)}" />
          </div>
          <div class="field"><label for="new-task-dep-assignee">Assign To</label>
            <select class="input" id="new-task-dep-assignee" data-role="dep-assignee">
              <option value="">Select assignee…</option>
              ${state.assignableUsers.map((u) => `<option value="${escapeHtml(u.id)}" ${state.depAssigneeId === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
            </select>
          </div>
        </div>`
      }

      <label class="flex items-center gap-2 text-sm mt-3" style="cursor:pointer">
        <input type="checkbox" id="new-task-requires-acceptance" ${state.requiresAcceptance ? 'checked' : ''} />
        Requires acceptance by assignee
      </label>
    </div>
  `;
}

function wireEvents(root, store, user) {
  root.querySelectorAll('[data-action="close"]').forEach((btn) => btn.addEventListener('click', close));

  const form = root.querySelector('[data-form="new-task"]');

  // These fields are re-rendered from state on every store.setState() call
  // elsewhere in this dialog (priority, project, dependency toggles, ...) —
  // without syncing keystrokes back into state, a full innerHTML re-render
  // would silently discard whatever the user had already typed.
  root.querySelector('#new-task-title-input')?.addEventListener('input', (e) => {
    store.setState({ title: /** @type {HTMLInputElement} */ (e.target).value });
  });
  root.querySelector('#new-task-desc')?.addEventListener('input', (e) => {
    store.setState({ description: /** @type {HTMLTextAreaElement} */ (e.target).value });
  });
  root.querySelector('#new-task-date')?.addEventListener('input', (e) => {
    store.setState({ dueDate: /** @type {HTMLInputElement} */ (e.target).value });
  });
  root.querySelector('#new-task-hours')?.addEventListener('input', (e) => {
    store.setState({ estimatedHours: /** @type {HTMLInputElement} */ (e.target).value });
  });
  root.querySelector('#new-task-dep-title')?.addEventListener('input', (e) => {
    store.setState({ depTitle: /** @type {HTMLInputElement} */ (e.target).value });
  });
  root.querySelector('#new-project-name')?.addEventListener('input', (e) => {
    store.setState({ newProjectName: /** @type {HTMLInputElement} */ (e.target).value });
  });

  root.querySelector('[data-role="project-select"]')?.addEventListener('change', (e) => {
    store.setState({ projectId: /** @type {HTMLSelectElement} */ (e.target).value });
  });

  root.querySelector('[data-action="toggle-add-project"]')?.addEventListener('click', () => {
    store.setState({ addingProject: !store.getState().addingProject });
  });

  root.querySelector('[data-action="add-project"]')?.addEventListener('click', async () => {
    const input = /** @type {HTMLInputElement} */ (root.querySelector('#new-project-name'));
    const name = input.value.trim();
    if (!name) return;
    const { data, error } = await createProject(name);
    if (error) {
      store.setState({ error: error.message });
      return;
    }
    store.setState({
      projects: [...store.getState().projects, data],
      projectId: data.id,
      addingProject: false,
      newProjectName: '',
      error: '',
    });
  });

  root.querySelector('[data-role="assign-to"]')?.addEventListener('change', (e) => {
    store.setState({ assignToId: /** @type {HTMLSelectElement} */ (e.target).value });
  });

  root.querySelectorAll('[data-action="set-priority"]').forEach((btn) => {
    btn.addEventListener('click', () => store.setState({ priority: btn.getAttribute('data-priority') }));
  });

  root.querySelector('[data-action="toggle-has-dependency"]')?.addEventListener('click', () => {
    const next = !store.getState().hasDependency;
    store.setState({ hasDependency: next });
    if (next && store.getState().assignableUsers.length === 0) {
      Promise.all([fetchAssignableUsers(), fetchDependencyCandidates()]).then(([assignableUsers, dependencyCandidates]) => {
        store.setState({ assignableUsers, dependencyCandidates });
      });
    }
  });

  root.querySelectorAll('input[name="dep-mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) store.setState({ depMode: radio.value, depSelectedTaskId: '' });
    });
  });

  root.querySelector('#new-task-dep-search')?.addEventListener('input', (e) => {
    store.setState({ depSearch: /** @type {HTMLInputElement} */ (e.target).value });
  });

  root.querySelectorAll('[data-action="select-dep-task"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.setState({ depSelectedTaskId: btn.getAttribute('data-task-id') });
    });
  });

  root.querySelector('[data-role="dep-assignee"]')?.addEventListener('change', (e) => {
    store.setState({ depAssigneeId: /** @type {HTMLSelectElement} */ (e.target).value });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const state = store.getState();
    const title = /** @type {HTMLInputElement} */ (form.querySelector('#new-task-title-input')).value.trim();
    const description = /** @type {HTMLTextAreaElement} */ (form.querySelector('#new-task-desc')).value.trim();
    const dueDate = /** @type {HTMLInputElement} */ (form.querySelector('#new-task-date')).value;
    const estimatedHoursRaw = /** @type {HTMLInputElement} */ (form.querySelector('#new-task-hours')).value;
    const depTitle = state.hasDependency && state.depMode === 'new' ? (/** @type {HTMLInputElement} */ (form.querySelector('#new-task-dep-title'))?.value.trim() ?? '') : '';
    const requiresAcceptance = state.hasDependency
      ? /** @type {HTMLInputElement} */ (form.querySelector('#new-task-requires-acceptance')).checked
      : false;

    const { valid, errors } = validateNewTaskForm({ title, dueDate });
    if (!valid) {
      store.setState({ error: Object.values(errors)[0] });
      return;
    }

    /** @type {any} */
    let dependency = null;
    if (state.hasDependency) {
      const activeUserIds = state.assignableUsers.map((u) => u.id);
      const depForm =
        state.depMode === 'existing'
          ? { mode: 'existing', taskId: state.depSelectedTaskId }
          : { mode: 'new', title: depTitle, assigneeId: state.depAssigneeId };
      const depValidation = validateDependencyForm(depForm, activeUserIds);
      if (!depValidation.valid) {
        store.setState({ error: Object.values(depValidation.errors)[0] });
        return;
      }
      if (state.depMode === 'existing') {
        const selected = state.dependencyCandidates.find((t) => t.id === state.depSelectedTaskId);
        dependency = {
          mode: 'existing',
          requiresAcceptance,
          taskId: selected.id,
          taskTitle: selected.title,
          taskOwnerName: selected.owner_name,
        };
      } else {
        const assignee = state.assignableUsers.find((u) => u.id === state.depAssigneeId);
        dependency = {
          mode: 'new',
          requiresAcceptance,
          title: depTitle,
          assigneeId: state.depAssigneeId,
          assigneeName: assignee ? assignee.name : '',
        };
      }
    }

    const { error } = await createTaskWithDependency({
      title,
      description,
      dueDate,
      priority: state.priority,
      projectId: state.projectId || null,
      estimatedHours: estimatedHoursRaw && !Number.isNaN(Number(estimatedHoursRaw)) ? Number(estimatedHoursRaw) : null,
      ownerId: state.assignToId,
      createdBy: user.id,
      dependency,
    });
    if (error) {
      store.setState({ error: error.message });
      return;
    }

    close();
    window.dispatchEvent(new CustomEvent('worksync:task-created'));
  });
}

export function close() {
  const root = document.getElementById(ROOT_ID);
  if (root) root.innerHTML = '';
}
