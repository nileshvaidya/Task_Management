import { describe, it, expect, vi } from 'vitest';
import { getSessionUser, getCurrentProfile, fetchActiveManagers, signUp, signIn, signOutUser } from './auth.js';

// A minimal stand-in for the Supabase query builder: every chain method
// returns itself, and it resolves to `result` whether awaited directly or
// finalized with .single().
function chainable(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    insert: () => builder,
    single: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function makeClient(overrides = {}) {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      signUp: vi.fn(async () => ({ data: { session: null, user: null }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: { user: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      ...overrides.auth,
    },
    from: vi.fn(() => chainable(overrides.fromResult ?? { data: null, error: null })),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    ...overrides,
  };
}

describe('getSessionUser', () => {
  it('returns null when there is no session and no client', async () => {
    expect(await getSessionUser(null)).toBeNull();
  });

  it('returns the session user when one exists', async () => {
    const client = makeClient({
      auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } } })) },
    });
    expect(await getSessionUser(client)).toEqual({ id: 'u1' });
  });
});

describe('getCurrentProfile', () => {
  it('returns null when there is no session', async () => {
    const client = makeClient();
    expect(await getCurrentProfile(client)).toBeNull();
  });

  it('fetches the profile row for the session user', async () => {
    const profile = { id: 'u1', name: 'Sarah Jenkins', email: 'sarah.j@company.com', role: 'manager' };
    const client = makeClient({
      auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } } })) },
      fromResult: { data: profile, error: null },
    });
    expect(await getCurrentProfile(client)).toEqual(profile);
  });
});

describe('fetchActiveManagers', () => {
  it('returns the manager list on success', async () => {
    const managers = [{ id: 'u1', name: 'Sarah Jenkins', email: 'sarah.j@company.com' }];
    const client = makeClient({ fromResult: { data: managers, error: null } });
    expect(await fetchActiveManagers(client)).toEqual(managers);
  });

  it('returns an empty array on error rather than throwing', async () => {
    const client = makeClient({ fromResult: { data: null, error: { message: 'boom' } } });
    expect(await fetchActiveManagers(client)).toEqual([]);
  });
});

describe('signUp', () => {
  const validForm = { name: 'David Chen', email: 'd.chen@company.com', password: 'secret1', role: 'manager' };

  it('short-circuits with a validation error before calling Supabase', async () => {
    const client = makeClient();
    const { error } = await signUp({ ...validForm, role: '' }, client);
    expect(error.message).toMatch(/select a role/i);
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('surfaces a readable error when signUp returns no session (email confirmation on)', async () => {
    const client = makeClient({
      auth: { signUp: vi.fn(async () => ({ data: { session: null, user: { id: 'u1' } }, error: null })) },
    });
    const { error } = await signUp(validForm, client);
    expect(error.message).toMatch(/confirm email/i);
  });

  it('creates the auth user and the profile row on success', async () => {
    const client = makeClient({
      auth: {
        signUp: vi.fn(async () => ({
          data: { session: { user: { id: 'u1' } }, user: { id: 'u1' } },
          error: null,
        })),
      },
      fromResult: { error: null },
    });
    const { data, error } = await signUp(validForm, client);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(client.from).toHaveBeenCalledWith('users');
    expect(client.rpc).toHaveBeenCalledWith('touch_last_active');
  });
});

describe('signIn', () => {
  it('short-circuits with a validation error before calling Supabase', async () => {
    const client = makeClient();
    const { error } = await signIn({ email: '', password: '' }, client);
    expect(error).toBeTruthy();
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs out and blocks an inactive user', async () => {
    const client = makeClient({
      auth: {
        signInWithPassword: vi.fn(async () => ({ data: { user: { id: 'u2' } }, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      fromResult: { data: { id: 'u2', status: 'inactive' }, error: null },
    });
    const { data, error } = await signIn({ email: 'd.chen@company.com', password: 'secret1' }, client);
    expect(data).toBeNull();
    expect(error.code).toBe('inactive_user');
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('returns the profile and bumps last_active for an active user', async () => {
    const profile = { id: 'u1', status: 'active', name: 'Sarah Jenkins' };
    const client = makeClient({
      auth: { signInWithPassword: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })) },
      fromResult: { data: profile, error: null },
    });
    const { data, error } = await signIn({ email: 'sarah.j@company.com', password: 'secret1' }, client);
    expect(error).toBeNull();
    expect(data).toEqual(profile);
    expect(client.rpc).toHaveBeenCalledWith('touch_last_active');
  });
});

describe('signOutUser', () => {
  it('calls signOut when a client is configured', async () => {
    const client = makeClient();
    await signOutUser(client);
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('does nothing when there is no client', async () => {
    await expect(signOutUser(null)).resolves.toBeUndefined();
  });
});
