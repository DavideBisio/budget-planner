/**
 * The result of the import pipeline after classification (IMP-10, IMP-11): manual overrides are
 * applied, ignored transactions are set aside, and the rest is split into recurring and one-time
 * entries and turned into planner cards.
 */
import { buildCards } from './cards.js';
import { applyOverrides } from './overrides.js';
import { detectRecurring } from './recurring.js';

/**
 * @param {object[]} classified transactions with payee, category, kind and rule
 * @param {object} overrides see `emptyOverrides`
 * @returns {{resolved: object[], ignored: object[], months: string[], recurring: object[],
 *   oneTime: object[], cards: object}} `resolved` has every transaction with its final category,
 *   kind, `ignored` flag and `override` level.
 */
export function buildResult(classified, overrides) {
  const resolved = applyOverrides(classified, overrides);
  const ignored = resolved.filter(tx => tx.ignored);
  const detected = detectRecurring(resolved.filter(tx => !tx.ignored));
  return { resolved, ignored, ...detected, cards: buildCards(detected) };
}
