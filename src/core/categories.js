/**
 * Editing the category list (IMP-9). Every change returns `{config, error}`: a new configuration
 * with rules kept consistent, or the unchanged configuration and a message for the user.
 */
import { OTHER_EXPENSES, OTHER_INCOME } from './match.js';

const PROTECTED = [OTHER_INCOME, OTHER_EXPENSES];
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

/** These two are what unmatched transactions become, so they cannot be renamed or deleted. */
export const isProtectedCategory = name => PROTECTED.includes(name);

/** How many rules use the category. */
export const categoryUsage = (config, name) => config.rules.filter(r => r.cat === name).length;

const fail = (config, error) => ({ config, error });
const locked = name =>
  `"${name}" is used for transactions that no rule matches and cannot be changed.`;

/** Add a category. */
export function addCategory(config, name) {
  const clean = name.trim();
  if (!clean) return fail(config, 'Enter a name for the category.');
  if (config.cats.some(c => same(c, clean))) return fail(config, `"${clean}" already exists.`);
  return { config: { ...structuredClone(config), cats: [...config.cats, clean] }, error: null };
}

/** Rename a category; rules that use it follow. */
export function renameCategory(config, from, to) {
  const clean = to.trim();
  if (!config.cats.includes(from)) return fail(config, `Category "${from}" was not found.`);
  if (isProtectedCategory(from)) return fail(config, locked(from));
  if (!clean) return fail(config, 'Enter a name for the category.');
  if (clean === from) return { config, error: null };
  if (config.cats.some(c => c !== from && same(c, clean))) {
    return fail(config, `"${clean}" already exists.`);
  }
  const next = structuredClone(config);
  next.cats = next.cats.map(c => (c === from ? clean : c));
  for (const rule of next.rules) if (rule.cat === from) rule.cat = clean;
  return { config: next, error: null };
}

/**
 * Delete a category. While rules use it, `moveTo` (another existing category) is required and the
 * rules move there.
 */
export function deleteCategory(config, name, moveTo = null) {
  if (!config.cats.includes(name)) return fail(config, `Category "${name}" was not found.`);
  if (isProtectedCategory(name)) return fail(config, locked(name));
  const used = categoryUsage(config, name);
  if (used > 0) {
    const plural = used === 1 ? 'rule' : 'rules';
    if (moveTo === null) {
      return fail(
        config,
        `"${name}" is used by ${used} ${plural}. Choose another category to move them to.`,
      );
    }
    if (moveTo === name || !config.cats.includes(moveTo)) {
      return fail(config, 'Choose another category to move the rules to.');
    }
  }
  const next = structuredClone(config);
  next.cats = next.cats.filter(c => c !== name);
  for (const rule of next.rules) if (rule.cat === name) rule.cat = moveTo;
  return { config: next, error: null };
}
