import { describe, expect, it } from 'vitest';
import { emptyOverrides, withOverride } from '../../src/core/overrides.js';
import { buildResult } from '../../src/core/result.js';

const tx = (date, amount, payee, extra = {}) => ({
  id: `${date}|${amount}|${payee}#1`,
  date,
  amount,
  desc: payee,
  payee,
  payeeKey: payee.toUpperCase(),
  category: amount > 0 ? 'Salary' : 'Housing',
  kind: amount > 0 ? 'income' : 'expense',
  rule: null,
  ...extra,
});

const months = ['2026-01', '2026-02', '2026-03'];
const classified = [
  ...months.map(m => tx(`${m}-02`, 150000, 'Acme')),
  ...months.map(m => tx(`${m}-04`, -42000, 'Landlord')),
  tx('2026-02-15', -1990, 'Cafe'),
];

describe('buildResult (IMP-10, IMP-11)', () => {
  it('splits recurring from one-time entries and builds the cards', () => {
    const r = buildResult(classified, emptyOverrides());
    expect(r.recurring.map(e => e.payee).sort()).toEqual(['Acme', 'Landlord']);
    expect(r.oneTime.map(t => t.payee)).toEqual(['Cafe']);
    expect(r.ignored).toEqual([]);
    expect(r.cards.recurring).toHaveLength(2);
    expect(r.cards.oneTime).toHaveLength(1);
    expect(r.cards.totals.net).toBe(3 * 150000 - 3 * 42000 - 1990);
  });

  it('applies a payee override to every transaction of that payee', () => {
    const overrides = withOverride(emptyOverrides(), 'payees', 'LANDLORD', {
      category: 'Utilities',
    });
    const r = buildResult(classified, overrides);
    const landlord = r.recurring.find(e => e.payee === 'Landlord');
    expect(landlord.category).toBe('Utilities');
    expect(landlord.transactions.every(t => t.override === 'payee')).toBe(true);
  });

  it('moves an ignored transaction to the ignored list and out of the cards', () => {
    const cafe = classified.at(-1);
    const overrides = withOverride(emptyOverrides(), 'transactions', cafe.id, { ignore: true });
    const r = buildResult(classified, overrides);
    expect(r.ignored.map(t => t.payee)).toEqual(['Cafe']);
    expect(r.oneTime).toEqual([]);
    expect(r.cards.totals.net).toBe(3 * 150000 - 3 * 42000);
  });

  it('turns the rest of a series into one-time entries when one payment is ignored', () => {
    const second = classified[4];
    const overrides = withOverride(emptyOverrides(), 'transactions', second.id, { ignore: true });
    const r = buildResult(classified, overrides);
    expect(r.recurring.map(e => e.payee)).toEqual(['Acme']);
    expect(r.oneTime.filter(t => t.payee === 'Landlord')).toHaveLength(2);
  });

  it('can ignore a whole payee, and reports what each transaction became', () => {
    const overrides = withOverride(emptyOverrides(), 'payees', 'ACME', { ignore: true });
    const r = buildResult(classified, overrides);
    expect(r.ignored).toHaveLength(3);
    expect(r.resolved).toHaveLength(classified.length);
    expect(r.recurring.map(e => e.payee)).toEqual(['Landlord']);
  });

  it('handles no transactions', () => {
    const r = buildResult([], emptyOverrides());
    expect(r).toMatchObject({ recurring: [], oneTime: [], ignored: [], resolved: [] });
    expect(r.cards.totals.net).toBe(0);
  });
});
