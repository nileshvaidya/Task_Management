// New Task dialog. Phase 2 scope: title/description/date, always
// self-owned (no Project/Priority/Assign To/Dependencies yet — those are
// Phase 5's "full New Task dialog"). Dispatches a window event on success
// so any open screen can refresh its task list without a direct coupling
// back to this module.
import { createTask } from '../tasks.js';
import { validateNewTaskForm } from '../validation.js';
import { todayISODate } from '../dateUtils.js';
import { escapeHtml } from '../components.js';

const ROOT_ID = 'dialog-root';

/** @param {{ id: string }} user */
export function open(user) {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  const today = todayISODate();

  root.innerHTML = `
    <div class="dialog-backdrop" data-dialog="new-task">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="new-task-title" style="max-width:480px;width:100%">
        <div class="flex items-start justify-between">
          <div>
            <div class="dialog-title" id="new-task-title" style="color:var(--color-accent-200)">New Task</div>
            <p class="text-sm text-neutral-400 mb-4">Log daily activities or plan ahead.</p>
          </div>
          <button type="button" class="wsicon-btn" data-action="close" aria-label="Close" style="width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-400)">✕</button>
        </div>

        <p data-role="error" class="hidden text-sm mb-3" style="color:var(--color-accent-2-200);background:var(--color-accent-2-900);border:1px solid var(--color-accent-2-700);border-radius:var(--radius-md);padding:8px 12px"></p>

        <!-- novalidate: the date input's min attribute would otherwise let
             the browser's native constraint validation silently block
             submission (no submit event at all) instead of our own
             validateNewTaskForm error banner running. -->
        <form data-form="new-task" novalidate>
          <div class="field"><label for="new-task-title-input">Task Title</label>
            <input class="input" id="new-task-title-input" name="title" placeholder="e.g., Update Q3 Financial Model" />
          </div>
          <div class="field"><label for="new-task-desc">Description</label>
            <textarea class="input" id="new-task-desc" name="description" rows="3" placeholder="Brief details about the task…"></textarea>
          </div>
          <div class="field"><label for="new-task-date">Date</label>
            <input class="input" id="new-task-date" name="dueDate" type="date" value="${escapeHtml(today)}" min="${escapeHtml(today)}" />
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" data-action="close">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Task</button>
          </div>
        </form>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-action="close"]').forEach((btn) => btn.addEventListener('click', close));

  const form = root.querySelector('[data-form="new-task"]');
  const errorEl = root.querySelector('[data-role="error"]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = /** @type {HTMLInputElement} */ (form.querySelector('#new-task-title-input')).value.trim();
    const description = /** @type {HTMLTextAreaElement} */ (form.querySelector('#new-task-desc')).value.trim();
    const dueDate = /** @type {HTMLInputElement} */ (form.querySelector('#new-task-date')).value;

    const { valid, errors } = validateNewTaskForm({ title, dueDate });
    if (!valid) {
      errorEl.textContent = Object.values(errors)[0];
      errorEl.classList.remove('hidden');
      return;
    }

    const { error } = await createTask({ title, description, dueDate, ownerId: user.id });
    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove('hidden');
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
