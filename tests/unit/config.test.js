import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONFIG_VERSION,
  compilePattern,
  defaultConfig,
  migrateConfig,
  patternError,
  validateConfig,
} from '../../src/core/config.js';

const sample = () =>
  JSON.parse(readFileSync(new URL('../../data/sample-config.json', import.meta.url), 'utf8'));
const paths = errors => errors.map(e => e.path);

describe('patternError and compilePattern (ENG-1)', () => {
  it('accepts a valid expression and compiles it case-insensitively', () => {
    expect(patternError('pay(roll)?')).toBeNull();
    expect(compilePattern('payroll').test('PAYROLL ACME')).toBe(true);
  });

  it('reports an invalid expression instead of throwing', () => {
    expect(patternError('(unclosed')).toMatch(/invalid/i);
    expect(compilePattern('(unclosed')).toBeNull();
  });

  it('explains an invalid expression in plain language, not with the engine message', () => {
    expect(patternError('(unclosed')).toMatch(/never closed/i);
    expect(patternError('(unclosed')).not.toMatch(/regular expression|SyntaxError/i);
  });

  it('rejects non-strings and empty patterns', () => {
    expect(patternError(42)).not.toBeNull();
    expect(patternError('')).not.toBeNull();
  });
});

describe('defaultConfig (ENG-1)', () => {
  it('equals the sample configuration', () => {
    expect(defaultConfig()).toEqual(sample());
  });

  it('returns an independent copy each time', () => {
    const a = defaultConfig();
    a.cats.push('Extra');
    a.parse.cols.date = 'changed';
    expect(defaultConfig().cats).not.toContain('Extra');
    expect(defaultConfig().parse.cols.date).toBe('Booking date');
  });
});

describe('validateConfig (ENG-1)', () => {
  it('accepts the sample file and the defaults', () => {
    expect(validateConfig(sample())).toEqual([]);
    expect(validateConfig(defaultConfig())).toEqual([]);
  });

  it('rejects something that is not an object', () => {
    expect(validateConfig(null)).toEqual([{ path: '', message: expect.any(String) }]);
    expect(validateConfig([])).toHaveLength(1);
  });

  it('names the field path and reason of an invalid payee pattern', () => {
    const cfg = sample();
    cfg.payees = ['ok (.+)', 'also (.+)', '(broken'];
    const errors = validateConfig(cfg);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('payees[2]');
    expect(errors[0].message).toMatch(/invalid pattern/i);
  });

  it('requires a capture group in payee patterns', () => {
    const cfg = sample();
    cfg.payees = ['no group here'];
    expect(validateConfig(cfg)).toEqual([
      { path: 'payees[0]', message: expect.stringMatching(/capture group/i) },
    ]);
  });

  it('checks the parse settings', () => {
    const cfg = sample();
    cfg.parse.delim = 'x';
    cfg.parse.decimal = ';';
    cfg.parse.dateFmt = 'ydm';
    cfg.parse.cols.date = '';
    cfg.parse.cols.desc = 5;
    cfg.parse.openingRe = '(';
    cfg.parse.closingRe = '';
    expect(paths(validateConfig(cfg))).toEqual([
      'parse.delim',
      'parse.decimal',
      'parse.dateFmt',
      'parse.cols.date',
      'parse.cols.desc',
      'parse.openingRe',
      'parse.closingRe',
    ]);
  });

  it('accepts a tab delimiter', () => {
    const cfg = sample();
    cfg.parse.delim = '\t';
    expect(validateConfig(cfg)).toEqual([]);
  });

  it('needs an amount column or both debit and credit columns', () => {
    const cfg = sample();
    cfg.parse.cols.out = '';
    cfg.parse.cols.in = '';
    cfg.parse.cols.amount = '';
    expect(paths(validateConfig(cfg))).toEqual(['parse.cols']);
    cfg.parse.cols.amount = 'Amount';
    expect(validateConfig(cfg)).toEqual([]);
  });

  it('checks the filter dates, toggle and patterns', () => {
    const cfg = sample();
    cfg.filter = { from: '2026-13-01', to: 'soon', ownTransfers: 'yes', own: ['('], exclude: [1] };
    expect(paths(validateConfig(cfg))).toEqual([
      'filter.from',
      'filter.to',
      'filter.ownTransfers',
      'filter.own[0]',
      'filter.exclude[0]',
    ]);
  });

  it('rejects a range that ends before it starts', () => {
    const cfg = sample();
    cfg.filter.from = '2026-03-01';
    cfg.filter.to = '2026-02-01';
    expect(paths(validateConfig(cfg))).toEqual(['filter.to']);
  });

  it('checks every rule: pattern, category and kind', () => {
    const cfg = sample();
    cfg.rules = [
      { p: '(', cat: 'Salary', kind: 'income' },
      { p: 'ok', cat: 'Unknown', kind: '' },
      { p: 'ok', cat: 'Salary', kind: 'gift' },
      'nope',
    ];
    expect(paths(validateConfig(cfg))).toEqual([
      'rules[0].p',
      'rules[1].cat',
      'rules[2].kind',
      'rules[3]',
    ]);
  });

  it('accepts the kinds income, saving, expense and empty', () => {
    const cfg = sample();
    cfg.rules = ['income', 'saving', 'expense', ''].map(kind => ({ p: 'x', cat: 'Salary', kind }));
    expect(validateConfig(cfg)).toEqual([]);
  });

  it('rejects duplicate or empty categories and wrong section types', () => {
    const cfg = sample();
    cfg.cats = ['Salary', 'Salary', ''];
    cfg.rules = [];
    expect(paths(validateConfig(cfg))).toEqual(['cats[1]', 'cats[2]']);
    expect(paths(validateConfig({ ...sample(), payees: 'x', cats: {}, rules: null }))).toEqual([
      'payees',
      'rules',
      'cats',
    ]);
  });

  it('reports missing sections', () => {
    expect(paths(validateConfig({ version: 1 }))).toEqual([
      'parse',
      'filter',
      'payees',
      'rules',
      'cats',
    ]);
  });

  it('rejects an unknown or newer version', () => {
    expect(paths(validateConfig({ ...sample(), version: 99 }))).toEqual(['version']);
    expect(paths(validateConfig({ ...sample(), version: undefined }))).toEqual(['version']);
  });
});

describe('migrateConfig (ENG-1)', () => {
  it('returns a current configuration unchanged', () => {
    expect(migrateConfig(sample())).toEqual(sample());
    expect(CONFIG_VERSION).toBe(1);
  });

  it('runs the migration steps from the stored version up to the current one', () => {
    const steps = { 0: c => ({ ...c, version: 1, migrated: true }) };
    const result = migrateConfig({ version: 0 }, steps, 1);
    expect(result).toEqual({ version: 1, migrated: true });
  });

  it('leaves a newer or unmigratable configuration for validation to report', () => {
    expect(migrateConfig({ version: 7 }).version).toBe(7);
    expect(migrateConfig({ version: 0 }, {}, 1).version).toBe(0);
  });

  it('does not modify its input', () => {
    const input = { version: 0 };
    migrateConfig(input, { 0: c => ({ ...c, version: 1 }) }, 1);
    expect(input).toEqual({ version: 0 });
  });
});
