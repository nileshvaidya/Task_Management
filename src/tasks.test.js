import { describe, it, expect, vi } from 'vitest';
import { fetchMyTasks, fetchTeamTasks, fetchAllTeamTasks, createTask, setTaskStatus, toggleTaskDone } from './tasks.js';

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

describe('fetchAllTeamTasks', () => {
  it('resolves team member ids via RPC, then fetches their tasks', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: ['u1', 'u2'], error: null }));
    const client = {
      rpc,
      from: vi.fn(() => chainable({ data: [{ id: 't1', owner_id: 'u1' }, { id: 't2', owner_id: 'u2' }], error: null })),
    };
    const tasks = await fetchAllTeamTasks('u1', client);
    expect(rpc).toHaveBeenCalledWith('team_member_ids', { uid: 'u1' });
    expect(tasks).toEqual([{ id: 't1', owner_id: 'u1' }, { id: 't2', owner_id: 'u2' }]);
  });

  it('returns an empty array when the RPC call errors', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })), from: vi.fn() };
    expect(await fetchAllTeamTasks('u1', client)).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('returns an empty array when no client is configured', async () => {
    expect(await fetchAllTeamTasks('u1', null)).toEqual([]);
  });
});

// createTask/setTaskStatus also write to activity_log (Phase 3) — route the
// mocked client by table name so a task mutation and its activity-log
// side-effect don't share (and silently corrupt) the same insert/update mock.
function tableRoutedClient(routes) {
  return { from: vi.fn((table) => routes[table] ?? chainable({ data: null, error: null })) };
}

describe('createTask', () => {
  it('inserts with owner_id and created_by both set to the given owner', async () => {
    const insert = vi.fn(() => chainable({ data: { id: 't1', title: 'Write report' }, error: null }));
    const activityInsert = vi.fn(() => chainable({ data: { id: 'a1' }, error: null }));
    const client = tableRoutedClient({
      tasks: { insert, select: () => ({ single: () => Promise.resolve({ data: { id: 't1', title: 'Write report' }, error: null }) }) },
      activity_log: { insert: activityInsert, select: () => ({ single: () => Promise.resolve({ data: { id: 'a1' }, error: null }) }) },
    });
    const { data, error } = await createTask(
      { title: 'Write report', dueDate: '2026-08-14', ownerId: 'u1' },
      client
    );
    expect(error).toBeNull();
    expect(data).toEqual({ id: 't1', title: 'Write report' });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Write report', due_date: '2026-08-14', owner_id: 'u1', created_by: 'u1' })
    );
  });

  it('logs a "created" activity entry for the new task', async () => {
    const activityInsert = vi.fn(() => chainable({ data: { id: 'a1' }, error: null }));
    const client = tableRoutedClient({
      tasks: {
        insert: () => chainable({ data: { id: 't1', title: 'Write report' }, error: null }),
        select: () => ({ single: () => Promise.resolve({ data: { id: 't1', title: 'Write report' }, error: null }) }),
      },
      activity_log: { insert: activityInsert, select: () => ({ single: () => Promise.resolve({ data: { id: 'a1' }, error: null }) }) },
    });
    await createTask({ title: 'Write report', dueDate: '2026-08-14', ownerId: 'u1' }, client);
    expect(activityInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: 'u1', verb: 'created', task_id: 't1', detail: 'Write report' })
    );
  });
});

describe('setTaskStatus', () => {
  it('clears blocked/blocked_reason when marking completed', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { title: 'x' }, error: null }) }) }),
    }));
    const client = tableRoutedClient({ tasks: { update } });
    await setTaskStatus('t1', 'completed', 'u1', client);
    expect(update).toHaveBeenCalledWith({ status: 'completed', blocked: false, blocked_reason: null });
  });

  it('leaves blocked/blocked_reason untouched for a non-completed status', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { title: 'x' }, error: null }) }) }),
    }));
    const client = tableRoutedClient({ tasks: { update } });
    await setTaskStatus('t1', 'in-progress', 'u1', client);
    expect(update).toHaveBeenCalledWith({ status: 'in-progress' });
  });

  it('logs a "status_changed" activity entry when an actorId is given', async () => {
    const activityInsert = vi.fn(() => chainable({ data: { id: 'a1' }, error: null }));
    const client = tableRoutedClient({
      tasks: {
        update: () => ({
          eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { title: 'Write report' }, error: null }) }) }),
        }),
      },
      activity_log: { insert: activityInsert, select: () => ({ single: () => Promise.resolve({ data: { id: 'a1' }, error: null }) }) },
    });
    await setTaskStatus('t1', 'in-progress', 'u1', client);
    expect(activityInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: 'u1', verb: 'status_changed', task_id: 't1' })
    );
  });

  it('skips activity logging when no actorId is given', async () => {
    const activityInsert = vi.fn();
    const client = tableRoutedClient({
      tasks: {
        update: () => ({
          eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { title: 'x' }, error: null }) }) }),
        }),
      },
      activity_log: { insert: activityInsert },
    });
    await setTaskStatus('t1', 'in-progress', undefined, client);
    expect(activityInsert).not.toHaveBeenCalled();
  });
});

describe('toggleTaskDone', () => {
  it('flips a planned task to completed', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { title: 'x' }, error: null }) }) }),
    }));
    const client = tableRoutedClient({ tasks: { update } });
    await toggleTaskDone({ id: 't1', status: 'planned' }, 'u1', client);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('flips a completed task back to planned', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { title: 'x' }, error: null }) }) }),
    }));
    const client = tableRoutedClient({ tasks: { update } });
    await toggleTaskDone({ id: 't1', status: 'completed' }, 'u1', client);
    expect(update).toHaveBeenCalledWith({ status: 'planned' });
  });
});
