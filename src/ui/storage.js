// The browser storage of the app (STOR-1, STOR-2): namespaced keys, every value wrapped as
// {version, data}. Failures never throw: callers get a status or false and decide what to tell
// the user. Clear-all and the visible notice for full storage belong to #39.
import { unwrap, wrap } from '../core/envelope.js';

const PREFIX = 'budget-planner:';

/** Raw text of a key, null when absent, undefined when storage is not available. */
function read(name) {
  try {
    return localStorage.getItem(PREFIX + name);
  } catch {
    return undefined;
  }
}

/**
 * Read and migrate a stored value. Status is one of the `unwrap` statuses or `unavailable`. A value
 * that needed migrating is copied to a backup key first, and the stored original is not changed.
 */
export function load(name, options) {
  const raw = read(name);
  if (raw === undefined) return { status: 'unavailable', data: null };
  if (raw === null) return unwrap(null, options);
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: 'invalid', data: null };
  }
  const result = unwrap(value, options);
  if (result.status === 'migrated') {
    try {
      localStorage.setItem(`${PREFIX}backup:${name}`, raw);
    } catch {
      // the backup is best effort; the original stays where it is
    }
  }
  return result;
}

/** Store a ready-made envelope. Refuses (false) to replace a value from a newer version. */
export function saveEnvelope(name, envelope) {
  try {
    const current = localStorage.getItem(PREFIX + name);
    if (current) {
      try {
        if (JSON.parse(current)?.version > envelope.version) return false;
      } catch {
        // an unreadable value is replaced
      }
    }
    localStorage.setItem(PREFIX + name, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/** Store `data` under `name` with its schema version. Returns false when it could not be saved. */
export const save = (name, version, data) => saveEnvelope(name, wrap(version, data));
