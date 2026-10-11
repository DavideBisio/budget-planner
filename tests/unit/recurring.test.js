import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/core/config.js';
import { classifyTransactions } from '../../src/core/match.js';
import { parseStatement } from '../../src/core/parser.js';
import { assignPayees } from '../../src/core/payee.js';
import { detectRecurring, monthsBetween } from '../../src/core/recurring.js';

let n = 0;
const tx = (date, payeeKey, amount, extra = {}) => ({
  id: `t${++n}`,
  date,
  payee: payeeKey,
  payeeKey,
  amount,
  category: 'Cat',
  kind: amount > 0 ? 'income' : 'expense',
  ...extra,
});

describe('monthsBetween (ENG-7)', () => {
  it('lists every month of the span, inclusive', () => {
    expect(monthsBetween('2026-11-20', '2027-02-01')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(monthsBetween('2026-01-05', '2026-01-30')).toEqual(['2026-01']);
  });
});

describe('detectRecurring (ENG-7)', () => {
  it('treats the same amount in every month as recurring', () => {
    const rent = ['2026-01-03', '2026-02-03', '2026-03-03'].map(d => tx(d, 'LANDLORD', -80000));
    const r = detectRecurring(rent);
    expect(r.oneTime).toEqual([]);
    expect(r.recurring).toHaveLength(1);
    expect(r.recurring[0]).toMatchObject({
      payeeKey: 'LANDLORD',
      amount: -80000,
      perMonth: 1,
      monthly: -80000,
      direction: 'out',
      category: 'Cat',
      kind: 'expense',
    });
    expect(r.recurring[0].transactions).toEqual(rent);
    expect(r.months).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('keeps a varying salary as one-time entries in their real months', () => {
    const pay = [
      tx('2026-01-02', 'ACME', 250000),
      tx('2026-02-02', 'ACME', 250000),
      tx('2026-03-02', 'ACME', 265000),
    ];
    const r = detectRecurring(pay);
    expect(r.recurring).toEqual([]);
    expect(r.oneTime).toEqual(pay);
  });

  it('does not average or use a tolerance: one cent apart is not the same amount', () => {
    const r = detectRecurring([tx('2026-01-05', 'POWER', -5000), tx('2026-02-05', 'POWER', -5001)]);
    expect(r.recurring).toEqual([]);
    expect(r.oneTime).toHaveLength(2);
  });

  it('breaks recurrence when a month of the span is missing', () => {
    const rows = [
      tx('2026-01-10', 'GYM', -3000),
      tx('2026-03-10', 'GYM', -3000),
      tx('2026-02-15', 'OTHER', -100),
    ];
    const r = detectRecurring(rows);
    expect(r.recurring).toEqual([]);
    expect(r.oneTime).toHaveLength(3);
  });

  it('sums two equal payments per month into one recurring amount', () => {
    const rows = [
      tx('2026-01-05', 'COFFEE', -350),
      tx('2026-01-20', 'COFFEE', -350),
      tx('2026-02-05', 'COFFEE', -350),
      tx('2026-02-25', 'COFFEE', -350),
    ];
    const r = detectRecurring(rows);
    expect(r.recurring).toHaveLength(1);
    expect(r.recurring[0]).toMatchObject({ amount: -350, perMonth: 2, monthly: -700 });
    expect(r.recurring[0].transactions).toHaveLength(4);
  });

  it('needs the same count in every month', () => {
    const rows = [
      tx('2026-01-05', 'COFFEE', -350),
      tx('2026-01-20', 'COFFEE', -350),
      tx('2026-02-05', 'COFFEE', -350),
    ];
    expect(detectRecurring(rows).recurring).toEqual([]);
  });

  it('never calls anything recurring when the data spans a single month', () => {
    const rows = [tx('2026-01-05', 'RENT', -80000), tx('2026-01-25', 'FOOD', -2000)];
    const r = detectRecurring(rows);
    expect(r.recurring).toEqual([]);
    expect(r.oneTime).toEqual(rows);
  });

  it('groups by direction, counterparty and exact amount', () => {
    const rows = [
      tx('2026-01-05', 'SHOP', -1000),
      tx('2026-02-05', 'SHOP', -1000),
      tx('2026-01-06', 'SHOP', 1000),
      tx('2026-02-06', 'SHOP', 1000),
      tx('2026-01-07', 'OTHER', -1000),
      tx('2026-02-07', 'OTHER', -1000),
    ];
    const r = detectRecurring(rows);
    expect(r.recurring.map(e => [e.payeeKey, e.direction])).toEqual([
      ['SHOP', 'out'],
      ['SHOP', 'in'],
      ['OTHER', 'out'],
    ]);
  });

  it('uses the span of all the data, so one far transaction can break a group', () => {
    const rows = [
      tx('2026-01-05', 'RENT', -80000),
      tx('2026-02-05', 'RENT', -80000),
      tx('2026-04-20', 'ONE', -100),
    ];
    expect(detectRecurring(rows).recurring).toEqual([]);
  });

  it('handles no transactions', () => {
    expect(detectRecurring([])).toEqual({ months: [], recurring: [], oneTime: [] });
  });

  it('classifies the sample statement', () => {
    const text = readFileSync(
      new URL('../../data/sample-bank-report.csv', import.meta.url),
      'utf8',
    );
    const config = defaultConfig();
    const { transactions } = parseStatement(text, config.parse, 's');
    const rows = classifyTransactions(assignPayees(transactions, config.payees), config.rules);
    const r = detectRecurring(rows);
    expect(r.months).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(r.recurring.map(e => [e.payee, e.monthly]).sort()).toEqual([
      ['Example Broker', -20000],
      ['Landlord Rossi', -80000],
      ['StreamCo', -1299],
    ]);
    // salary varies in March, the market amounts differ, the utility bill and own transfer occur once
    expect(r.oneTime).toHaveLength(16 - 9);
  });
});
