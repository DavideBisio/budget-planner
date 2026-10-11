// The browser storage of the app (STOR-1, STOR-2, STOR-3): the only code that touches
// localStorage. Keys are namespaced and every value is wrapped as {version, data}. Failures never
// throw: callers get a status or false, and listeners hear about the problem so the page can tell
// the person (see notice.js).
import { unwrap, wrap } from '../core/envelope.js';
import { schemaFor } from '../core/schemas.js';

const PREFIX = 'budget-planner:';
const listeners = new Set();

/**
 * Hear about storage problems: `{kind: 'full' | 'unavailable' | 'newer', name}`. Returns a function
 * that stops listening.
 */
export function onStorageProblem(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function report(kind, name) {
  for (const listener of listeners) listener({ kind, name });
}

const isFull = error => error?.name === 'QuotaExceededError' || error?.code === 22;

/** Raw text of a key, null when absent, undefined when storage is not available. */
function read(name) {
  try {
    return localStorage.getItem(PREFIX + name);
  } catch {
    return undefined;
  }
}

/**
 * Read and migrate a stored value with the schema registered for `name` (or the given options).
 * Status is one of the `unwrap` statuses or `unavailable`. A value that needed migrating is copied
 * to a backup key first, and the stored original is not changed.
 */
export function load(name, options = schemaFor(name)) {
  const raw = read(name);
  if (raw === undefined) {
    report('unavailable', name);
    return { status: 'unavailable', data: null };
  }
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
        if (JSON.parse(current)?.version > envelope.version) {
          report('newer', name);
          return false;
        }
      } catch {
        // an unreadable value is replaced
      }
    }
    localStorage.setItem(PREFIX + name, JSON.stringify(envelope));
    return true;
  } catch (error) {
    report(isFull(error) ? 'full' : 'unavailable', name);
    return false;
  }
}

/** Store `data` under `name` with its schema version. Returns false when it could not be saved. */
export const save = (name, version, data) => saveEnvelope(name, wrap(version, data));

/**
 * Write several sections as one: `[{name, version, data}]`. When one cannot be written, every
 * section goes back to what it held before and the result is false (STOR-4).
 */
export function saveAll(items) {
  const before = new Map(items.map(({ name }) => [name, read(name)]));
  const done = [];
  for (const { name, version, data } of items) {
    if (!save(name, version, data)) {
      for (const written of done) {
        try {
          const raw = before.get(written);
          if (typeof raw === 'string') localStorage.setItem(PREFIX + written, raw);
          else localStorage.removeItem(PREFIX + written);
        } catch {
          // nothing more can be done: the person has been told that storage failed
        }
      }
      return false;
    }
    done.push(name);
  }
  return true;
}

/** Remove one key. Returns false when the browser refuses. */
export function remove(name) {
  try {
    localStorage.removeItem(PREFIX + name);
    return true;
  } catch {
    return false;
  }
}

/** The names (without the prefix) of everything the app has stored, backups included. */
export function storedKeys() {
  try {
    const names = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) names.push(key.slice(PREFIX.length));
    }
    return names;
  } catch {
    return [];
  }
}

/** Remove everything the app stored, and nothing else. Returns how many keys went, or false. */
export function clearAll() {
  try {
    const names = storedKeys();
    for (const name of names) localStorage.removeItem(PREFIX + name);
    return names.length;
  } catch {
    return false;
  }
}
