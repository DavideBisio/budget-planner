import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/core/config.js';
import { classifyTransactions } from '../../src/core/match.js';
import { applyOverrides, emptyOverrides, withOverride } from '../../src/core/overrides.js';
import { parseStatement } from '../../src/core/parser.js';
import { assignPayees } from '../../src/core/payee.js';

const row = (id, payeeKey, category = 'Food & dining', kind = 'expense') => ({
  id,
  payeeKey,
  category,
  kind,
  amount: -1000,
});
const rows = [row('a', 'MARKET'), row('b', 'MARKET'), row('c', 'GYM', 'Other expenses')];

describe('applyOverrides (ENG-8)', () => {
  it('changes nothing without overrides', () => {
    const out = applyOverrides(rows, emptyOverrides());
    expect(out).toEqual(rows.map(r => ({ ...r, ignored: false, override: null })));
  });

  it('applies a payee override to every transaction of that payee', () => {
    const out = applyOverrides(rows, {
      transactions: {},
      payees: { MARKET: { category: 'Housing', kind: 'saving' } },
    });
    expect(out.map(t => [t.category, t.kind, t.override])).toEqual([
      ['Housing', 'saving', 'payee'],
      ['Housing', 'saving', 'payee'],
      ['Other expenses', 'expense', null],
    ]);
  });

  it('applies a transaction override to that transaction only', () => {
    const out = applyOverrides(rows, {
      transactions: { b: { category: 'Utilities' } },
      payees: {},
    });
    expect(out.map(t => [t.category, t.override])).toEqual([
      ['Food & dining', null],
      ['Utilities', 'transaction'],
      ['Other expenses', null],
    ]);
  });

  it('puts the transaction override before the payee override, field by field', () => {
    const out = applyOverrides(rows, {
      transactions: { a: { category: 'Utilities' } },
      payees: { MARKET: { category: 'Housing', kind: 'saving' } },
    });
    expect(out[0]).toMatchObject({
      category: 'Utilities',
      kind: 'saving',
      override: 'transaction',
    });
    expect(out[1]).toMatchObject({ category: 'Housing', kind: 'saving', override: 'payee' });
  });

  it('ignores a transaction or a whole payee, and a transaction can opt back in', () => {
    const out = applyOverrides(rows, {
      transactions: { b: { ignore: false }, c: { ignore: true } },
      payees: { MARKET: { ignore: true } },
    });
    expect(out.map(t => t.ignored)).toEqual([true, false, true]);
  });

  it('does not modify its input', () => {
    const copy = structuredClone(rows);
    applyOverrides(rows, { transactions: { a: { category: 'X' } }, payees: {} });
    expect(rows).toEqual(copy);
  });

  it('survives re-parsing when the parse settings change', () => {
    const text = readFileSync(
      new URL('../../data/sample-bank-report.csv', import.meta.url),
      'utf8',
    );
    const config = defaultConfig();
    const classify = parse =>
      classifyTransactions(
        assignPayees(parseStatement(text, parse, 's').transactions, config.payees),
        config.rules,
      );
    const first = classify(config.parse);
    const market = first.find(t => t.payeeKey === 'CORNER MARKET');
    const overrides = withOverride(emptyOverrides(), 'transactions', market.id, {
      category: 'Utilities',
    });

    // another value-date column name, same rows
    const again = classify({ ...config.parse, cols: { ...config.parse.cols, value: 'Valu' } });
    expect(again.map(t => t.id)).toEqual(first.map(t => t.id));
    const out = applyOverrides(again, overrides);
    expect(out.find(t => t.id === market.id).category).toBe('Utilities');
  });
});

describe('withOverride (ENG-8)', () => {
  it('adds and merges fields without changing the original', () => {
    const base = emptyOverrides();
    const one = withOverride(base, 'payees', 'GYM', { category: 'Housing' });
    const two = withOverride(one, 'payees', 'GYM', { kind: 'saving' });
    expect(base).toEqual({ transactions: {}, payees: {} });
    expect(two.payees.GYM).toEqual({ category: 'Housing', kind: 'saving' });
  });

  it('removes a field set to undefined and drops an empty entry', () => {
    const one = withOverride(emptyOverrides(), 'transactions', 't', {
      category: 'X',
      ignore: true,
    });
    const two = withOverride(one, 'transactions', 't', { category: undefined });
    expect(two.transactions.t).toEqual({ ignore: true });
    expect(withOverride(two, 'transactions', 't', { ignore: undefined }).transactions).toEqual({});
  });
});
