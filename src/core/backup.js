/**
 * The whole-app backup (STOR-4): one JSON document with the planner state and the configuration,
 * and the raw bank files only when asked. Restoring checks the whole document first and returns
 * the sections to write; nothing is written until every section is valid. Pure functions.
 */
import { migrateConfig, validateConfig } from './config.js';
import { unwrap, wrap } from './envelope.js';
import { isOverrides } from './overrides.js';
import { validatePlanner } from './planner.js';
import { SCHEMAS } from './schemas.js';

export const BACKUP_VERSION = 1;
const APP = 'budget-planner';

/**
 * @param {{config?: object, overrides?: object, planner?: object, files?: object[]}} sections
 *   whatever the app has stored; missing sections are left out
 * @param {{includeFiles?: boolean}} options the raw bank files are included only on request
 */
export function buildBackup(sections, { includeFiles = false } = {}) {
  const names = ['config', 'overrides', 'planner', ...(includeFiles ? ['files'] : [])];
  const data = {};
  const versions = {};
  for (const name of names) {
    if (sections[name] === undefined) continue;
    data[name] = sections[name];
    versions[name] = SCHEMAS[name].version;
  }
  return { app: APP, version: BACKUP_VERSION, versions, data };
}

const validFiles = files =>
  Array.isArray(files) &&
  files.every(file => file && typeof file.name === 'string' && typeof file.text === 'string');

/** Section checks: return the usable data and the problems, with paths starting at the section. */
const CHECKS = {
  config(data) {
    const config = migrateConfig(data);
    const problems = validateConfig(config).map(p => ({ ...p, path: `config.${p.path}` }));
    return { data: config, problems };
  },
  overrides: data => ({
    data,
    problems: isOverrides(data)
      ? []
      : [{ path: 'overrides', message: 'The manual changes are not in the expected shape' }],
  }),
  planner: data => ({
    data,
    problems: validatePlanner(data).map(p => ({
      ...p,
      path: p.path ? `planner.${p.path}` : 'planner',
    })),
  }),
  files: data => ({
    data,
    problems: validFiles(data)
      ? []
      : [{ path: 'files', message: 'The imported files must be a list of names and texts' }],
  }),
};

/**
 * @param {string} text the contents of a backup file
 * @param {object} schemas the current schema of each section (a test can pass its own)
 * @returns {{problems: {path: string, message: string}[],
 *   sections: {name: string, version: number, data: any}[]}} `sections` is empty when there are
 *   problems: a backup is restored whole or not at all
 */
export function parseBackup(text, schemas = SCHEMAS) {
  const refuse = (path, message) => ({ problems: [{ path, message }], sections: [] });
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    return refuse('', 'This is not a valid backup file: it is not JSON');
  }
  if (backup?.app !== APP || !backup.data || typeof backup.data !== 'object') {
    return refuse('app', 'This is not a Budget Planner backup file');
  }
  if (backup.version > BACKUP_VERSION) {
    return refuse('version', 'This backup was made by a newer version of the app');
  }
  if (backup.version !== BACKUP_VERSION)
    return refuse('version', 'The backup version is not recognised');

  const found = Object.keys(CHECKS).filter(name => name in backup.data);
  if (found.length === 0) return refuse('data', 'There is nothing to restore in this file');

  const problems = [];
  const sections = [];
  for (const name of found) {
    const schema = schemas[name] ?? SCHEMAS[name];
    const read = unwrap(wrap(backup.versions?.[name] ?? 1, backup.data[name]), schema);
    if (read.status === 'newer') {
      problems.push({
        path: name,
        message: `The ${name} section comes from a newer version of the app`,
      });
      continue;
    }
    if (read.status !== 'ok' && read.status !== 'migrated') {
      problems.push({
        path: name,
        message: `The ${name} section could not be upgraded: ${read.error ?? read.status}`,
      });
      continue;
    }
    const checked = CHECKS[name](read.data);
    problems.push(...checked.problems);
    sections.push({ name, version: schema.version, data: checked.data });
  }
  return problems.length > 0 ? { problems, sections: [] } : { problems, sections };
}
