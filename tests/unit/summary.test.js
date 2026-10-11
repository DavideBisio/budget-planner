import { describe, expect, it } from 'vitest';
import { summarizeImport } from '../../src/core/summary.js';

const tx = (file, date, amount, n = 1) => ({
  id: `${date}|${amount}|x#${n}`,
  date,
  amount,
  desc: 'x',
  file,
});
const statement = (file, transactions, opening = null, closing = null) => ({
  file,
  transactions,
  opening,
  closing,
  warnings: [],
  errors: [],
});

describe('summarizeImport (IMP-4)', () => {
  it('counts transactions, months, income and outcome across files', () => {
    const jan = statement(
      'jan',
      [tx('jan', '2026-01-02', 150000), tx('jan', '2026-01-09', -1990)],
      100000,
      248010,
    );
    const feb = statement('feb', [tx('feb', '2026-02-03', -42000)], 248010, 206010);
    const s = summarizeImport([jan, feb]);
    expect(s).toMatchObject({
      transactions: 3,
      months: 2,
      from: '2026-01-02',
      to: '2026-02-03',
      income: 150000,
      outcome: 43990,
      reconciles: 'yes',
    });
    expect(s.files.map(f => [f.file, f.transactions, f.income, f.outcome, f.status])).toEqual([
      ['jan', 2, 150000, 1990, 'ok'],
      ['feb', 1, 0, 42000, 'ok'],
    ]);
  });

  it('counts months in the span, including months without transactions', () => {
    const s = summarizeImport([
      statement('a', [tx('a', '2026-01-15', 100), tx('a', '2026-04-02', -100)]),
    ]);
    expect(s.months).toBe(4);
  });

  it('says the balance does not reconcile when a file does not add up', () => {
    const s = summarizeImport([statement('a', [tx('a', '2026-01-02', 1000)], 0, 5000)]);
    expect(s.reconciles).toBe('no');
    expect(s.files[0]).toMatchObject({ status: 'mismatch', difference: 4000 });
  });

  it('says the balance does not reconcile when files leave a gap', () => {
    const a = statement('a', [tx('a', '2026-01-02', 1000)], 0, 1000);
    const b = statement('b', [tx('b', '2026-03-02', 1000)], 5000, 6000);
    const s = summarizeImport([a, b]);
    expect(s.reconciles).toBe('no');
    expect(s.links[0].status).toBe('gap');
  });

  it('reports unknown when no file has both balances', () => {
    const s = summarizeImport([statement('a', [tx('a', '2026-01-02', 1000)])]);
    expect(s.reconciles).toBe('unknown');
  });

  it('handles no files and files without transactions', () => {
    expect(summarizeImport([])).toMatchObject({
      transactions: 0,
      months: 0,
      from: '',
      to: '',
      income: 0,
      outcome: 0,
      reconciles: 'unknown',
    });
    expect(summarizeImport([statement('a', [])]).months).toBe(0);
  });
});
