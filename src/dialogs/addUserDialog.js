// Add User dialog (Phase 4). Mirrors newTaskDialog.js's shape: mounts into
// #dialog-root, dispatches a window event on success so the Admin screen
// can refresh its user list without a direct module coupling.
import { inviteUser } from '../admin.js';
import { fetchActiveManagers } from '../auth.js';
import { validateAddUserForm } from '../validation.js';
import { escapeHtml } from '../components.js';

const ROOT_ID = 'dialog-root';

export function open() {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  root.innerHTML = `
    <div class="dialog-backdrop" data-dialog="add-user">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="add-user-title" style="max-width:440px;width:100%">
        <div class="flex items-start justify-between">
          <div>
            <div class="dialog-title" id="add-user-title" style="color:var(--color-accent-200)">Add User</div>
            <p class="text-sm text-neutral-400 mb-4">Sends a real email invite — they set their own password.</p>
          </div>
          <button type="button" class="wsicon-btn" data-action="close" aria-label="Close" style="width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-400)">✕</button>
        </div>

        <p data-role="error" class="hidden text-sm mb-3" style="color:var(--color-accent-2-200);background:var(--color-accent-2-900);border:1px solid var(--color-accent-2-700);border-radius:var(--radius-md);padding:8px 12px"></p>

        <form data-form="add-user" novalidate>
          <div class="field"><label for="add-user-name">Name</label>
            <input class="input" id="add-user-name" name="name" placeholder="e.g., Marcus Cole" />
          </div>
          <div class="field"><label for="add-user-email">Email</label>
            <input class="input" id="add-user-email" name="email" type="email" placeholder="name@company.com" />
          </div>
          <div class="field"><label for="add-user-role">Role</label>
            <select class="input" id="add-user-role" name="role">
              <option value="">Select a role…</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>
          </div>
          <div class="field hidden" data-role="manager-field"><label for="add-user-manager">Reports to</label>
            <select class="input" id="add-user-manager" name="managerId">
              <option value="">Select a manager…</option>
            </select>
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" data-action="close">Cancel</button>
            <button type="submit" class="btn btn-primary" data-action="submit">Send Invite</button>
          </div>
        </form>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-action="close"]').forEach((btn) => btn.addEventListener('click', close));

  const form = root.querySelector('[data-form="add-user"]');
  const errorEl = root.querySelector('[data-role="error"]');
  const roleSelect = /** @type {HTMLSelectElement} */ (root.querySelector('#add-user-role'));
  const managerField = root.querySelector('[data-role="manager-field"]');
  const submitBtn = root.querySelector('[data-action="submit"]');

  roleSelect.addEventListener('change', () => {
    managerField.classList.toggle('hidden', roleSelect.value !== 'employee');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = /** @type {HTMLInputElement} */ (form.querySelector('#add-user-name')).value.trim();
    const email = /** @type {HTMLInputElement} */ (form.querySelector('#add-user-email')).value.trim();
    const role = roleSelect.value;
    const managerId = /** @type {HTMLSelectElement} */ (form.querySelector('#add-user-manager')).value;

    const { valid, errors } = validateAddUserForm({ name, email, role, managerId });
    if (!valid) {
      errorEl.textContent = Object.values(errors)[0];
      errorEl.classList.remove('hidden');
      return;
    }

    submitBtn.setAttribute('disabled', 'true');
    const { error } = await inviteUser({ name, email, role, managerId: role === 'employee' ? managerId : undefined });
    submitBtn.removeAttribute('disabled');
    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove('hidden');
      return;
    }

    close();
    window.dispatchEvent(new CustomEvent('worksync:user-invited'));
  });

  fetchActiveManagers()
    .then((managers) => {
      const managerSelect = root.querySelector('#add-user-manager');
      if (!managerSelect) return;
      managerSelect.insertAdjacentHTML(
        'beforeend',
        managers.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join('')
      );
    })
    .catch(() => {});
}

export function close() {
  const root = document.getElementById(ROOT_ID);
  if (root) root.innerHTML = '';
}
