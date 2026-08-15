// Pure validation logic — no DOM, no Supabase — so it's cheap to unit test
// directly (per the build brief's testing guidance) rather than only
// through a full form-submission e2e test.
import { isPastDate, todayISODate } from './dateUtils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {{ name?: string, email?: string, password?: string, role?: string, managerId?: string }} form
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateSignupForm(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  const { name = '', email = '', password = '', role = '', managerId = '' } = form || {};

  if (!name.trim()) errors.name = 'Name is required.';
  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!password || password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }
  if (role !== 'manager' && role !== 'employee') {
    errors.role = 'Select a role.';
  }
  if (role === 'employee' && !managerId) {
    errors.managerId = 'Select the manager you report to.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * "Add User" (Phase 4) — no password: the new account is created via a
 * real Supabase Auth invite (see supabase/functions/admin-invite-user),
 * not a self-chosen password.
 * @param {{ name?: string, email?: string, role?: string, managerId?: string }} form
 */
export function validateAddUserForm(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  const { name = '', email = '', role = '', managerId = '' } = form || {};

  if (!name.trim()) errors.name = 'Name is required.';
  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (role !== 'manager' && role !== 'employee') {
    errors.role = 'Select a role.';
  }
  if (role === 'employee' && !managerId) {
    errors.managerId = 'Select the manager this employee reports to.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * @param {{ email?: string, password?: string }} form
 */
export function validateSigninForm(form) {
  /** @type {Record<string, string>} */
  const errors = {};
  const { email = '', password = '' } = form || {};
  if (!email.trim()) errors.email = 'Email is required.';
  if (!password) errors.password = 'Password is required.';
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * The New Task dialog's "Has Dependency" section (Phase 5). `mode` is
 * 'existing' (search picker) or 'new' (mini create-dependency form).
 * `activeUserIds` scopes the "cannot assign to an inactive user" check
 * (test case 10) to whichever users the dependency Assign To picker
 * actually offered — the server (schema.sql's check_assignee_active
 * trigger) enforces this too; this is just the friendlier client-side
 * message shown before ever hitting the network.
 * @param {{ mode?: string, taskId?: string, title?: string, assigneeId?: string }} form
 * @param {string[]} [activeUserIds]
 */
export function validateDependencyForm(form, activeUserIds = []) {
  /** @type {Record<string, string>} */
  const errors = {};
  const { mode = '', taskId = '', title = '', assigneeId = '' } = form || {};

  if (mode === 'existing') {
    if (!taskId) errors.taskId = 'Select an existing task to depend on.';
  } else if (mode === 'new') {
    if (!title.trim()) errors.title = 'Dependency title is required.';
    if (!assigneeId) {
      errors.assigneeId = 'Select who this dependency is assigned to.';
    } else if (!activeUserIds.includes(assigneeId)) {
      errors.assigneeId = 'Cannot assign a task to an inactive user.';
    }
  } else {
    errors.mode = 'Choose whether to search an existing task or create a new one.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * @param {{ title?: string, dueDate?: string }} form
 * @param {string} [today] YYYY-MM-DD, injectable for tests
 */
export function validateNewTaskForm(form, today = todayISODate()) {
  /** @type {Record<string, string>} */
  const errors = {};
  const { title = '', dueDate = '' } = form || {};

  if (!title.trim()) errors.title = 'Title is required.';
  if (!dueDate) {
    errors.dueDate = 'Date is required.';
  } else if (isPastDate(dueDate, today)) {
    errors.dueDate = 'Date cannot be in the past.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
