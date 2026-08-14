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

  it('never runs the profile query when the RPC call errors — avoids an unscoped select', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })), from: vi.fn() };
    expect(await fetchTeamMembers('u1', client)).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('returns an empty array when no client is configured', async () => {
    expect(await fetchTeamMembers('u1', null)).toEqual([]);
  });
});
