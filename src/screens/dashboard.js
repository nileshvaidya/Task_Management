// Dashboard: Plan Today quick-add, Active Tasks, Weekly Progress, Advance
// Planning. Desktop (two-column grid) vs mobile (single column) is real
// Tailwind breakpoints on one markup tree — no device-state branching.
import { getCurrentProfile } from '../auth.js';
import { renderShell } from '../layout.js';
import { renderTaskRow, escapeHtml } from '../components.js';
import { createStore } from '../state.js';
import { fetchMyTasks, fetchTeamTasks, createTask, setTaskStatus, toggleTaskDone, acceptTask } from '../tasks.js';
import { computeWeeklyProgress } from '../taskStats.js';
import { todayISODate, buildCalendarCells } from '../dateUtils.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function render(container) {
  const user = await getCurrentProfile();
  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  const content = renderShell(container, { activeRoute: '/dashboard', user });
  content.setAttribute('data-screen', 'dashboard');
  const now = new Date();
  const store = createStore({
    tasks: [],
    loading: true,
    filter: 'all',
    viewingTeam: false,
    quickAddValue: '',
    calMonth: now.getMonth(),
    calYear: now.getFullYear(),
  });

  async function loadTasks() {
    const s = store.getState();
    const tasks = s.viewingTeam ? await fetchTeamTasks(user.id) : await fetchMyTasks(user.id);
    store.setState({ tasks, loading: false });
  }

  function paint() {
    renderContent(content, store.getState(), user);
    wireEvents(content, store, user, loadTasks);
  }

  store.subscribe(paint);
  paint();
  await loadTasks();

  // The New Task dialog lives outside this screen's DOM subtree (it mounts
  // into #dialog-root) and creates tasks via a window event rather than a
  // direct reference back into this module. Clean up on navigation so
  // repeated dashboard visits don't stack duplicate listeners.
  const onTaskCreated = () => loadTasks();
  window.addEventListener('worksync:task-created', onTaskCreated);
  window.addEventListener(
    'hashchange',
    () => window.removeEventListener('worksync:task-created', onTaskCreated),
    { once: true }
  );
}

function renderContent(content, state, user) {
  const today = todayISODate();
  const visibleTasks =
    state.filter === 'pending' ? state.tasks.filter((t) => t.status !== 'completed') : state.tasks;
  const weekly = computeWeeklyProgress(state.tasks, today);
  const cells = buildCalendarCells(state.calYear, state.calMonth, today);

  content.innerHTML = `
    <div class="flex items-start justify-between gap-5 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-heading mb-1">Good Morning, ${escapeHtml(user.name.split(' ')[0])}</h1>
        <p class="text-neutral-400 m-0">Here's your productivity overview for today.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
      <div class="flex flex-col gap-5 min-w-0">
        <div class="card elev-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="card-title m-0">Plan Today</div>
            <span class="tag tag-neutral">${escapeHtml(formatToday(today))}</span>
          </div>
          <form data-form="quick-add" class="flex gap-2.5">
            <input class="input flex-1" name="title" placeholder="What needs to be done today?" value="${escapeHtml(state.quickAddValue)}" />
            <button type="submit" class="btn btn-primary">Add</button>
          </form>
        </div>

        <div class="card elev-sm p-5">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div class="card-title m-0">Active Tasks</div>
            <div class="flex items-center gap-2">
              ${user.role === 'manager' ? `
                <div class="seg" role="radiogroup" aria-label="My tasks or my team's">
                  <label class="seg-opt"><input type="radio" name="scope" value="mine" ${!state.viewingTeam ? 'checked' : ''} />Mine</label>
                  <label class="seg-opt"><input type="radio" name="scope" value="team" ${state.viewingTeam ? 'checked' : ''} />My Team</label>
                </div>` : ''}
              <div class="seg" role="radiogroup" aria-label="Filter tasks">
                <label class="seg-opt"><input type="radio" name="filter" value="all" ${state.filter === 'all' ? 'checked' : ''} />All</label>
                <label class="seg-opt"><input type="radio" name="filter" value="pending" ${state.filter === 'pending' ? 'checked' : ''} />Pending</label>
              </div>
            </div>
          </div>
          <div data-role="task-list">
            ${
              state.loading
                ? `<p class="text-neutral-500 text-sm py-4">Loading…</p>`
                : visibleTasks.length === 0
                  ? `<p class="text-neutral-500 text-sm py-4">No tasks here.</p>`
                  : visibleTasks.map((t) => renderTaskRow(t, user.id)).join('')
            }
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-5">
        <div class="card elev-md p-5" style="background:linear-gradient(160deg, var(--color-accent-800), var(--color-accent-900));border-color:var(--color-accent-600)">
          <div class="card-title mb-1">Weekly Progress</div>
          <p class="card-body opacity-80 mb-3">You're on track to hit your goals.</p>
          <div class="flex items-baseline gap-1.5 mb-2.5">
            <span style="font-size:40px;font-weight:600;font-family:var(--font-heading)">${weekly.done}</span>
            <span class="opacity-70 text-sm">/ ${weekly.total} Tasks</span>
          </div>
          <div style="height:6px;border-radius:999px;background:rgba(255,255,255,.15);overflow:hidden">
            <div style="height:100%;width:${weekly.pct}%;background:var(--color-accent-200)"></div>
          </div>
        </div>

        <div class="card elev-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="card-title m-0">Advance Planning</div>
            <div class="flex gap-1">
              <button type="button" class="wsicon-btn" data-action="prev-month" style="width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-400)">‹</button>
              <button type="button" class="wsicon-btn" data-action="next-month" style="width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-400)">›</button>
            </div>
          </div>
          <div class="text-center text-sm text-neutral-400 mb-2.5">${MONTH_NAMES[state.calMonth]} ${state.calYear}</div>
          <div class="grid grid-cols-7 gap-1 text-center mb-1.5" style="font-size:11px;color:var(--color-neutral-500)">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
          </div>
          <div class="grid grid-cols-7 gap-1">
            ${cells
              .map(
                (c) => `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:12px;border-radius:6px;color:${c.isToday ? 'var(--color-bg)' : 'var(--color-neutral-300)'};background:${c.isToday ? 'var(--color-accent)' : 'transparent'}">${c.label}</div>`
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function wireEvents(content, store, user, loadTasks) {
  const quickAddForm = content.querySelector('[data-form="quick-add"]');
  quickAddForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = quickAddForm.querySelector('input[name="title"]');
    const title = input.value.trim();
    if (!title) return;
    await createTask({ title, dueDate: todayISODate(), ownerId: user.id });
    store.setState({ quickAddValue: '' });
    await loadTasks();
  });

  content.querySelectorAll('input[name="filter"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) store.setState({ filter: radio.value });
    });
  });

  content.querySelectorAll('input[name="scope"]').forEach((radio) => {
    radio.addEventListener('change', async () => {
      if (radio.checked) {
        store.setState({ viewingTeam: radio.value === 'team', loading: true });
        await loadTasks();
      }
    });
  });

  content.querySelectorAll('[data-action="toggle-done"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-task-id');
      const task = store.getState().tasks.find((t) => String(t.id) === id);
      if (!task) return;
      await toggleTaskDone(task, user.id);
      await loadTasks();
    });
  });

  content.querySelectorAll('[data-action="status-select"]').forEach((select) => {
    select.addEventListener('change', async () => {
      const id = select.getAttribute('data-task-id');
      await setTaskStatus(id, select.value, user.id);
      await loadTasks();
    });
  });

  content.querySelectorAll('[data-action="accept-task"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const id = checkbox.getAttribute('data-task-id');
      await acceptTask(id, user.id);
      await loadTasks();
    });
  });

  const prevBtn = content.querySelector('[data-action="prev-month"]');
  const nextBtn = content.querySelector('[data-action="next-month"]');
  prevBtn.addEventListener('click', () => {
    const s = store.getState();
    store.setState(
      s.calMonth === 0 ? { calMonth: 11, calYear: s.calYear - 1 } : { calMonth: s.calMonth - 1 }
    );
  });
  nextBtn.addEventListener('click', () => {
    const s = store.getState();
    store.setState(
      s.calMonth === 11 ? { calMonth: 0, calYear: s.calYear + 1 } : { calMonth: s.calMonth + 1 }
    );
  });
}

function formatToday(todayISO) {
  const d = new Date(todayISO + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
