/**
 * Import summary (IMP-4): how much was imported and whether the balances reconcile.
 * Amounts are integer cents; `outcome` is a positive total of money out.
 */
import { checkChain } from './reconcile.js';
import { monthsBetween } from './recurring.js';

const totals = transactions => {
  let income = 0;
  let outcome = 0;
  for (const { amount } of transactions) {
    if (amount > 0) income += amount;
    else outcome -= amount;
  }
  return { income, outcome };
};

/**
 * Summarise parsed statements: overall counts and totals, one line per file with its balance
 * check, the links between files, and `reconciles` (`yes`, `no`, or `unknown` when no file has
 * both balances).
 */
export function summarizeImport(statements) {
  const chain = checkChain(statements);
  const all = statements.flatMap(s => s.transactions);
  const dates = all.map(t => t.date).sort();
  const from = dates[0] ?? '';
  const to = dates.at(-1) ?? '';

  const checks = new Map(chain.files.map(f => [f.file, f]));
  const files = statements.map(s => {
    const { status, difference } = checks.get(s.file);
    return {
      file: s.file,
      transactions: s.transactions.length,
      ...totals(s.transactions),
      status,
      difference,
    };
  });

  let reconciles = 'yes';
  if (!chain.ok) reconciles = 'no';
  else if (chain.files.every(f => f.status === 'unknown')) reconciles = 'unknown';

  return {
    transactions: all.length,
    months: all.length ? monthsBetween(from, to).length : 0,
    from,
    to,
    ...totals(all),
    files,
    links: chain.links,
    reconciles,
  };
}
