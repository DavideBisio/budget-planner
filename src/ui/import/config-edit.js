import { validateConfig } from '../../core/config.js';

/** Set one value of the configuration by path, for example ['parse', 'cols', 'date']. */
export function updateConfig(store, path, value) {
  const config = structuredClone(store.get().config);
  let target = config;
  for (const key of path.slice(0, -1)) target = target[key];
  target[path.at(-1)] = value;
  store.set({ config });
}

/** Validation errors whose path is inside `section` (for example 'parse'). */
export function errorsIn(config, section) {
  return validateConfig(config).filter(e => e.path === section || e.path.startsWith(`${section}.`));
}
