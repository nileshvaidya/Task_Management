// Shared render helpers used across screen modules.
import { formatDueLabel, formatRelativeTime } from './dateUtils.js';

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

/**
 * Loading skeleton for an async list (Phase 6) — replaces plain "Loading…"
 * text with a few pulsing placeholder rows. `rows` defaults to 3; kept
 * small since every screen's real lists are short in this app's size range.
 * @param {number} [rows]
 */
export function renderListSkeleton(rows = 3) {
  return `
    <div data-role="list-skeleton" aria-busy="true" aria-label="Loading">
      ${Array.from(
        { length: rows },
        () => `
        <div style="padding:14px 0;border-top:1px solid var(--color-divider)">
          <div class="skeleton-bar" style="height:14px;width:55%;border-radius:4px;margin-bottom:8px"></div>
          <div class="skeleton-bar" style="height:11px;width:30%;border-radius:4px"></div>
        </div>`
      ).join('')}
    </div>`;
}

/**
 * Error state for a failed async list fetch (Phase 6) — distinct from the
 * "no rows" empty state, with a Retry action. The calling screen wires up
 * `[data-action="retry"]` to re-run its loader.
 * @param {string} [message]
 */
export function renderErrorState(message = 'Something went wrong loading this. Please try again.') {
  return `
    <div data-role="error-state" style="padding:20px 0;text-align:center">
      <p style="font-size:13px;color:var(--color-accent-2-200);margin:0 0 10px">${escapeHtml(message)}</p>
      <button type="button" class="btn btn-secondary" data-action="retry" style="padding:6px 14px;font-size:13px">Retry</button>
    </div>`;
}

const STATUS_LABEL = { planned: 'Planned', 'in-progress': 'In-Progress', completed: 'Completed' };
const STATUS_TAG_CLASS = { planned: 'tag-neutral', 'in-progress': 'tag-outline', completed: 'tag-accent' };

/**
 * A single Active Tasks row: round completion toggle, title (struck
 * through when completed), meta, optional blocked line, status select +
 * tag. Returns an HTML string — dashboard.js assembles the list by joining
 * these — kept as its own function so it's unit-testable in isolation
 * (build brief Phase 2 test case 4).
 *
 * Phase 5's Task Acceptance UI (section 2.5) replaces the status
 * select/tag with a "Pending acceptance" tag whenever `created_by !==
 * owner_id && accepted === false` — a cross-assigned task (manager→report,
 * or a dependency) nobody has accepted yet. The round toggle and status
 * select are both disabled in that state too: no UI path can move an
 * unaccepted task off 'planned' (test case 8; the DB's
 * tasks_accepted_status_check constraint is the server-side backstop).
 * Only the task's actual owner sees an actionable "Task Accepted"
 * checkbox — anyone else (e.g. a manager viewing a report's still-pending
 * task) sees the tag as informational only.
 * @param {{ id: string, title: string, status: string, due_date: string, blocked: boolean, blocked_reason: string|null, created_by?: string, owner_id?: string, accepted?: boolean|null }} task
 * @param {string} [viewerId] the signed-in user looking at this row
 */
export function renderTaskRow(task, viewerId) {
  const done = task.status === 'completed';
  const pendingAcceptance = task.created_by != null && task.created_by !== task.owner_id && task.accepted === false;
  const isOwner = task.owner_id === viewerId;
  const statusLabel = task.blocked ? 'Blocked' : STATUS_LABEL[task.status];
  const tagClass = task.blocked ? 'tag-outline' : STATUS_TAG_CLASS[task.status];
  const titleClass = done ? 'line-through text-neutral-500' : '';

  const rightControls = pendingAcceptance
    ? `
      <div style="display:flex;align-items:center;gap:10px;flex:none;margin-left:auto">
        ${
          isOwner
            ? `<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
                <input type="checkbox" data-action="accept-task" data-task-id="${escapeHtml(task.id)}" />
                Task Accepted
              </label>`
            : ''
        }
        <span class="tag tag-accent-2">Pending ${isOwner ? 'your' : 'their'} acceptance</span>
      </div>`
    : `
      <div style="display:flex;align-items:center;gap:10px;flex:none;margin-left:auto">
        <select class="input" data-action="status-select" data-task-id="${escapeHtml(task.id)}" style="width:130px;padding:6px 10px;font-size:13px">
          <option value="planned" ${task.status === 'planned' ? 'selected' : ''}>Planned</option>
          <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In-Progress</option>
          <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
        <span class="tag ${tagClass}">${statusLabel}</span>
      </div>`;

  return `
    <div class="task-row" data-task-id="${escapeHtml(task.id)}" style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;padding:14px 0;border-top:1px solid var(--color-divider)">
      <button type="button" data-action="toggle-done" data-task-id="${escapeHtml(task.id)}" ${pendingAcceptance ? 'disabled' : ''}
        style="width:22px;height:22px;border-radius:50%;border:2px solid ${done ? 'var(--color-accent)' : 'var(--color-neutral-600)'};background:${done ? 'var(--color-accent)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex:none;cursor:${pendingAcceptance ? 'not-allowed' : 'pointer'};opacity:${pendingAcceptance ? '0.4' : '1'};margin-top:2px"
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
      ${rightControls}
    </div>`;
}

const VERB_META = {
  created: { text: 'created a task', tagLabel: 'Created', tagClass: 'tag-accent' },
  status_changed: { text: 'updated a task', tagLabel: 'Status Update', tagClass: 'tag-neutral' },
  accepted: { text: 'accepted a task', tagLabel: 'Accepted', tagClass: 'tag-accent-2' },
  blocked: { text: 'flagged a blocker', tagLabel: 'Blocker', tagClass: 'tag-outline' },
  unblocked: { text: 'cleared a blocker', tagLabel: 'Unblocked', tagClass: 'tag-accent' },
};

/**
 * A single Team Feed activity card: actor initials, "<name> <verb text>",
 * relative timestamp, detail line, and a verb-colored tag.
 * @param {{ actor?: { name: string }|null, verb: string, detail: string|null, created_at: string }} entry
 */
export function renderActivityCard(entry) {
  const meta = VERB_META[entry.verb] || { text: entry.verb, tagLabel: entry.verb, tagClass: 'tag-neutral' };
  const who = entry.actor?.name || 'Someone';
  return `
    <div class="card elev-sm" style="padding:18px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--color-neutral-800);color:var(--color-neutral-200);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex:none">${escapeHtml(initials(who))}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div style="font-size:14px"><strong>${escapeHtml(who)}</strong> ${escapeHtml(meta.text)}</div>
            <span style="font-size:12px;color:var(--color-neutral-500);flex:none">${escapeHtml(formatRelativeTime(entry.created_at))}</span>
          </div>
          <p style="font-size:13px;color:var(--color-neutral-400);margin:6px 0 8px">${escapeHtml(entry.detail || '')}</p>
          <span class="tag ${meta.tagClass}">${meta.tagLabel}</span>
        </div>
      </div>
    </div>`;
}

/**
 * Team Overview's per-member card: identity + status tag + "Today's Focus"
 * checklist (struck through for completed tasks).
 * @param {{ id: string, name: string, role: string, status: string }} member
 * @param {Array<{ id: string, title: string, done: boolean }>} focusItems
 */
export function renderMemberCard(member, focusItems) {
  return `
    <div class="card elev-sm" style="padding:18px" data-member-card="${escapeHtml(member.id)}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:var(--color-neutral-800);color:var(--color-neutral-200);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">${escapeHtml(initials(member.name))}</div>
          <div>
            <div style="font-size:14px;font-weight:500">${escapeHtml(member.name)}</div>
            <div style="font-size:12px;color:var(--color-neutral-500)">${member.role === 'manager' ? 'Manager' : 'Employee'}</div>
          </div>
        </div>
        <span class="tag tag-neutral">${member.status === 'active' ? 'Active' : 'Inactive'}</span>
      </div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--color-neutral-500);margin-bottom:6px">Today's Focus</div>
      ${
        focusItems.length === 0
          ? `<div style="font-size:13px;color:var(--color-neutral-500);padding:3px 0">Nothing due today.</div>`
          : focusItems
              .map(
                (f) =>
                  `<div style="font-size:13px;padding:3px 0;${f.done ? 'text-decoration:line-through;color:var(--color-neutral-500)' : ''}">${escapeHtml(f.title)}</div>`
              )
              .join('')
      }
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
