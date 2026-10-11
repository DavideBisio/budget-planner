/**
 * The schema of every value the app stores (STOR-1, STOR-2): the current version and the
 * migrations from version n to n + 1. A migration is a pure function from the old data to the new
 * data. When a version is raised, add its migration here: a test fails if one is missing.
 * Keys are described in docs/ARCHITECTURE.md.
 */
import { HANDOFF_VERSION } from './handoff.js';
import { PLANNER_VERSION } from './planner.js';

export const SCHEMAS = {
  config: { version: 1, migrations: {} },
  overrides: { version: 1, migrations: {} },
  files: { version: 1, migrations: {} },
  planner: { version: PLANNER_VERSION, migrations: {} },
  handoff: { version: HANDOFF_VERSION, migrations: {} },
};

/** The options `unwrap` needs for a stored key. */
export function schemaFor(name) {
  const schema = SCHEMAS[name];
  if (!schema) throw new RangeError(`Unknown storage key "${name}"`);
  return schema;
}
