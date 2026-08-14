import { describe, it, expect } from 'vitest';
import { filterUsers } from './adminFilter.js';

const users = [
  { name: 'Sarah Jenkins', email: 'sarah.j@company.com' },
  { name: 'David Chen', email: 'd.chen@company.com' },
  { name: 'Marcus Cole', email: 'marcus.cole@company.com' },
];

describe('filterUsers', () => {
  it('returns every user for an empty or blank query', () => {
    expect(filterUsers(users, '')).toEqual(users);
    expect(filterUsers(users, '   ')).toEqual(users);
  });

  it('matches by name, case-insensitively', () => {
    expect(filterUsers(users, 'sarah')).toEqual([users[0]]);
    expect(filterUsers(users, 'CHEN')).toEqual([users[1]]);
  });

  it('matches by email substring', () => {
    expect(filterUsers(users, 'marcus.cole@')).toEqual([users[2]]);
  });

  it('matches a substring across multiple users', () => {
    expect(filterUsers(users, 'company.com')).toEqual(users);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterUsers(users, 'nonexistent')).toEqual([]);
  });
});
