import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCards } from '../../src/core/cards.js';
import { defaultConfig } from '../../src/core/config.js';
import { classifyTransactions } from '../../src/core/match.js';
import { parseStatement } from '../../src/core/parser.js';
import { assignPayees } from '../../src/core/payee.js';
import { detectRecurring } from '../../src/core/recurring.js';

let n = 0;
const tx = (date, payeeKey, amount, category, kind) => ({
  id: `t${++n}`,
  date,
  payee: payeeKey,
  payeeKey,
  amount,
  category,
  kind,
});
const cards = rows => buildCards(detectRecurring(rows));

describe('buildCards (ENG-9)', () => {
  it('builds a one-time card in its real month', () => {
    const { oneTime, recurring } = cards([
      tx('2026-03-18', 'POWER', -12000, 'Utilities', 'expense'),
    ]);
    expect(recurring).toEqual([]);
    expect(oneTime).toHaveLength(1);
    expect(oneTime[0]).toMatchObject({
      type: 'one-time',
      month: '2026-03',
      date: '2026-03-18',
      category: 'Utilities',
      kind: 'expense',
      flow: -12000,
      amount: 12000,
    });
  });

  it('builds a recurring card with the monthly amount', () => {
    const rows = ['2026-01-05', '2026-02-05'].flatMap(d => [
      tx(d, 'COFFEE', -350, 'Food & dining', 'expense'),
      tx(d, 'COFFEE', -350, 'Food & dining', 'expense'),
    ]);
    const { recurring, oneTime } = cards(rows);
    expect(oneTime).toEqual([]);
    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toMatchObject({
      type: 'recurring',
      month: null,
      category: 'Food & dining',
      flow: -700,
      amount: 700,
      perMonth: 2,
    });
  });

  it('records which transactions a card came from', () => {
    const rows = [
      tx('2026-01-05', 'GYM', -3000, 'Other expenses', 'expense'),
      tx('2026-02-05', 'GYM', -3000, 'Other expenses', 'expense'),
    ];
    expect(cards(rows).recurring[0].transactionIds).toEqual(rows.map(r => r.id));
  });

  it('signs savings: money out is positive, money in is a negative saving', () => {
    const { oneTime } = cards([
      tx('2026-01-10', 'BROKER', -20000, 'Investments', 'saving'),
      tx('2026-02-12', 'BROKER', 5000, 'Investments', 'saving'),
    ]);
    expect(oneTime.map(c => c.amount)).toEqual([20000, -5000]);
    expect(oneTime.map(c => c.flow)).toEqual([-20000, 5000]);
  });

  it('totals by kind and by category, a withdrawal reducing the savings', () => {
    const rows = [
      tx('2026-01-02', 'ACME', 250000, 'Salary', 'income'),
      tx('2026-01-10', 'BROKER', -20000, 'Investments', 'saving'),
      tx('2026-01-20', 'BROKER', -30000, 'Investments', 'saving'),
      tx('2026-02-12', 'BROKER', 5000, 'Investments', 'saving'),
      tx('2026-02-15', 'MARKET', -4000, 'Food & dining', 'expense'),
    ];
    const { totals } = cards(rows);
    expect(totals.byKind).toEqual({ income: 250000, expense: 4000, saving: 45000 });
    expect(totals.net).toBe(250000 - 4000 - 45000);
    expect(totals.byCategory).toEqual([
      { category: 'Salary', kind: 'income', amount: 250000 },
      { category: 'Investments', kind: 'saving', amount: 45000 },
      { category: 'Food & dining', kind: 'expense', amount: 4000 },
    ]);
  });

  it('counts a recurring card once per month of the span in the totals', () => {
    const rows = ['2026-01-05', '2026-02-05', '2026-03-05'].map(d =>
      tx(d, 'RENT', -80000, 'Housing', 'expense'),
    );
    const { totals } = cards(rows);
    expect(totals.byKind.expense).toBe(240000);
    expect(totals.net).toBe(-240000);
  });

  it('handles no transactions', () => {
    expect(cards([])).toEqual({
      recurring: [],
      oneTime: [],
      totals: { byKind: { income: 0, expense: 0, saving: 0 }, byCategory: [], net: 0 },
    });
  });

  it('builds the cards of the sample statement; totals match the statement movements', () => {
    const text = readFileSync(
      new URL('../../data/sample-bank-report.csv', import.meta.url),
      'utf8',
    );
    const config = defaultConfig();
    const { transactions } = parseStatement(text, config.parse, 's');
    const rows = classifyTransactions(assignPayees(transactions, config.payees), config.rules);
    const result = cards(rows);
    expect(result.recurring).toHaveLength(3);
    expect(result.oneTime).toHaveLength(7);
    expect(result.totals.byKind).toEqual({ income: 765000, expense: 297047, saving: 60000 });
    const movements = transactions.reduce((sum, t) => sum + t.amount, 0);
    expect(result.totals.net).toBe(movements);
  });
});
