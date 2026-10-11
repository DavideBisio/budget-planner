/**
 * Filtering (ENG-4): date range, exclusion patterns and own-account transfers.
 * Returns what is kept and, for everything removed, why. Patterns are case-insensitive and
 * invalid ones are ignored here (the configuration validation reports them).
 */
import { compilePattern } from './config.js';

const EXAMPLES = 3;

const firstMatch = (patterns, text) =>
  patterns.find(pattern => compilePattern(pattern)?.test(text));

/**
 * @returns {{kept: object[], removed: {tx: object, reason: string, pattern?: string}[],
 *   counts: {range: number, exclude: number, own: number, total: number},
 *   examples: {range: object[], exclude: object[], own: object[]}}}
 */
export function filterTransactions(transactions, filter) {
  const kept = [];
  const removed = [];
  const counts = { range: 0, exclude: 0, own: 0, total: 0 };
  const examples = { range: [], exclude: [], own: [] };

  const remove = (tx, reason, pattern) => {
    removed.push(pattern === undefined ? { tx, reason } : { tx, reason, pattern });
    counts[reason]++;
    counts.total++;
    if (examples[reason].length < EXAMPLES) examples[reason].push(tx);
  };

  for (const tx of transactions) {
    if ((filter.from && tx.date < filter.from) || (filter.to && tx.date > filter.to)) {
      remove(tx, 'range');
      continue;
    }
    const excluded = firstMatch(filter.exclude ?? [], tx.desc);
    if (excluded !== undefined) {
      remove(tx, 'exclude', excluded);
      continue;
    }
    const own = filter.ownTransfers ? firstMatch(filter.own ?? [], tx.desc) : undefined;
    if (own !== undefined) {
      remove(tx, 'own', own);
      continue;
    }
    kept.push(tx);
  }
  return { kept, removed, counts, examples };
}
