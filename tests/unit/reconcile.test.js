import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/core/config.js';
import { parseStatement } from '../../src/core/parser.js';
import { checkChain, reconcileFile } from '../../src/core/reconcile.js';

// a statement as the parser returns it, reduced to what reconciliation reads
const statement = (file, opening, closing, moves) => ({
  file,
  opening,
  closing,
  transactions: moves.map(([date, amount], i) => ({
    id: `${date}|${amount}|x#${i + 1}`,
    date,
    amount,
  })),
});

describe('reconcileFile (ENG-3)', () => {
  it('is ok when opening + movements = closing', () => {
    const r = reconcileFile(
      statement('a', 1000, 1300, [
        ['2026-01-02', 500],
        ['2026-01-05', -200],
      ]),
    );
    expect(r).toMatchObject({
      file: 'a',
      status: 'ok',
      movements: 300,
      expected: 1300,
      difference: 0,
    });
  });

  it('allows a difference of one cent', () => {
    expect(reconcileFile(statement('a', 1000, 1301, [['2026-01-02', 300]])).status).toBe('ok');
  });

  it('reports a mismatch with the size of the difference', () => {
    const r = reconcileFile(statement('a', 1000, 1500, [['2026-01-02', 300]]));
    expect(r).toMatchObject({ status: 'mismatch', difference: 200 });
  });

  it('is unknown when a balance row is missing', () => {
    expect(reconcileFile(statement('a', null, 1500, [['2026-01-02', 300]])).status).toBe('unknown');
    expect(reconcileFile(statement('a', 1000, null, [])).status).toBe('unknown');
  });

  it('reconciles a parsed fixture', () => {
    const text = readFileSync(
      new URL('../../tests/fixtures/comma-split.csv', import.meta.url),
      'utf8',
    );
    const parsed = parseStatement(text, defaultConfig().parse, 'f');
    expect(reconcileFile(parsed).status).toBe('ok');
  });
});

describe('checkChain (ENG-3)', () => {
  const jan = statement('jan', 1000, 1500, [['2026-01-02', 500]]);
  const feb = statement('feb', 1500, 1400, [['2026-02-03', -100]]);
  const mar = statement('mar', 1400, 1450, [['2026-03-03', 50]]);

  it('chains consecutive files whatever order they were added in', () => {
    const result = checkChain([mar, jan, feb]);
    expect(result.files.map(f => f.file)).toEqual(['jan', 'feb', 'mar']);
    expect(result.links.map(l => [l.from, l.to, l.status])).toEqual([
      ['jan', 'feb', 'ok'],
      ['feb', 'mar', 'ok'],
    ]);
    expect(result.ok).toBe(true);
    expect(result.problems).toBe(0);
  });

  it('reports a gap when a file is missing between two others', () => {
    const result = checkChain([jan, mar]);
    expect(result.links[0]).toMatchObject({
      from: 'jan',
      to: 'mar',
      status: 'gap',
      difference: -100,
    });
    expect(result.ok).toBe(false);
    expect(result.problems).toBe(1);
  });

  it('reports an overlap when the date ranges intersect, with the shared rows', () => {
    const overlapping = statement('feb2', 1400, 1350, [
      ['2026-01-02', 500],
      ['2026-02-03', -100],
      ['2026-02-10', -50],
    ]);
    const link = checkChain([jan, overlapping]).links[0];
    expect(link.status).toBe('overlap');
    expect(link.duplicates).toBe(1);
  });

  it('is unknown when balances are missing and dates do not overlap', () => {
    const noBalance = statement('x', null, null, [['2026-02-03', -100]]);
    const result = checkChain([jan, noBalance]);
    expect(result.links[0].status).toBe('unknown');
    expect(result.ok).toBe(true);
  });

  it('flags overlapping dates even without balances', () => {
    const a = statement('a', null, null, [
      ['2026-01-02', 1],
      ['2026-01-20', 1],
    ]);
    const b = statement('b', null, null, [['2026-01-10', 1]]);
    expect(checkChain([a, b]).links[0].status).toBe('overlap');
  });

  it('counts file mismatches as problems', () => {
    const broken = statement('broken', 1000, 9999, [['2026-01-02', 5]]);
    const result = checkChain([broken]);
    expect(result.links).toEqual([]);
    expect(result.problems).toBe(1);
    expect(result.ok).toBe(false);
  });

  it('puts files without transactions last and handles no files', () => {
    const empty = statement('empty', 1, 1, []);
    expect(checkChain([empty, jan]).files.map(f => f.file)).toEqual(['jan', 'empty']);
    expect(checkChain([])).toEqual({ files: [], links: [], ok: true, problems: 0 });
  });
});
