/**
 * Matching rules (ENG-6): ordered rules, first match wins, case-insensitive, tested against the
 * description. Assigns a category and a kind and records which rule matched.
 */
import { compilePattern } from './config.js';

/** Categories for transactions that no rule matches. */
export const OTHER_INCOME = 'Other income';
export const OTHER_EXPENSES = 'Other expenses';

const directionKind = amount => (amount > 0 ? 'income' : 'expense');

/**
 * Category, kind and matching rule of one transaction.
 * An empty rule kind takes the direction of the money (`income` in, `expense` out); an unmatched
 * transaction becomes Other income or Other expenses.
 * @returns {{category: string, kind: string, rule: {index: number, pattern: string} | null}}
 */
export function classify(tx, rules) {
  for (const [index, rule] of rules.entries()) {
    if (!compilePattern(rule.p)?.test(tx.desc)) continue;
    return {
      category: rule.cat,
      kind: rule.kind || directionKind(tx.amount),
      rule: { index, pattern: rule.p },
    };
  }
  return {
    category: tx.amount > 0 ? OTHER_INCOME : OTHER_EXPENSES,
    kind: directionKind(tx.amount),
    rule: null,
  };
}

/** Copies of the transactions with `category`, `kind` and `rule` added; `raw` is kept. */
export function classifyTransactions(transactions, rules) {
  return transactions.map(tx => ({ ...tx, ...classify(tx, rules) }));
}
