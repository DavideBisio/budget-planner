import { describe, expect, it } from 'vitest';
import { HANDOFF_VERSION } from '../../src/core/handoff.js';
import { PLANNER_VERSION } from '../../src/core/planner.js';
import { SCHEMAS, schemaFor } from '../../src/core/schemas.js';

describe('storage schemas (STOR-1, STOR-2)', () => {
  it('lists every key the app stores', () => {
    expect(Object.keys(SCHEMAS).sort()).toEqual([
      'config',
      'files',
      'handoff',
      'overrides',
      'planner',
    ]);
  });

  it('takes the current versions from the modules that own the data', () => {
    expect(SCHEMAS.planner.version).toBe(PLANNER_VERSION);
    expect(SCHEMAS.handoff.version).toBe(HANDOFF_VERSION);
  });

  it('has a migration for every step below the current version, so no value is stranded', () => {
    for (const [name, { version, migrations }] of Object.entries(SCHEMAS)) {
      for (let from = 1; from < version; from += 1) {
        expect(migrations[from], `${name}: migration ${from} to ${from + 1}`).toBeTypeOf(
          'function',
        );
      }
    }
  });

  it('gives the options `unwrap` needs, and refuses an unknown key', () => {
    expect(schemaFor('planner')).toEqual({ version: PLANNER_VERSION, migrations: {} });
    expect(() => schemaFor('nope')).toThrow(/unknown storage key/i);
  });
});
