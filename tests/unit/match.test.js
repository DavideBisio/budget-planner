import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/core/config.js';
import { parseStatement } from '../../src/core/parser.js';
import { classify, classifyTransactions } from '../../src/core/match.js';

const rules = defaultConfig().rules;
const tx = (desc, amount = -1000) => ({
  id: `${desc}#1`,
  desc,
  amount,
  raw: { Description: desc },
});

describe('classify (ENG-6)', () => {
  it('assigns the category and kind of the first matching rule', () => {
    const r = classify(tx('Payroll ACME Corp', 250000), rules);
    expect(r).toMatchObject({
      category: 'Salary',
      kind: 'income',
      rule: { index: 0, pattern: 'payroll|acme' },
    });
  });

  it('matches case-insensitively', () => {
    expect(classify(tx('PAID TO CORNER MARKET'), rules).category).toBe('Food & dining');
  });

  it('lets the earlier rule win when rules overlap', () => {
    const overlapping = [
      { p: 'market', cat: 'Food & dining', kind: '' },
      { p: 'corner', cat: 'Utilities', kind: '' },
    ];
    expect(classify(tx('Corner Market'), overlapping).category).toBe('Food & dining');
    expect(classify(tx('Corner Market'), [...overlapping].reverse()).category).toBe('Utilities');
  });

  it('records the index of the rule that matched, not of the first rule', () => {
    expect(classify(tx('Example Broker invest'), rules).rule).toEqual({
      index: 2,
      pattern: 'broker|invest',
    });
  });

  it('keeps a saving kind from the rule', () => {
    expect(classify(tx('Example Broker invest'), rules).kind).toBe('saving');
  });

  it('derives an empty kind from the direction of the money', () => {
    expect(classify(tx('Landlord rent', -80000), rules).kind).toBe('expense');
    expect(classify(tx('Landlord rent refund', 5000), rules).kind).toBe('income');
  });

  it('falls back to Other income or Other expenses and records no rule', () => {
    expect(classify(tx('Something odd', 1500), rules)).toMatchObject({
      category: 'Other income',
      kind: 'income',
      rule: null,
    });
    expect(classify(tx('Something odd', -1500), rules)).toMatchObject({
      category: 'Other expenses',
      kind: 'expense',
      rule: null,
    });
  });

  it('skips an invalid rule pattern without losing the rule indexes', () => {
    const list = [
      { p: '(', cat: 'Salary', kind: '' },
      { p: 'x', cat: 'Housing', kind: '' },
    ];
    expect(classify(tx('x'), list).rule.index).toBe(1);
  });
});

describe('classifyTransactions (ENG-6)', () => {
  it('returns copies that keep the raw input row', () => {
    const input = [tx('Paid to Corner Market')];
    const [out] = classifyTransactions(input, rules);
    expect(out.raw).toEqual({ Description: 'Paid to Corner Market' });
    expect(out.category).toBe('Food & dining');
    expect(input[0]).not.toHaveProperty('category');
  });

  it('classifies the sample statement', () => {
    const text = readFileSync(
      new URL('../../data/sample-bank-report.csv', import.meta.url),
      'utf8',
    );
    const { transactions } = parseStatement(text, defaultConfig().parse, 's');
    const byCategory = {};
    for (const t of classifyTransactions(transactions, rules)) {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    }
    expect(byCategory).toEqual({
      Salary: 3,
      Housing: 3,
      Utilities: 4,
      Investments: 3,
      'Food & dining': 2,
      'Other expenses': 1,
    });
  });
});
