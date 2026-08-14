import { describe, it, expect, vi } from 'vitest';
import { logActivity, fetchTeamActivity } from './activity.js';

function chainable(result) {
  const builder = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    single: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

describe('logActivity', () => {
  it('inserts actor/verb/task/detail', async () => {
    const insert = vi.fn(() => chainable({ data: { id: 'a1' }, error: null }));
    const client = { from: vi.fn(() => ({ insert })) };
    const { data, error } = await logActivity(
      { actorId: 'u1', verb: 'created', taskId: 't1', detail: 'Write report' },
      client
    );
    expect(error).toBeNull();
    expect(data).toEqual({ id: 'a1' });
    expect(insert).toHaveBeenCalledWith({
      actor_id: 'u1',
      verb: 'created',
      task_id: 't1',
      detail: 'Write report',
    });
  });

  it('returns a readable error when no client is configured', async () => {
    const { data, error } = await logActivity({ actorId: 'u1', verb: 'created' }, null);
    expect(data).toBeNull();
    expect(error.message).toMatch(/not configured/i);
  });
});

describe('fetchTeamActivity', () => {
  it('returns the team activity feed, newest first', async () => {
    const entries = [{ id: 'a2' }, { id: 'a1' }];
    const client = { from: vi.fn(() => chainable({ data: entries, error: null })) };
    expect(await fetchTeamActivity(client)).toEqual(entries);
  });

  it('returns an empty array on error rather than throwing', async () => {
    const client = { from: vi.fn(() => chainable({ data: null, error: { message: 'boom' } })) };
    expect(await fetchTeamActivity(client)).toEqual([]);
  });

  it('returns an empty array when no client is configured', async () => {
    expect(await fetchTeamActivity(null)).toEqual([]);
  });
});
