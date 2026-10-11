// A minimal observable state holder for the import page: set merges a patch, subscribers re-render.
export function createStore(initial) {
  let state = initial;
  const subscribers = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      for (const notify of subscribers) notify(state);
    },
    subscribe(notify) {
      subscribers.add(notify);
      notify(state);
      return () => subscribers.delete(notify);
    },
  };
}
