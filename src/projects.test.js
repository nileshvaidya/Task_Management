import { describe, it, expect, vi } from 'vitest';
import { fetchProjects, createProject } from './projects.js';

describe('fetchProjects', () => {
  it('returns projects ordered by name', async () => {
    const projects = [{ id: 'p1', name: 'Marketing' }];
    const client = {
      from: vi.fn(() => ({
        select: () => ({ order: () => Promise.resolve({ data: projects, error: null }) }),
      })),
    };
    expect(await fetchProjects(client)).toEqual(projects);
  });

  it('throws on error', async () => {
    const client = {
      from: vi.fn(() => ({
        select: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }),
      })),
    };
    await expect(fetchProjects(client)).rejects.toMatchObject({ message: 'boom' });
  });

  it('returns an empty array when no client is configured', async () => {
    expect(await fetchProjects(null)).toEqual([]);
  });
});

describe('createProject', () => {
  it('inserts a project with the given name', async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'p1', name: 'Marketing' }, error: null }) }) }));
    const client = { from: vi.fn(() => ({ insert })) };
    const { data, error } = await createProject('Marketing', client);
    expect(error).toBeNull();
    expect(data).toEqual({ id: 'p1', name: 'Marketing' });
    expect(insert).toHaveBeenCalledWith({ name: 'Marketing' });
  });

  it('returns a readable error when no client is configured', async () => {
    const { data, error } = await createProject('Marketing', null);
    expect(data).toBeNull();
    expect(error.message).toMatch(/not configured/i);
  });
});
