import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/core/config.js';
import { parseAmount, parseDate, parseStatement } from '../../src/core/parser.js';

const read = (dir, name) => readFileSync(new URL(`../../${dir}/${name}`, import.meta.url), 'utf8');
const fixture = name => read('tests/fixtures', name);
const settings = (patch = {}, cols = {}) => {
  const parse = defaultConfig().parse;
  return { ...parse, ...patch, cols: { ...parse.cols, ...cols } };
};
const italian = settings(
  {
    delim: ';',
    decimal: ',',
    dateFmt: 'dmy',
    openingRe: '^saldo iniziale',
    closingRe: '^saldo finale',
  },
  {
    date: 'Registrazione',
    value: 'Valuta',
    out: 'Dare',
    in: 'Avere',
    causale: 'Causale',
    desc: 'Descrizione',
  },
);

describe('parseAmount (ENG-2)', () => {
  it('returns integer cents', () => {
    expect(parseAmount('12.99', '.')).toBe(1299);
    expect(parseAmount('800', '.')).toBe(80000);
    expect(parseAmount('0.5', '.')).toBe(50);
    expect(parseAmount('-420.00', '.')).toBe(-42000);
  });

  it('reads a decimal comma and ignores thousands separators and spaces', () => {
    expect(parseAmount('1.234,56', ',')).toBe(123456);
    expect(parseAmount('1,234.56', '.')).toBe(123456);
    expect(parseAmount(' 19,90 ', ',')).toBe(1990);
  });

  it('rounds to cents at the edge, half away from zero', () => {
    expect(parseAmount('1.005', '.')).toBe(101);
    expect(parseAmount('-1.005', '.')).toBe(-101);
    expect(parseAmount('1.004', '.')).toBe(100);
  });

  it('returns null for empty or non-numeric text', () => {
    expect(parseAmount('', '.')).toBeNull();
    expect(parseAmount('  ', '.')).toBeNull();
    expect(parseAmount('abc', '.')).toBeNull();
    expect(parseAmount('1.2.3x', '.')).toBeNull();
  });
});

describe('parseDate (ENG-2)', () => {
  it('normalises the three formats to YYYY-MM-DD', () => {
    expect(parseDate('2026-01-02', 'ymd')).toBe('2026-01-02');
    expect(parseDate('02/01/2026', 'dmy')).toBe('2026-01-02');
    expect(parseDate('01/02/2026', 'mdy')).toBe('2026-01-02');
  });

  it('accepts other separators, short numbers, two-digit years and a trailing time', () => {
    expect(parseDate('2.1.2026', 'dmy')).toBe('2026-01-02');
    expect(parseDate('02-01-26', 'dmy')).toBe('2026-01-02');
    expect(parseDate('2026/01/02 10:30', 'ymd')).toBe('2026-01-02');
  });

  it('rejects impossible or unreadable dates', () => {
    expect(parseDate('31/02/2026', 'dmy')).toBeNull();
    expect(parseDate('2026-13-01', 'ymd')).toBeNull();
    expect(parseDate('', 'ymd')).toBeNull();
    expect(parseDate('soon', 'ymd')).toBeNull();
  });
});

describe('parseStatement (ENG-2)', () => {
  it('parses a comma file with debit and credit columns and balance rows', () => {
    const result = parseStatement(fixture('comma-split.csv'), settings(), 'comma-split.csv');
    expect(result.errors).toEqual([]);
    expect(result.file).toBe('comma-split.csv');
    expect(result.opening).toBe(100000);
    expect(result.closing).toBe(206010);
    expect(result.transactions.map(t => [t.date, t.amount, t.type])).toEqual([
      ['2026-01-02', 150000, 'Salary'],
      ['2026-01-04', -42000, 'Transfer'],
      ['2026-01-09', -1990, 'Card'],
    ]);
    expect(result.transactions[1].desc).toBe('Paid to Sample Landlord ref RENT');
    expect(result.transactions[1].valueDate).toBe('2026-01-04');
  });

  it('keeps the raw row of each transaction for the debug view', () => {
    const [first] = parseStatement(fixture('comma-split.csv'), settings()).transactions;
    expect(first.raw).toMatchObject({
      Credit: '1500.00',
      Description: 'Payroll Example Corp ref JAN',
    });
  });

  it('parses semicolons, decimal commas and dd/mm/yyyy dates', () => {
    const result = parseStatement(fixture('semicolon-decimal-comma.csv'), italian);
    expect(result.errors).toEqual([]);
    expect(result.opening).toBe(100000);
    expect(result.closing).toBe(206010);
    expect(result.transactions.map(t => [t.date, t.amount])).toEqual([
      ['2026-01-02', 150000],
      ['2026-01-04', -42000],
      ['2026-01-09', -1990],
    ]);
  });

  it('parses one signed amount column', () => {
    const cols = { date: 'Date', amount: 'Amount', out: '', in: '', value: '', causale: '' };
    const result = parseStatement(fixture('single-amount.csv'), settings({}, cols));
    expect(result.errors).toEqual([]);
    expect(result.transactions.map(t => t.amount)).toEqual([150000, -42000, -1990]);
    expect(result.opening).toBeNull();
    expect(result.closing).toBeNull();
  });

  it('reads a BOM and CRLF file and leaves absent optional columns empty', () => {
    const result = parseStatement(fixture('bom-crlf.csv'), settings());
    expect(result.errors).toEqual([]);
    expect(result.transactions.map(t => t.amount)).toEqual([150000, -42000]);
    expect(result.transactions[0].type).toBe('');
    expect(result.transactions[0].desc).toBe('Payroll Example Corp ref JAN');
  });

  it('works without balance rows', () => {
    const result = parseStatement(fixture('missing-balance.csv'), settings());
    expect(result.opening).toBeNull();
    expect(result.closing).toBeNull();
    expect(result.transactions).toHaveLength(2);
  });

  it('keeps identical rows distinct with stable ids', () => {
    const run = () => parseStatement(fixture('duplicate-rows.csv'), settings(), 'dup.csv');
    const ids = run().transactions.map(t => t.id);
    expect(ids).toEqual([
      '2026-01-05|-350|Paid to Demo Cafe ref COFFEE#1',
      '2026-01-05|-350|Paid to Demo Cafe ref COFFEE#2',
      '2026-01-06|-350|Paid to Demo Cafe ref COFFEE#1',
    ]);
    expect(run().transactions.map(t => t.id)).toEqual(ids);
  });

  it('finds the header by column name prefix, ignoring case and lines before it', () => {
    const text = [
      'Account report',
      '',
      'BOOKING DATE (local),Debit amount,Credit amount,Description text',
      '2026-01-02,,10.00,Salary',
      '',
    ].join('\n');
    const result = parseStatement(text, settings());
    expect(result.errors).toEqual([]);
    expect(result.transactions.map(t => [t.amount, t.desc])).toEqual([[1000, 'Salary']]);
  });

  it('handles quoted descriptions with delimiters and newlines', () => {
    const text = 'Booking date,Debit,Credit,Description\n2026-01-02,5.00,,"Shop, Main St\nref 7"\n';
    const [t] = parseStatement(text, settings()).transactions;
    expect(t.desc).toBe('Shop, Main St\nref 7');
    expect(t.amount).toBe(-500);
  });

  it('reads the sample statement and its balances reconcile', () => {
    const text = read('data', 'sample-bank-report.csv');
    const result = parseStatement(text, settings(), 'sample-bank-report.csv');
    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(16);
    const sum = result.transactions.reduce((total, t) => total + t.amount, 0);
    expect(result.opening + sum).toBe(result.closing);
  });

  it('names the file and the missing column', () => {
    const text = 'Booking date,Debit,Credit\n2026-01-02,,10.00\n';
    const result = parseStatement(text, settings(), 'march.csv');
    expect(result.transactions).toEqual([]);
    expect(result.errors).toEqual([
      { file: 'march.csv', column: 'Description', message: expect.stringContaining('march.csv') },
    ]);
    expect(result.errors[0].message).toContain('Description');
  });

  it('reports every missing required column, including amount columns', () => {
    const result = parseStatement('Foo,Bar\n1,2\n', settings(), 'x.csv');
    expect(result.errors.map(e => e.column)).toEqual([
      'Booking date',
      'Description',
      'Debit',
      'Credit',
    ]);
  });

  it('lists the description of every data row, balance rows included', () => {
    const result = parseStatement(fixture('comma-split.csv'), settings());
    expect(result.descriptions).toEqual([
      'Opening balance',
      'Payroll Example Corp ref JAN',
      'Paid to Sample Landlord ref RENT',
      'Paid to Demo Streaming ref SUB',
      'Closing balance',
    ]);
  });

  it('reports an empty file', () => {
    const result = parseStatement('', settings(), 'empty.csv');
    expect(result.errors).toEqual([
      { file: 'empty.csv', column: '', message: expect.stringContaining('empty.csv') },
    ]);
  });

  it('skips rows it cannot read and says why', () => {
    const text = [
      'Booking date,Debit,Credit,Description',
      '2026-01-02,,10.00,Fine',
      'not a date,,10.00,Bad date',
      '2026-01-03,x,,Bad amount',
      '2026-01-04,,,No amount',
      ',,,Note without date',
      '',
    ].join('\n');
    const result = parseStatement(text, settings(), 'odd.csv');
    expect(result.transactions.map(t => t.desc)).toEqual(['Fine']);
    expect(result.warnings.map(w => [w.row, w.file])).toEqual([
      [3, 'odd.csv'],
      [4, 'odd.csv'],
      [5, 'odd.csv'],
      [6, 'odd.csv'],
    ]);
    expect(result.warnings[0].message).toMatch(/date/i);
    expect(result.warnings[1].message).toMatch(/amount/i);
  });
});
