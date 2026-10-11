/**
 * Payee extraction (ENG-5): a stable counterparty from a free-text description.
 */
import { compilePattern } from './config.js';

const FALLBACK_WORDS = 3;

/** Grouping key: upper case, accents and punctuation removed, first three words, word order ignored. */
export function payeeKey(name) {
  const words = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  return words.slice(0, FALLBACK_WORDS).sort().join(' ');
}

const result = (name, source) => ({ name, key: payeeKey(name), source });

/**
 * Payee of one transaction: capture group 1 of the first pattern that yields text, else the
 * Type column, else the first words of the description.
 * @returns {{name: string, key: string, source: 'pattern' | 'type' | 'description'}}
 */
export function extractPayee(tx, patterns) {
  for (const pattern of patterns) {
    const captured = compilePattern(pattern)?.exec(tx.desc)?.[1]?.trim();
    if (captured) return result(captured, 'pattern');
  }
  const type = (tx.type ?? '').trim();
  if (type) return result(type, 'type');
  const start = tx.desc.trim().split(/\s+/).filter(Boolean).slice(0, FALLBACK_WORDS).join(' ');
  return result(start, 'description');
}

/** Copies of the transactions with `payee` and `payeeKey` added. */
export function assignPayees(transactions, patterns) {
  return transactions.map(tx => {
    const { name, key } = extractPayee(tx, patterns);
    return { ...tx, payee: name, payeeKey: key };
  });
}
