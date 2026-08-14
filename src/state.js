// Minimal in-memory store + pub-sub, replacing a data-fetching framework
// (no React Query here — see design-reference brief). Screens subscribe to
// re-render their own DOM subtree when relevant state changes.
/**
 * @template {Record<string, unknown>} T
 * @param {T} [initialState]
 */
export function createStore(initialState = /** @type {T} */ ({})) {
  let state = { ...initialState };
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(patch) {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
    listeners.forEach((fn) => fn(state));
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { getState, setState, subscribe };
}
