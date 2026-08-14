import { describe, it, expect } from 'vitest';
import { getDemoUser, DEMO_USERS } from './demoMode.js';

describe('getDemoUser', () => {
  it('returns null when demo mode is disabled, regardless of the URL param', () => {
    expect(getDemoUser(false, '?demoRole=manager')).toBeNull();
  });

  it('returns null when demo mode is enabled but no demoRole param is present', () => {
    expect(getDemoUser(true, '')).toBeNull();
  });

  it('returns null for an unrecognized demoRole value', () => {
    expect(getDemoUser(true, '?demoRole=admin')).toBeNull();
  });

  it('returns the seeded manager for ?demoRole=manager', () => {
    expect(getDemoUser(true, '?demoRole=manager')).toEqual(DEMO_USERS.manager);
  });

  it('returns the seeded employee for ?demoRole=employee', () => {
    expect(getDemoUser(true, '?demoRole=employee')).toEqual(DEMO_USERS.employee);
  });
});
