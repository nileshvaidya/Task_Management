import { describe, it, expect, vi } from 'vitest';
import { createStore } from './state.js';

describe('createStore', () => {
  it('returns the initial state', () => {
    const store = createStore({ count: 0 });
    expect(store.getState()).toEqual({ count: 0 });
  });

  it('merges patches into state', () => {
    const store = createStore({ count: 0, name: 'a' });
    store.setState({ count: 1 });
    expect(store.getState()).toEqual({ count: 1, name: 'a' });
  });

  it('accepts a function patch computed from previous state', () => {
    const store = createStore({ count: 1 });
    store.setState((s) => ({ count: s.count + 1 }));
    expect(store.getState().count).toBe(2);
  });

  it('notifies subscribers on every setState, and unsubscribe stops notifications', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 1 });

    unsubscribe();
    store.setState({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
