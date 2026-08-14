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
