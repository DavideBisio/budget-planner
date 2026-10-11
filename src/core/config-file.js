/**
 * The configuration file (IMP-13): export and import of the rules and settings. The file holds
 * the configuration sections only, never transactions or imported files.
 */
import { migrateConfig, validateConfig } from './config.js';

const SECTIONS = ['version', 'parse', 'filter', 'payees', 'rules', 'cats'];

const onlySections = config => Object.fromEntries(SECTIONS.map(key => [key, config[key]]));

/** The configuration as JSON text, sections only. */
export function exportConfig(config) {
  return `${JSON.stringify(onlySections(config), null, 2)}\n`;
}

/**
 * Read a configuration file. Returns `{config, errors}`: the configuration (older versions are
 * upgraded) and no errors, or `config: null` and the problems as `{path, message}`.
 */
export function importConfig(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { config: null, errors: [{ path: '', message: 'The file is not valid JSON.' }] };
  }
  const migrated = migrateConfig(parsed);
  const errors = validateConfig(migrated);
  return errors.length ? { config: null, errors } : { config: onlySections(migrated), errors: [] };
}
