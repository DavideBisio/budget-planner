// Hands the payload to the planner through the browser's own storage (STOR-6): same browser, no
// server. This is the only place the import page writes it; #39 moves it into the storage module.
const KEY = 'budget-planner:handoff';

/** Store the payload for the planner. Returns false when the browser refuses (full or disabled). */
export function sendToPlanner(payload) {
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
