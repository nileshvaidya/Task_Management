// Mount point for the New Task dialog. Placeholder for Phase 0 — the full
// form (project/title/description/date/assignee/priority/dependencies) is
// built in Phase 5.
const ROOT_ID = 'dialog-root';

export function open() {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  root.innerHTML = `
    <div class="dialog-backdrop" data-dialog="new-task">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="new-task-title">
        <div class="dialog-title" id="new-task-title">New Task</div>
        <div class="dialog-body">The full task creation flow is built in Phase 5.</div>
        <div class="dialog-actions">
          <button type="button" class="btn btn-secondary" data-action="close">Close</button>
        </div>
      </div>
    </div>
  `;
  root.querySelector('[data-action="close"]').addEventListener('click', close);
}

export function close() {
  const root = document.getElementById(ROOT_ID);
  if (root) root.innerHTML = '';
}
