import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = name => readFileSync(new URL(`../../data/${name}`, import.meta.url), 'utf8');

describe('data/ samples', () => {
  it('sample-config.json is valid and has every section', () => {
    const cfg = JSON.parse(read('sample-config.json'));
    expect(cfg.version).toBe(1);
    for (const key of ['parse', 'filter', 'payees', 'rules', 'cats'])
      expect(cfg).toHaveProperty(key);
    for (const rule of cfg.rules) expect(cfg.cats).toContain(rule.cat);
  });

  it('sample-bank-report.csv reconciles: opening + movements = closing', () => {
    const rows = read('sample-bank-report.csv').trim().split('\n').slice(1);
    let opening = 0;
    let closing = 0;
    let movements = 0;
    for (const row of rows) {
      const [booked, , debit, credit, , desc] = row.split(',');
      const amount = Number(credit || 0) - Number(debit || 0);
      if (!booked && /^opening/i.test(desc)) opening = amount;
      else if (!booked && /^closing/i.test(desc)) closing = amount;
      else movements += amount;
    }
    expect(opening + movements).toBeCloseTo(closing, 2);
  });
});
