/**
 * Balance reconciliation (ENG-3): does opening + movements = closing for each file, and do
 * consecutive files chain? All amounts are integer cents; the tolerance is 0.01 (one cent).
 */

const TOLERANCE = 1;

const sum = transactions => transactions.reduce((total, t) => total + t.amount, 0);
const dates = statement => statement.transactions.map(t => t.date).sort();

/** Check one parsed statement: `status` is `ok`, `mismatch` or `unknown` (a balance is missing). */
export function reconcileFile(statement) {
  const { file, opening, closing } = statement;
  const movements = sum(statement.transactions);
  if (opening === null || closing === null) {
    return {
      file,
      opening,
      closing,
      movements,
      expected: null,
      difference: null,
      status: 'unknown',
    };
  }
  const expected = opening + movements;
  const difference = closing - expected;
  const status = Math.abs(difference) <= TOLERANCE ? 'ok' : 'mismatch';
  return { file, opening, closing, movements, expected, difference, status };
}

function link(prev, next) {
  const prevLast = dates(prev).at(-1);
  const nextFirst = dates(next)[0];
  const overlapping = Boolean(prevLast && nextFirst && nextFirst <= prevLast);
  const known = prev.closing !== null && next.opening !== null;
  const difference = known ? next.opening - prev.closing : null;
  const base = { from: prev.file, to: next.file, difference };

  if (known && Math.abs(difference) <= TOLERANCE) return { ...base, status: 'ok' };
  if (overlapping) {
    const ids = new Set(prev.transactions.map(t => t.id));
    const duplicates = next.transactions.filter(t => ids.has(t.id)).length;
    return { ...base, status: 'overlap', duplicates };
  }
  return { ...base, status: known ? 'gap' : 'unknown' };
}

/**
 * Check a set of parsed statements: each file, and the link between each file and the next one
 * in date order. `problems` counts mismatches, gaps and overlaps; `unknown` is not a problem.
 */
export function checkChain(statements) {
  const ordered = [...statements].sort((a, b) => {
    const first = s => dates(s)[0] ?? '￿';
    return first(a) < first(b) ? -1 : first(a) > first(b) ? 1 : 0;
  });
  const files = ordered.map(reconcileFile);
  const links = ordered.slice(1).map((next, i) => link(ordered[i], next));
  const bad = status => status === 'mismatch' || status === 'gap' || status === 'overlap';
  const problems =
    files.filter(f => bad(f.status)).length + links.filter(l => bad(l.status)).length;
  return { files, links, ok: problems === 0, problems };
}
