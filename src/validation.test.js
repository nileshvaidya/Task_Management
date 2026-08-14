import { describe, it, expect } from 'vitest';
import { validateSignupForm, validateSigninForm } from './validation.js';

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

describe('validateSigninForm', () => {
  it('requires both email and password', () => {
    expect(validateSigninForm({}).valid).toBe(false);
    expect(validateSigninForm({ email: 'a@b.com' }).valid).toBe(false);
    expect(validateSigninForm({ email: 'a@b.com', password: 'x' }).valid).toBe(true);
  });
});
