import { describe, it, expect } from 'vitest';
import { filterTasksForDependency } from './dependencyFilter.js';

const tasks = [
  { id: 't1', title: 'Write Q3 report', owner_name: 'Sarah Jenkins' },
  { id: 't2', title: 'Design sign-off', owner_name: 'David Chen' },
  { id: 't3', title: 'Legal review', owner_name: 'Marcus Cole' },
];

describe('filterTasksForDependency', () => {
  it('returns every task for an empty or blank query', () => {
    expect(filterTasksForDependency(tasks, '')).toEqual(tasks);
    expect(filterTasksForDependency(tasks, '   ')).toEqual(tasks);
  });

  it('matches by task title, case-insensitively', () => {
    expect(filterTasksForDependency(tasks, 'design')).toEqual([tasks[1]]);
  });

  it('matches by owner name', () => {
    expect(filterTasksForDependency(tasks, 'marcus')).toEqual([tasks[2]]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterTasksForDependency(tasks, 'nonexistent')).toEqual([]);
  });

  it('excludes the given task id — a task can never depend on itself', () => {
    expect(filterTasksForDependency(tasks, '', 't1')).toEqual([tasks[1], tasks[2]]);
  });

  it('applies the exclusion before the search filter', () => {
    expect(filterTasksForDependency(tasks, 'report', 't1')).toEqual([]);
  });
});
