// A minimal observable state holder for the import page. `set` merges a patch, `derive` adds the
// values computed from the state, and subscribers re-render.
export function createStore(initial, derive = state => state) {
  let state = derive(initial);
  const subscribers = new Set();
  return {
    get: () => state,
    set(patch) {
      state = derive({ ...state, ...patch });
      for (const notify of subscribers) notify(state);
    },
    subscribe(notify) {
      subscribers.add(notify);
      notify(state);
      return () => subscribers.delete(notify);
    },
  };
}
