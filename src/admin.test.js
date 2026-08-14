import { describe, it, expect, vi } from 'vitest';
import { fetchAdminUsers, fetchAdminTasks, inviteUser, setUserStatus, softDeleteUser, overrideTask } from './admin.js';

describe('fetchAdminUsers', () => {
  it('returns the users from the admin_list_users RPC', async () => {
    const users = [{ id: 'u1', name: 'Sarah' }];
    const client = { rpc: vi.fn(() => Promise.resolve({ data: users, error: null })) };
    expect(await fetchAdminUsers(client)).toEqual(users);
    expect(client.rpc).toHaveBeenCalledWith('admin_list_users');
  });

  it('returns an empty array on error (e.g. caller is not a manager)', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'not a manager' } })) };
    expect(await fetchAdminUsers(client)).toEqual([]);
  });

  it('returns an empty array when no client is configured', async () => {
    expect(await fetchAdminUsers(null)).toEqual([]);
  });
});

describe('fetchAdminTasks', () => {
  it('returns the tasks from the admin_list_tasks RPC', async () => {
    const tasks = [{ id: 't1', title: 'Write report' }];
    const client = { rpc: vi.fn(() => Promise.resolve({ data: tasks, error: null })) };
    expect(await fetchAdminTasks(client)).toEqual(tasks);
    expect(client.rpc).toHaveBeenCalledWith('admin_list_tasks');
  });

  it('returns an empty array on error', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })) };
    expect(await fetchAdminTasks(client)).toEqual([]);
  });
});

describe('inviteUser', () => {
  it('invokes the admin-invite-user Edge Function with the form as the body', async () => {
    const invoke = vi.fn(() => Promise.resolve({ data: { data: { id: 'u2', name: 'David' } }, error: null }));
    const client = { functions: { invoke } };
    const form = { name: 'David', email: 'd@x.com', role: 'employee', managerId: 'u1' };
    const { data, error } = await inviteUser(form, client);
    expect(error).toBeNull();
    expect(data).toEqual({ id: 'u2', name: 'David' });
    expect(invoke).toHaveBeenCalledWith('admin-invite-user', { body: form });
  });

  it('surfaces the Edge Function error message', async () => {
    const client = { functions: { invoke: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Email already registered' } })) } };
    const { data, error } = await inviteUser({ name: 'x', email: 'x@x.com', role: 'employee', managerId: 'u1' }, client);
    expect(data).toBeNull();
    expect(error.message).toBe('Email already registered');
  });

  it('returns a readable error when no client is configured', async () => {
    const { data, error } = await inviteUser({ name: 'x', email: 'x@x.com', role: 'manager' }, null);
    expect(data).toBeNull();
    expect(error.message).toMatch(/not configured/i);
  });
});

describe('setUserStatus', () => {
  it('calls set_user_status with target_id/new_status', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: { id: 'u2', status: 'inactive' }, error: null })) };
    const { data, error } = await setUserStatus('u2', 'inactive', client);
    expect(error).toBeNull();
    expect(data).toEqual({ id: 'u2', status: 'inactive' });
    expect(client.rpc).toHaveBeenCalledWith('set_user_status', { target_id: 'u2', new_status: 'inactive' });
  });
});

describe('softDeleteUser', () => {
  it('calls soft_delete_user with target_id', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: { id: 'u2', deleted_at: '2026-08-14' }, error: null })) };
    const { data, error } = await softDeleteUser('u2', client);
    expect(error).toBeNull();
    expect(data.id).toBe('u2');
    expect(client.rpc).toHaveBeenCalledWith('soft_delete_user', { target_id: 'u2' });
  });
});

describe('overrideTask', () => {
  it('calls override_task with task_id/new_status/new_owner_id', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: { id: 't1', status: 'completed' }, error: null })) };
    const { data, error } = await overrideTask('t1', 'completed', 'u3', client);
    expect(error).toBeNull();
    expect(data).toEqual({ id: 't1', status: 'completed' });
    expect(client.rpc).toHaveBeenCalledWith('override_task', { task_id: 't1', new_status: 'completed', new_owner_id: 'u3' });
  });

  it('defaults new_owner_id to null when not given (status-only override)', async () => {
    const client = { rpc: vi.fn(() => Promise.resolve({ data: { id: 't1' }, error: null })) };
    await overrideTask('t1', 'in-progress', undefined, client);
    expect(client.rpc).toHaveBeenCalledWith('override_task', { task_id: 't1', new_status: 'in-progress', new_owner_id: null });
  });
});
