import { describe, it, expect, vi } from 'vitest';
import {
  fetchMyTasks,
  fetchTeamTasks,
  fetchAllTeamTasks,
  createTask,
  setTaskStatus,
  toggleTaskDone,
  acceptTask,
  fetchAssignableUsers,
  fetchDependencyCandidates,
  createTaskWithDependency,
  deleteTask,
} from './tasks.js';

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

  it('throws on a real query error, distinct from a genuinely empty result', async () => {
    const client = { from: vi.fn(() => chainable({ data: null, error: { message: 'boom' } })) };
    await expect(fetchMyTasks('u1', client)).rejects.toMatchObject({ message: 'boom' });
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

  it('throws when the reports lookup errors, distinct from genuinely having no reports', async () => {
    const client = { from: vi.fn(() => chainable({ data: null, error: { message: 'boom' } })) };
    await expect(fetchTeamTasks('m1', client)).rejects.toMatchObject({ message: 'boom' });
  });

  it('throws when the tasks query itself errors', async () => {
    const client = {
      from: vi.fn((table) => {
        if (table === 'users') return chainable({ data: [{ id: 'e1' }], error: null });
        return chainable({ data: null, error: { message: 'boom' } });
      }),
    };
    await expect(fetchTeamTasks('m1', client)).rejects.toMatchObject({ message: 'boom' });
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

  it('throws when the team_member_ids RPC call errors', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })), from: vi.fn() };
    await expect(fetchAllTeamTasks('u1', client)).rejects.toMatchObject({ message: 'boom' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('throws when the tasks query itself errors', async () => {
    const client = {
      rpc: vi.fn(() => Promise.resolve({ data: ['u1'], error: null })),
      from: vi.fn(() => chainable({ data: null, error: { message: 'boom' } })),
    };
    await expect(fetchAllTeamTasks('u1', client)).rejects.toMatchObject({ message: 'boom' });
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

describe('acceptTask', () => {
  it('sets accepted=true and logs an "accepted" activity entry', async () => {
    const activityInsert = vi.fn(() => chainable({ data: { id: 'a1' }, error: null }));
    const client = tableRoutedClient({
      tasks: {
        update: () => ({
          eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 't1', title: 'Write report' }, error: null }) }) }),
        }),
      },
      activity_log: { insert: activityInsert },
    });
    const { data, error } = await acceptTask('t1', 'u2', client);
    expect(error).toBeNull();
    expect(data).toEqual({ id: 't1', title: 'Write report' });
    expect(activityInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: 'u2', verb: 'accepted', task_id: 't1', detail: 'Write report' })
    );
  });
});

describe('fetchAssignableUsers', () => {
  it('returns the users from the list_assignable_users RPC', async () => {
    const users = [{ id: 'u1', name: 'Sarah' }];
    const client = { rpc: vi.fn(() => Promise.resolve({ data: users, error: null })) };
    expect(await fetchAssignableUsers(client)).toEqual(users);
    expect(client.rpc).toHaveBeenCalledWith('list_assignable_users');
  });

  it('throws on error', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })) };
    await expect(fetchAssignableUsers(client)).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('fetchDependencyCandidates', () => {
  it('returns tasks from the list_all_tasks_for_dependency RPC', async () => {
    const tasks = [{ id: 't1', title: 'x', owner_id: 'u1', owner_name: 'Sarah', status: 'planned' }];
    const client = { rpc: vi.fn(() => Promise.resolve({ data: tasks, error: null })) };
    expect(await fetchDependencyCandidates(client)).toEqual(tasks);
    expect(client.rpc).toHaveBeenCalledWith('list_all_tasks_for_dependency');
  });

  it('throws on error', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })) };
    await expect(fetchDependencyCandidates(client)).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('createTaskWithDependency', () => {
  function mockClientForDependency({ inserts, updateResult }) {
    const activityInsert = vi.fn(() => chainable({ data: { id: 'a' }, error: null }));
    const insertMock = vi.fn();
    inserts.forEach((result) => insertMock.mockImplementationOnce(() => chainable(result)));
    const updateMock = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve(updateResult) }) }),
    }));
    const from = vi.fn((table) => {
      if (table === 'activity_log') return { insert: activityInsert };
      return { insert: insertMock, update: updateMock };
    });
    return { from, activityInsert, insertMock, updateMock };
  }

  const primaryTask = { id: 'p1', title: 'Write Q3 report' };

  it('creates only the primary task when no dependency is given', async () => {
    const client = mockClientForDependency({ inserts: [{ data: primaryTask, error: null }], updateResult: null });
    const { data, error } = await createTaskWithDependency(
      { title: 'Write Q3 report', dueDate: '2026-08-14', ownerId: 'u1', createdBy: 'u1', dependency: null },
      client
    );
    expect(error).toBeNull();
    expect(data).toEqual(primaryTask);
    expect(client.updateMock).not.toHaveBeenCalled();
  });

  it('creating a new dependency WITH "requires acceptance" blocks the primary task (test case 4)', async () => {
    const depTask = { id: 'd1', title: 'Design sign-off' };
    const updatedPrimary = { ...primaryTask, blocked: true, status: 'in-progress', depends_on_task_id: 'd1' };
    const client = mockClientForDependency({
      inserts: [{ data: primaryTask, error: null }, { data: depTask, error: null }],
      updateResult: { data: updatedPrimary, error: null },
    });

    const { data, error } = await createTaskWithDependency(
      {
        title: 'Write Q3 report',
        dueDate: '2026-08-14',
        ownerId: 'u1',
        createdBy: 'u1',
        dependency: { mode: 'new', requiresAcceptance: true, title: 'Design sign-off', assigneeId: 'u2', assigneeName: 'David Chen' },
      },
      client
    );

    expect(error).toBeNull();
    expect(data).toEqual(updatedPrimary);
    expect(client.updateMock).toHaveBeenCalledWith({
      depends_on_task_id: 'd1',
      status: 'in-progress',
      blocked: true,
      blocked_reason: 'David Chen — Design sign-off',
    });
    expect(client.activityInsert).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'blocked', task_id: 'p1', detail: 'David Chen — Design sign-off' })
    );
  });

  it('creating a new dependency WITHOUT "requires acceptance" links it but does not block (test case 5)', async () => {
    const depTask = { id: 'd1', title: 'Design sign-off' };
    const updatedPrimary = { ...primaryTask, depends_on_task_id: 'd1' };
    const client = mockClientForDependency({
      inserts: [{ data: primaryTask, error: null }, { data: depTask, error: null }],
      updateResult: { data: updatedPrimary, error: null },
    });

    const { data, error } = await createTaskWithDependency(
      {
        title: 'Write Q3 report',
        dueDate: '2026-08-14',
        ownerId: 'u1',
        createdBy: 'u1',
        dependency: { mode: 'new', requiresAcceptance: false, title: 'Design sign-off', assigneeId: 'u2', assigneeName: 'David Chen' },
      },
      client
    );

    expect(error).toBeNull();
    expect(data).toEqual(updatedPrimary);
    expect(client.updateMock).toHaveBeenCalledWith({ depends_on_task_id: 'd1' });
  });

  it('links an existing task as the dependency without creating a new one', async () => {
    const updatedPrimary = { ...primaryTask, depends_on_task_id: 'existing-1' };
    const client = mockClientForDependency({
      inserts: [{ data: primaryTask, error: null }],
      updateResult: { data: updatedPrimary, error: null },
    });

    const { data, error } = await createTaskWithDependency(
      {
        title: 'Write Q3 report',
        dueDate: '2026-08-14',
        ownerId: 'u1',
        createdBy: 'u1',
        dependency: {
          mode: 'existing',
          requiresAcceptance: true,
          taskId: 'existing-1',
          taskTitle: 'Legal review',
          taskOwnerName: 'Marcus Cole',
        },
      },
      client
    );

    expect(error).toBeNull();
    expect(data).toEqual(updatedPrimary);
    expect(client.insertMock).toHaveBeenCalledTimes(1);
    expect(client.updateMock).toHaveBeenCalledWith({
      depends_on_task_id: 'existing-1',
      status: 'in-progress',
      blocked: true,
      blocked_reason: 'Marcus Cole — Legal review',
    });
  });

  it('returns the primary task (unblocked) if creating the new dependency fails', async () => {
    const client = mockClientForDependency({
      inserts: [{ data: primaryTask, error: null }, { data: null, error: { message: 'insert failed' } }],
      updateResult: null,
    });

    const { data, error } = await createTaskWithDependency(
      {
        title: 'Write Q3 report',
        dueDate: '2026-08-14',
        ownerId: 'u1',
        createdBy: 'u1',
        dependency: { mode: 'new', requiresAcceptance: true, title: 'Design sign-off', assigneeId: 'u2', assigneeName: 'David Chen' },
      },
      client
    );

    expect(error).toEqual({ message: 'insert failed' });
    expect(data).toEqual(primaryTask);
    expect(client.updateMock).not.toHaveBeenCalled();
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

describe('deleteTask', () => {
  it('deletes the task by id and returns no error on success', async () => {
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    const del = vi.fn(() => ({ eq }));
    const client = tableRoutedClient({ tasks: { delete: del } });
    const { error } = await deleteTask('t1', client);
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 't1');
    expect(error).toBeNull();
  });

  it('surfaces an RLS rejection (e.g. an employee trying to delete a non-direct-report\'s task) as an error', async () => {
    const eq = vi.fn(() => Promise.resolve({ error: { message: 'new row violates row-level security policy' } }));
    const del = vi.fn(() => ({ eq }));
    const client = tableRoutedClient({ tasks: { delete: del } });
    const { error } = await deleteTask('t1', client);
    expect(error).toBeTruthy();
  });

  it('returns a config error when Supabase is not configured (demo mode)', async () => {
    const { error } = await deleteTask('t1', null);
    expect(error).toBeTruthy();
  });
});
