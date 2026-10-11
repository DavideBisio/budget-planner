/**
 * Manual overrides (ENG-8). Precedence, field by field: transaction override, then payee
 * override, then the rule result. Overrides are keyed by transaction id and payee key, which do
 * not depend on the parse settings, so they survive re-parsing.
 *
 * Shape: `{transactions: {[id]: patch}, payees: {[payeeKey]: patch}}` where a patch holds any of
 * `category`, `kind` and `ignore`.
 */

const FIELDS = ['category', 'kind', 'ignore'];

export const emptyOverrides = () => ({ transactions: {}, payees: {} });

/**
 * Copies of the transactions with `category`, `kind`, `ignored` and `override` (the strongest
 * level that changed something: `transaction`, `payee` or `null`) resolved.
 */
export function applyOverrides(transactions, overrides) {
  return transactions.map(tx => {
    const levels = [
      ['transaction', overrides.transactions?.[tx.id]],
      ['payee', overrides.payees?.[tx.payeeKey]],
    ];
    const out = { ...tx, ignored: false, override: null };
    for (const [, patch] of [...levels].reverse()) {
      if (!patch) continue;
      for (const field of FIELDS) {
        if (patch[field] === undefined) continue;
        if (field === 'ignore') out.ignored = patch.ignore;
        else out[field] = patch[field];
      }
    }
    out.override =
      levels.find(([, patch]) => patch && FIELDS.some(f => patch[f] !== undefined))?.[0] ?? null;
    return out;
  });
}

/**
 * A new overrides object with `patch` merged into the entry of `key` in `scope`
 * (`transactions` or `payees`). A field set to `undefined` is removed; an empty entry is dropped.
 */
export function withOverride(overrides, scope, key, patch) {
  const entry = { ...overrides[scope][key], ...patch };
  for (const field of Object.keys(entry)) if (entry[field] === undefined) delete entry[field];
  const entries = { ...overrides[scope] };
  if (Object.keys(entry).length) entries[key] = entry;
  else delete entries[key];
  return { ...overrides, [scope]: entries };
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Whether a value read from storage or a backup has the shape of the manual changes. */
export const isOverrides = value =>
  isObject(value) && isObject(value.transactions) && isObject(value.payees);
