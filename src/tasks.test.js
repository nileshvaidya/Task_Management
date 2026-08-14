import { describe, it, expect, vi } from 'vitest';
import { fetchMyTasks, fetchTeamTasks, createTask, setTaskStatus, toggleTaskDone } from './tasks.js';

function chainable(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    insert: () => builder,
    update: () => builder,
    single: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

describe('fetchMyTasks', () => {
  it('returns the owner\'s tasks', async () => {
    const tasks = [{ id: 't1', owner_id: 'u1' }];
    const client = { from: vi.fn(() => chainable({ data: tasks, error: null })) };
    expect(await fetchMyTasks('u1', client)).toEqual(tasks);
  });

  it('returns an empty array on error rather than throwing', async () => {
    const client = { from: vi.fn(() => chainable({ data: null, error: { message: 'boom' } })) };
    expect(await fetchMyTasks('u1', client)).toEqual([]);
  });

  it('returns an empty array when no client is configured', async () => {
    expect(await fetchMyTasks('u1', null)).toEqual([]);
  });
});

describe('fetchTeamTasks', () => {
  it('fetches tasks owned by the manager\'s reports', async () => {
    const client = {
      from: vi.fn((table) => {
        if (table === 'users') return chainable({ data: [{ id: 'e1' }, { id: 'e2' }], error: null });
        return chainable({ data: [{ id: 't1', owner_id: 'e1' }], error: null });
      }),
    };
    const tasks = await fetchTeamTasks('m1', client);
    expect(tasks).toEqual([{ id: 't1', owner_id: 'e1' }]);
  });

  it('returns an empty array when the manager has no reports (skips the tasks query)', async () => {
    const tasksQuery = vi.fn();
    const client = {
      from: vi.fn((table) => {
        if (table === 'users') return chainable({ data: [], error: null });
        tasksQuery();
        return chainable({ data: [], error: null });
      }),
    };
    expect(await fetchTeamTasks('m1', client)).toEqual([]);
    expect(tasksQuery).not.toHaveBeenCalled();
  });
});

describe('createTask', () => {
  it('inserts with owner_id and created_by both set to the given owner', async () => {
    const insert = vi.fn(() => chainable({ data: { id: 't1' }, error: null }));
    const client = { from: vi.fn(() => ({ insert, select: () => ({ single: () => Promise.resolve({ data: { id: 't1' }, error: null }) }) })) };
    const { data, error } = await createTask(
      { title: 'Write report', dueDate: '2026-08-14', ownerId: 'u1' },
      client
    );
    expect(error).toBeNull();
    expect(data).toEqual({ id: 't1' });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Write report', due_date: '2026-08-14', owner_id: 'u1', created_by: 'u1' })
    );
  });
});

describe('setTaskStatus', () => {
  it('clears blocked/blocked_reason when marking completed', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
    }));
    const client = { from: vi.fn(() => ({ update })) };
    await setTaskStatus('t1', 'completed', client);
    expect(update).toHaveBeenCalledWith({ status: 'completed', blocked: false, blocked_reason: null });
  });

  it('leaves blocked/blocked_reason untouched for a non-completed status', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
    }));
    const client = { from: vi.fn(() => ({ update })) };
    await setTaskStatus('t1', 'in-progress', client);
    expect(update).toHaveBeenCalledWith({ status: 'in-progress' });
  });
});

describe('toggleTaskDone', () => {
  it('flips a planned task to completed', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
    }));
    const client = { from: vi.fn(() => ({ update })) };
    await toggleTaskDone({ id: 't1', status: 'planned' }, client);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('flips a completed task back to planned', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
    }));
    const client = { from: vi.fn(() => ({ update })) };
    await toggleTaskDone({ id: 't1', status: 'completed' }, client);
    expect(update).toHaveBeenCalledWith({ status: 'planned' });
  });
});
