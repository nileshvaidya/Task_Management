import { describe, it, expect, vi } from 'vitest';
import { fetchTeamMembers } from './users.js';

function chainable(result) {
  const builder = {
    select: () => builder,
    in: () => builder,
    order: () => Promise.resolve(result),
  };
  return builder;
}

describe('fetchTeamMembers', () => {
  it('resolves team member ids via RPC, then fetches their profiles', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: ['u1', 'u2'], error: null }));
    const members = [{ id: 'u1', name: 'Sarah' }, { id: 'u2', name: 'David' }];
    const client = { rpc, from: vi.fn(() => chainable({ data: members, error: null })) };
    expect(await fetchTeamMembers('u1', client)).toEqual(members);
    expect(rpc).toHaveBeenCalledWith('team_member_ids', { uid: 'u1' });
  });

  it('throws (rather than running an unscoped select) when the RPC call errors', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })), from: vi.fn() };
    await expect(fetchTeamMembers('u1', client)).rejects.toMatchObject({ message: 'boom' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('throws when the profile query itself errors', async () => {
    const client = {
      rpc: vi.fn(() => Promise.resolve({ data: ['u1'], error: null })),
      from: vi.fn(() => chainable({ data: null, error: { message: 'boom' } })),
    };
    await expect(fetchTeamMembers('u1', client)).rejects.toMatchObject({ message: 'boom' });
  });

  it('returns an empty array when no client is configured', async () => {
    expect(await fetchTeamMembers('u1', null)).toEqual([]);
  });
});
