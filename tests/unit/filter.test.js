import { describe, expect, it } from 'vitest';
import { filterTransactions } from '../../src/core/filter.js';

const tx = (date, desc, amount = -100) => ({
  id: `${date}|${amount}|${desc}#1`,
  date,
  desc,
  amount,
});
const base = { from: '', to: '', ownTransfers: true, own: [], exclude: [] };
const sample = [
  tx('2026-01-02', 'Payroll'),
  tx('2026-01-15', 'Paid to Market'),
  tx('2026-02-01', 'Transfer to own account'),
  tx('2026-02-10', 'Gift card promo'),
  tx('2026-03-05', 'Paid to Market'),
];

describe('filterTransactions (ENG-4)', () => {
  it('keeps everything when no filter is set', () => {
    const r = filterTransactions(sample, base);
    expect(r.kept).toEqual(sample);
    expect(r.removed).toEqual([]);
    expect(r.counts).toEqual({ range: 0, exclude: 0, own: 0, total: 0 });
  });

  it('applies the date range inclusively', () => {
    const r = filterTransactions(sample, { ...base, from: '2026-01-15', to: '2026-02-10' });
    expect(r.kept.map(t => t.date)).toEqual(['2026-01-15', '2026-02-01', '2026-02-10']);
    expect(r.counts.range).toBe(2);
  });

  it('accepts a range with only one end', () => {
    expect(filterTransactions(sample, { ...base, from: '2026-02-10' }).kept).toHaveLength(2);
    expect(filterTransactions(sample, { ...base, to: '2026-01-02' }).kept).toHaveLength(1);
  });

  it('removes descriptions matching an exclusion pattern, case-insensitively', () => {
    const r = filterTransactions(sample, { ...base, exclude: ['GIFT\\s+card'] });
    expect(r.kept).toHaveLength(4);
    expect(r.removed).toEqual([{ tx: sample[3], reason: 'exclude', pattern: 'GIFT\\s+card' }]);
    expect(r.counts.exclude).toBe(1);
  });

  it('removes own-account transfers only when the toggle is on', () => {
    const own = ['transfer to own'];
    const on = filterTransactions(sample, { ...base, own });
    expect(on.removed.map(r => [r.tx.desc, r.reason])).toEqual([
      ['Transfer to own account', 'own'],
    ]);
    expect(on.counts.own).toBe(1);
    const off = filterTransactions(sample, { ...base, own, ownTransfers: false });
    expect(off.kept).toHaveLength(5);
    expect(off.counts.own).toBe(0);
  });

  it('counts a transaction once, under the first reason that removes it', () => {
    const r = filterTransactions(sample, {
      ...base,
      to: '2026-01-31',
      exclude: ['market'],
    });
    expect(r.counts).toEqual({ range: 3, exclude: 1, own: 0, total: 4 });
    expect(r.kept.map(t => t.desc)).toEqual(['Payroll']);
  });

  it('gives a few examples of what was removed for each reason', () => {
    const many = Array.from({ length: 6 }, (_, i) => tx(`2026-01-0${i + 1}`, `Shop ${i}`));
    const r = filterTransactions(many, { ...base, exclude: ['shop'] });
    expect(r.counts.exclude).toBe(6);
    expect(r.examples.exclude).toHaveLength(3);
    expect(r.examples.exclude[0]).toBe(many[0]);
    expect(r.examples.range).toEqual([]);
  });

  it('ignores invalid patterns instead of throwing', () => {
    const r = filterTransactions(sample, { ...base, exclude: ['(', 'promo'], own: ['['] });
    expect(r.counts.exclude).toBe(1);
    expect(r.counts.own).toBe(0);
  });

  it('does not modify its input', () => {
    const copy = structuredClone(sample);
    filterTransactions(sample, { ...base, to: '2026-01-31' });
    expect(sample).toEqual(copy);
  });
});
