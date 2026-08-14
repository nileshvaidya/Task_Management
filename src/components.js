// Shared render helpers used across screen modules.
import { formatDueLabel } from './dateUtils.js';

export function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

export function initials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const STATUS_LABEL = { planned: 'Planned', 'in-progress': 'In-Progress', completed: 'Completed' };
const STATUS_TAG_CLASS = { planned: 'tag-neutral', 'in-progress': 'tag-outline', completed: 'tag-accent' };

/**
 * A single Active Tasks row: round completion toggle, title (struck
 * through when completed), meta, optional blocked line, status select +
 * tag. Returns an HTML string — dashboard.js assembles the list by joining
 * these — kept as its own function so it's unit-testable in isolation
 * (build brief Phase 2 test case 4).
 * @param {{ id: string, title: string, status: string, due_date: string, blocked: boolean, blocked_reason: string|null }} task
 */
export function renderTaskRow(task) {
  const done = task.status === 'completed';
  const statusLabel = task.blocked ? 'Blocked' : STATUS_LABEL[task.status];
  const tagClass = task.blocked ? 'tag-outline' : STATUS_TAG_CLASS[task.status];
  const titleClass = done ? 'line-through text-neutral-500' : '';

  return `
    <div class="task-row" data-task-id="${escapeHtml(task.id)}" style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;padding:14px 0;border-top:1px solid var(--color-divider)">
      <button type="button" data-action="toggle-done" data-task-id="${escapeHtml(task.id)}"
        style="width:22px;height:22px;border-radius:50%;border:2px solid ${done ? 'var(--color-accent)' : 'var(--color-neutral-600)'};background:${done ? 'var(--color-accent)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;margin-top:2px"
        aria-label="${done ? 'Mark as planned' : 'Mark as completed'}">
        ${done ? '<svg width="11" height="11" viewBox="0 0 256 256" fill="var(--color-accent-100)"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>' : ''}
      </button>
      <div style="flex:1 1 200px;min-width:0">
        <div class="${titleClass}" style="font-size:15px;font-weight:500">${escapeHtml(task.title)}</div>
        <div style="font-size:13px;color:var(--color-neutral-500);margin-top:2px">${formatDueLabel(task.due_date)}</div>
        ${
          task.blocked
            ? `<div style="font-size:12px;color:var(--color-accent-2-300);margin-top:6px">Waiting on: ${escapeHtml(task.blocked_reason || '')}</div>`
            : ''
        }
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex:none;margin-left:auto">
        <select class="input" data-action="status-select" data-task-id="${escapeHtml(task.id)}" style="width:130px;padding:6px 10px;font-size:13px">
          <option value="planned" ${task.status === 'planned' ? 'selected' : ''}>Planned</option>
          <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In-Progress</option>
          <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
        <span class="tag ${tagClass}">${statusLabel}</span>
      </div>
    </div>`;
}

/**
 * Sidebar identity block: avatar initials + name + email, from the
 * logged-in user's profile. Returns a DOM node so callers can mount it
 * wherever the (Phase 2) sidebar chrome ends up living.
 * @param {{ name: string, email: string }} user
 */
export function renderIdentityBlock(user) {
  const el = document.createElement('div');
  el.setAttribute('data-component', 'identity-block');
  el.style.cssText = 'display:flex;align-items:center;gap:10px';
  el.innerHTML = `
    <div style="width:32px;height:32px;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex:none">${escapeHtml(initials(user.name))}</div>
    <div style="min-width:0">
      <div data-role="identity-name" style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(user.name)}</div>
      <div data-role="identity-email" style="font-size:11px;color:var(--color-neutral-500);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(user.email)}</div>
    </div>
  `;
  return el;
}
