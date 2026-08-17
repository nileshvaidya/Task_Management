import { describe, it, expect } from 'vitest';
import {
  validateSignupForm,
  validateSigninForm,
  validateNewTaskForm,
  validateAddUserForm,
  validateDependencyForm,
} from './validation.js';

describe('validateSignupForm', () => {
  const base = { name: 'David Chen', email: 'd.chen@company.com', password: 'secret1' };

  it('rejects a submission with no role selected', () => {
    const { valid, errors } = validateSignupForm({ ...base, role: '' });
    expect(valid).toBe(false);
    expect(errors.role).toMatch(/select a role/i);
  });

  it('rejects an unrecognized role value', () => {
    const { valid, errors } = validateSignupForm({ ...base, role: 'admin' });
    expect(valid).toBe(false);
    expect(errors.role).toBeDefined();
  });

  it('accepts a manager signup without a managerId', () => {
    const { valid, errors } = validateSignupForm({ ...base, role: 'manager' });
    expect(valid).toBe(true);
    expect(errors.managerId).toBeUndefined();
  });

  it('rejects an employee signup with no managerId', () => {
    const { valid, errors } = validateSignupForm({ ...base, role: 'employee', managerId: '' });
    expect(valid).toBe(false);
    expect(errors.managerId).toMatch(/manager/i);
  });

  it('accepts a valid employee signup with a managerId', () => {
    const { valid } = validateSignupForm({ ...base, role: 'employee', managerId: 'u1' });
    expect(valid).toBe(true);
  });

  it('rejects a missing or too-short password', () => {
    expect(validateSignupForm({ ...base, role: 'manager', password: '' }).valid).toBe(false);
    expect(validateSignupForm({ ...base, role: 'manager', password: '123' }).valid).toBe(false);
  });

  it('rejects an invalid email', () => {
    const { valid, errors } = validateSignupForm({ ...base, role: 'manager', email: 'not-an-email' });
    expect(valid).toBe(false);
    expect(errors.email).toBeDefined();
  });

  it('rejects a missing name', () => {
    const { valid, errors } = validateSignupForm({ ...base, role: 'manager', name: '  ' });
    expect(valid).toBe(false);
    expect(errors.name).toBeDefined();
  });
});

describe('validateAddUserForm', () => {
  const base = { name: 'Marcus Cole', email: 'marcus.cole@company.com' };

  it('rejects a missing name', () => {
    const { valid, errors } = validateAddUserForm({ ...base, name: '  ', role: 'manager' });
    expect(valid).toBe(false);
    expect(errors.name).toBeDefined();
  });

  it('rejects an invalid email', () => {
    const { valid, errors } = validateAddUserForm({ ...base, email: 'not-an-email', role: 'manager' });
    expect(valid).toBe(false);
    expect(errors.email).toBeDefined();
  });

  it('rejects a missing or unrecognized role', () => {
    expect(validateAddUserForm({ ...base, role: '' }).valid).toBe(false);
    expect(validateAddUserForm({ ...base, role: 'admin' }).valid).toBe(false);
  });

  it('accepts a manager with no managerId', () => {
    const { valid, errors } = validateAddUserForm({ ...base, role: 'manager' });
    expect(valid).toBe(true);
    expect(errors.managerId).toBeUndefined();
  });

  it('rejects an employee with no managerId', () => {
    const { valid, errors } = validateAddUserForm({ ...base, role: 'employee', managerId: '' });
    expect(valid).toBe(false);
    expect(errors.managerId).toMatch(/manager/i);
  });

  it('accepts a valid employee with a managerId', () => {
    expect(validateAddUserForm({ ...base, role: 'employee', managerId: 'u1' }).valid).toBe(true);
  });

  it('has no password field at all (invite flow, not self-chosen password)', () => {
    const { errors } = validateAddUserForm({ ...base, role: 'manager' });
    expect(errors.password).toBeUndefined();
  });
});

describe('validateDependencyForm', () => {
  const activeUserIds = ['u1', 'u2'];

  it('requires an existing task selection in "existing" mode', () => {
    const { valid, errors } = validateDependencyForm({ mode: 'existing', taskId: '' }, activeUserIds);
    expect(valid).toBe(false);
    expect(errors.taskId).toBeDefined();
  });

  it('accepts a valid "existing" mode selection', () => {
    expect(validateDependencyForm({ mode: 'existing', taskId: 't1' }, activeUserIds).valid).toBe(true);
  });

  it('requires a title and assignee in "new" mode', () => {
    const { valid, errors } = validateDependencyForm({ mode: 'new', title: '  ', assigneeId: '' }, activeUserIds);
    expect(valid).toBe(false);
    expect(errors.title).toBeDefined();
    expect(errors.assigneeId).toBeDefined();
  });

  it('rejects an assignee not in the active-user list (test case 10)', () => {
    const { valid, errors } = validateDependencyForm(
      { mode: 'new', title: 'Design sign-off', assigneeId: 'inactive-user' },
      activeUserIds
    );
    expect(valid).toBe(false);
    expect(errors.assigneeId).toMatch(/inactive/i);
  });

  it('accepts a valid "new" mode submission with an active assignee', () => {
    expect(
      validateDependencyForm({ mode: 'new', title: 'Design sign-off', assigneeId: 'u2' }, activeUserIds).valid
    ).toBe(true);
  });

  it('rejects a missing/unrecognized mode', () => {
    expect(validateDependencyForm({ mode: '' }, activeUserIds).valid).toBe(false);
  });
});

describe('validateSigninForm', () => {
  it('requires both email and password', () => {
    expect(validateSigninForm({}).valid).toBe(false);
    expect(validateSigninForm({ email: 'a@b.com' }).valid).toBe(false);
    expect(validateSigninForm({ email: 'a@b.com', password: 'x' }).valid).toBe(true);
  });
});

describe('validateNewTaskForm', () => {
  const today = '2026-08-14';

  it('requires a title', () => {
    const { valid, errors } = validateNewTaskForm({ title: '  ', dueDate: today }, today);
    expect(valid).toBe(false);
    expect(errors.title).toBeDefined();
  });

  it('requires a date', () => {
    const { valid, errors } = validateNewTaskForm({ title: 'Write report', dueDate: '' }, today);
    expect(valid).toBe(false);
    expect(errors.dueDate).toBeDefined();
  });

  it('rejects a past date', () => {
    const { valid, errors } = validateNewTaskForm({ title: 'Write report', dueDate: '2026-08-13' }, today);
    expect(valid).toBe(false);
    expect(errors.dueDate).toMatch(/past/i);
  });

  it('accepts today', () => {
    expect(validateNewTaskForm({ title: 'Write report', dueDate: today }, today).valid).toBe(true);
  });

  it('accepts a future date', () => {
    expect(validateNewTaskForm({ title: 'Write report', dueDate: '2026-09-01' }, today).valid).toBe(true);
  });
});
