import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAll,
  load,
  onStorageProblem,
  remove,
  save,
  saveEnvelope,
  storedKeys,
} from '../../src/ui/storage.js';

// A tiny stand-in for the browser's localStorage.
function fakeStorage(overrides = {}) {
  const map = new Map();
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    key: i => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    ...overrides,
  };
}

const quota = () => {
  throw new DOMException('full', 'QuotaExceededError');
};
const denied = () => {
  throw new DOMException('no', 'SecurityError');
};

let storage;
let problems;
let stop;
beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal('localStorage', storage);
  problems = [];
  stop = onStorageProblem(p => problems.push(p));
});
afterEach(() => {
  stop();
  vi.unstubAllGlobals();
});

describe('save and load (STOR-1)', () => {
  it('stores a value under a namespaced key with its schema version', () => {
    expect(save('planner', 1, { a: 1 })).toBe(true);
    expect(JSON.parse(storage.map.get('budget-planner:planner'))).toEqual({
      version: 1,
      data: { a: 1 },
    });
  });

  it('reads it back through the registered schema', () => {
    save('planner', 1, { a: 1 });
    expect(load('planner')).toEqual({ status: 'ok', data: { a: 1 } });
  });

  it('reports nothing stored and unreadable text', () => {
    expect(load('planner').status).toBe('empty');
    storage.map.set('budget-planner:planner', '{not json');
    expect(load('planner').status).toBe('invalid');
  });
});

describe('migration (STOR-2)', () => {
  const options = { version: 2, migrations: { 1: data => ({ ...data, b: 2 }) } };

  it('migrates on load, backs the original up first and does not touch the stored value', () => {
    const original = JSON.stringify({ version: 1, data: { a: 1 } });
    storage.map.set('budget-planner:planner', original);
    expect(load('planner', options)).toEqual({ status: 'migrated', data: { a: 1, b: 2 } });
    expect(storage.map.get('budget-planner:backup:planner')).toBe(original);
    expect(storage.map.get('budget-planner:planner')).toBe(original);
  });

  it('a failing migration leaves the original in place and says so', () => {
    const original = JSON.stringify({ version: 1, data: { a: 1 } });
    storage.map.set('budget-planner:planner', original);
    const broken = {
      version: 2,
      migrations: {
        1: () => {
          throw new Error('boom');
        },
      },
    };
    expect(load('planner', broken)).toMatchObject({ status: 'failed', data: null });
    expect(storage.map.get('budget-planner:planner')).toBe(original);
  });

  it('never overwrites a value written by a newer version, and reports it', () => {
    storage.map.set('budget-planner:planner', JSON.stringify({ version: 9, data: 'future' }));
    expect(save('planner', 1, { a: 1 })).toBe(false);
    expect(JSON.parse(storage.map.get('budget-planner:planner')).data).toBe('future');
    expect(problems).toEqual([{ kind: 'newer', name: 'planner' }]);
  });
});

describe('unavailable or full storage (STOR-1)', () => {
  it('load says unavailable when the browser refuses access', () => {
    vi.stubGlobal('localStorage', fakeStorage({ getItem: denied }));
    expect(load('planner')).toEqual({ status: 'unavailable', data: null });
  });

  it('save reports a full storage', () => {
    vi.stubGlobal('localStorage', fakeStorage({ setItem: quota }));
    expect(save('planner', 1, {})).toBe(false);
    expect(problems).toEqual([{ kind: 'full', name: 'planner' }]);
  });

  it('save reports storage that is not available', () => {
    vi.stubGlobal('localStorage', fakeStorage({ setItem: denied, getItem: denied }));
    expect(saveEnvelope('planner', { version: 1, data: {} })).toBe(false);
    expect(problems).toEqual([{ kind: 'unavailable', name: 'planner' }]);
  });

  it('a listener that is removed hears nothing more', () => {
    stop();
    vi.stubGlobal('localStorage', fakeStorage({ setItem: quota }));
    save('planner', 1, {});
    expect(problems).toEqual([]);
  });
});

describe('remove', () => {
  it('removes one key and nothing else', () => {
    save('planner', 1, {});
    save('config', 1, {});
    expect(remove('planner')).toBe(true);
    expect(storedKeys()).toEqual(['config']);
  });

  it('returns false when the browser refuses', () => {
    const refusing = fakeStorage({ removeItem: denied });
    vi.stubGlobal('localStorage', refusing);
    expect(remove('planner')).toBe(false);
  });
});

describe('clear all data (STOR-3)', () => {
  it('lists and removes only the app keys, backups included', () => {
    storage.map.set('budget-planner:planner', '1');
    storage.map.set('budget-planner:backup:config', '2');
    storage.map.set('other-app:thing', '3');
    expect(storedKeys().sort()).toEqual(['backup:config', 'planner']);
    expect(clearAll()).toBe(2);
    expect([...storage.map.keys()]).toEqual(['other-app:thing']);
  });

  it('returns false when the browser refuses', () => {
    const refusing = fakeStorage({ removeItem: denied });
    refusing.map.set('budget-planner:planner', '1');
    vi.stubGlobal('localStorage', refusing);
    expect(clearAll()).toBe(false);
  });
});
