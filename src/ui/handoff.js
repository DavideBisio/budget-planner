// Hands the payload to the planner through the browser's own storage (STOR-6): same browser, no
// server. The payload is already an envelope ({version, data}).
import { saveEnvelope } from './storage.js';

/** Store the payload for the planner. Returns false when the browser refuses (full or disabled). */
export function sendToPlanner(payload) {
  return saveEnvelope('handoff', payload);
}
