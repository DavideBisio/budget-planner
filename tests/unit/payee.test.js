import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/core/config.js';
import { parseStatement } from '../../src/core/parser.js';
import { assignPayees, extractPayee, payeeKey } from '../../src/core/payee.js';

const patterns = defaultConfig().payees;
const tx = (desc, type = '') => ({ desc, type });

describe('payeeKey (ENG-5)', () => {
  it('ignores case, punctuation, accents and word order', () => {
    expect(payeeKey('Rossi, Mario')).toBe('MARIO ROSSI');
    expect(payeeKey('mario  rossi')).toBe('MARIO ROSSI');
    expect(payeeKey('Café Zoé!')).toBe('CAFE ZOE');
  });

  it('uses the first three words', () => {
    expect(payeeKey('one two three four five')).toBe('ONE THREE TWO');
  });

  it('is empty for text without letters or digits', () => {
    expect(payeeKey('--- ')).toBe('');
  });
});

describe('extractPayee (ENG-5)', () => {
  it('takes capture group 1 of the first matching pattern', () => {
    const r = extractPayee(tx('Paid to Corner Market ref CARD', 'Card'), patterns);
    expect(r).toEqual({
      name: 'Corner Market',
      key: 'CORNER MARKET',
      source: 'pattern',
      rule: 0,
    });
  });

  it('tries patterns in order and the first match wins', () => {
    const list = ['shop (a\\w+)', 'shop (\\w+)'];
    expect(extractPayee(tx('shop apple'), list).name).toBe('apple');
    expect(extractPayee(tx('shop pear'), list).name).toBe('pear');
  });

  it('reports which pattern produced the payee, so rules can be counted', () => {
    const list = ['shop (a\\w+)', 'shop (\\w+)'];
    expect(extractPayee(tx('shop apple'), list).rule).toBe(0);
    expect(extractPayee(tx('shop pear'), list).rule).toBe(1);
    expect(extractPayee(tx('nothing'), list)).not.toHaveProperty('rule');
  });

  it('skips a pattern whose group is empty or did not take part', () => {
    const list = ['x(\\d*)y', 'pay (\\w+)'];
    expect(extractPayee(tx('xy pay Bob'), list).name).toBe('Bob');
    expect(extractPayee(tx('b'), ['(a)|(b)'], 'T')).toMatchObject({ source: 'description' });
  });

  it('falls back to the Type column, then to the start of the description', () => {
    expect(extractPayee(tx('Payroll ACME Corp ref JAN', 'Salary'), patterns)).toEqual({
      name: 'Salary',
      key: 'SALARY',
      source: 'type',
    });
    expect(extractPayee(tx('Monthly fee for the current account ref 7'), patterns)).toEqual({
      name: 'Monthly fee for',
      key: 'FEE FOR MONTHLY',
      source: 'description',
    });
  });

  it('ignores invalid patterns', () => {
    expect(extractPayee(tx('Paid to Bob', ''), ['(', 'paid to (\\w+)']).name).toBe('Bob');
  });

  it('gives an empty payee for an empty description without a type', () => {
    expect(extractPayee(tx(''), patterns)).toEqual({ name: '', key: '', source: 'description' });
  });

  it('groups the same counterparty written differently under one key', () => {
    const a = extractPayee(tx('Paid to Rossi, Mario ref A'), patterns);
    const b = extractPayee(tx('PAID TO MARIO ROSSI'), patterns);
    expect(a.key).toBe(b.key);
  });
});

describe('assignPayees (ENG-5)', () => {
  it('adds payee and payeeKey to each transaction without changing the input', () => {
    const input = [tx('Paid to Corner Market ref CARD')];
    const [out] = assignPayees(input, patterns);
    expect(out).toMatchObject({ payee: 'Corner Market', payeeKey: 'CORNER MARKET' });
    expect(input[0]).not.toHaveProperty('payee');
  });

  it('records where each payee came from', () => {
    const out = assignPayees(
      [tx('Paid to Corner Market ref CARD'), tx('Gift', 'Card'), tx('Plain words here today')],
      patterns,
    );
    expect(out.map(t => t.payeeSource)).toEqual(['pattern', 'type', 'description']);
    expect(out.map(t => t.payeeRule)).toEqual([0, undefined, undefined]);
  });

  it('works on the sample statement', () => {
    const text = readFileSync(
      new URL('../../data/sample-bank-report.csv', import.meta.url),
      'utf8',
    );
    const { transactions } = parseStatement(text, defaultConfig().parse, 's');
    const names = new Set(assignPayees(transactions, patterns).map(t => t.payee));
    expect(names).toEqual(
      new Set([
        'Salary',
        'Landlord Rossi',
        'StreamCo',
        'Example Broker',
        'Corner Market',
        'Transfer',
        'Power Utility',
      ]),
    );
  });
});
