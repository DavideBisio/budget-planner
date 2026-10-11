// The planner's own state: load it from the browser, derive the projection, save changes (STOR-1).
import { PLANNER_VERSION, emptyPlanner, project, validatePlanner } from '../../core/planner.js';
import { load, save } from '../storage.js';
import { createStore } from '../store.js';

const currentMonth = () => new Date().toISOString().slice(0, 7);

/** The saved plan when there is a usable one, otherwise an empty plan starting this month. */
export function loadPlanner() {
  const { status, data } = load('planner', { version: PLANNER_VERSION });
  if ((status === 'ok' || status === 'migrated') && validatePlanner(data).length === 0) return data;
  return emptyPlanner(currentMonth());
}

/** The store holds `plan` and, derived from it, `projection`. Every change is saved. */
export function createPlannerStore() {
  const store = createStore({ plan: loadPlanner() }, state => ({
    ...state,
    projection: project(state.plan),
  }));
  return {
    ...store,
    /** Replace the plan with a changed copy; `change` receives a copy it may modify. */
    update(change) {
      const plan = structuredClone(store.get().plan);
      change(plan);
      save('planner', PLANNER_VERSION, plan);
      store.set({ plan });
    },
  };
}
