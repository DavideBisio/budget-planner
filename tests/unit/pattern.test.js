import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/core/config.js';
import {
  buildCapture,
  buildPattern,
  escapeRegex,
  explainPatternError,
  parseCapture,
  parsePattern,
  summarizePattern,
  testPattern,
} from '../../src/core/pattern.js';

describe('escapeRegex (IMP-5)', () => {
  it('escapes every character that has a meaning in a regular expression', () => {
    expect(escapeRegex('a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o')).toBe(
      'a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\|l\\[m\\]n\\\\o',
    );
  });

  it('leaves ordinary text, spaces and accents alone', () => {
    expect(escapeRegex('Caffè del Corso-2')).toBe('Caffè del Corso-2');
  });

  it('produces a pattern that matches the original text literally', () => {
    const text = 'a.b (c) [d] $5 + 5?';
    expect(new RegExp(escapeRegex(text), 'i').test(`x ${text} y`)).toBe(true);
    expect(new RegExp(escapeRegex('a.b'), 'i').test('axb')).toBe(false);
  });
});

describe('buildPattern (IMP-5)', () => {
  it.each([
    [{ mode: 'contains', text: 'rent' }, 'rent'],
    [{ mode: 'starts', text: 'rent' }, '^rent'],
    [{ mode: 'ends', text: 'rent' }, 'rent$'],
    [{ mode: 'equals', text: 'rent' }, '^rent$'],
    [{ mode: 'contains', text: 'a.b' }, 'a\\.b'],
    [{ mode: 'anyOf', words: ['payroll', 'acme'] }, 'payroll|acme'],
    [{ mode: 'anyOf', words: ['a.b', ' c ', ''] }, 'a\\.b|c'],
    [{ mode: 'advanced', text: 'pay(roll)?' }, 'pay(roll)?'],
  ])('%j gives %s', (spec, pattern) => {
    expect(buildPattern(spec)).toBe(pattern);
  });

  it('gives an empty pattern when there is nothing to look for', () => {
    expect(buildPattern({ mode: 'contains', text: '' })).toBe('');
    expect(buildPattern({ mode: 'anyOf', words: [] })).toBe('');
    expect(buildPattern({ mode: 'anyOf', words: ['', ' '] })).toBe('');
  });
});

describe('parsePattern (IMP-5)', () => {
  it.each([
    ['rent', { mode: 'contains', text: 'rent' }],
    ['^rent', { mode: 'starts', text: 'rent' }],
    ['rent$', { mode: 'ends', text: 'rent' }],
    ['^rent$', { mode: 'equals', text: 'rent' }],
    ['a\\.b', { mode: 'contains', text: 'a.b' }],
    ['payroll|acme', { mode: 'anyOf', words: ['payroll', 'acme'] }],
    ['a\\|b', { mode: 'contains', text: 'a|b' }],
    ['a\\$', { mode: 'contains', text: 'a$' }],
    ['', { mode: 'contains', text: '' }],
  ])('reads %s', (pattern, spec) => {
    expect(parsePattern(pattern)).toEqual(spec);
  });

  it.each(['pay(roll)?', 'a.*b', '[abc]', '^a|b$', 'a||b', '\\d+', 'a{2}', '^a|^b'])(
    'falls back to advanced for %s',
    pattern => {
      expect(parsePattern(pattern)).toEqual({ mode: 'advanced', text: pattern });
    },
  );

  it('round-trips what buildPattern makes, whatever the text', () => {
    const specs = [
      { mode: 'contains', text: 'x.y*z' },
      { mode: 'starts', text: '(a)' },
      { mode: 'ends', text: 'cost $' },
      { mode: 'equals', text: 'back\\slash' },
      { mode: 'anyOf', words: ['a|b', 'c+d', 'e'] },
    ];
    for (const spec of specs) {
      expect(parsePattern(buildPattern(spec))).toEqual(spec);
    }
  });

  it('classifies the patterns of the sample configuration', () => {
    const config = defaultConfig();
    expect(parsePattern(config.filter.own[0]).mode).toBe('contains');
    expect(parsePattern(config.rules[0].p)).toEqual({
      mode: 'anyOf',
      words: ['payroll', 'acme'],
    });
    expect(parsePattern(config.parse.openingRe).mode).toBe('starts');
    expect(parsePattern(config.payees[0]).mode).toBe('advanced');
  });
});

describe('capture helpers (IMP-5)', () => {
  it('builds "text between X and Y" and "text after X"', () => {
    expect(buildCapture({ mode: 'between', before: 'paid to', after: 'ref' })).toBe(
      'paid to\\s*(.+?)\\s*ref',
    );
    expect(buildCapture({ mode: 'after', before: 'paid to' })).toBe('paid to\\s*(.+?)\\s*$');
    expect(buildCapture({ mode: 'between', before: 'a.b', after: '(c)' })).toBe(
      'a\\.b\\s*(.+?)\\s*\\(c\\)',
    );
  });

  it('gives an empty pattern when the starting words are missing', () => {
    expect(buildCapture({ mode: 'after', before: '' })).toBe('');
    expect(buildCapture({ mode: 'between', before: 'x', after: '' })).toBe('');
  });

  it('extracts the payee text the way the wording says', () => {
    const between = new RegExp(
      buildCapture({ mode: 'between', before: 'paid to', after: 'ref' }),
      'i',
    );
    expect(between.exec('Paid to Demo Cafe ref COFFEE')[1]).toBe('Demo Cafe');
    const after = new RegExp(buildCapture({ mode: 'after', before: 'paid to' }), 'i');
    expect(after.exec('Paid to Demo Cafe  ')[1]).toBe('Demo Cafe');
  });

  it('reads them back, else advanced', () => {
    const between = { mode: 'between', before: 'paid to', after: 'ref' };
    const after = { mode: 'after', before: 'a.b' };
    expect(parseCapture(buildCapture(between))).toEqual(between);
    expect(parseCapture(buildCapture(after))).toEqual(after);
    expect(parseCapture('paid to\\s+(.+?)(?:\\s+ref\\b|$)')).toEqual({
      mode: 'advanced',
      text: 'paid to\\s+(.+?)(?:\\s+ref\\b|$)',
    });
    expect(parseCapture('')).toEqual({ mode: 'between', before: '', after: '' });
  });
});

describe('explainPatternError (IMP-5)', () => {
  it('accepts a valid pattern', () => {
    expect(explainPatternError('pay(roll)?')).toBeNull();
  });

  it('asks for something to look for when empty', () => {
    expect(explainPatternError('')).toMatch(/enter/i);
  });

  it.each([
    ['(open', /bracket.*never closed|never closed/i],
    ['close)', /closing bracket|no matching/i],
    ['[abc', /\[.*never closed|square/i],
    ['*start', /nothing before|before it/i],
    ['end\\', /backslash/i],
    ['[z-a]', /order/i],
  ])('explains %s without the raw engine message', (pattern, expected) => {
    const message = explainPatternError(pattern);
    expect(message).toMatch(expected);
    expect(message).not.toMatch(/regular expression:|Invalid regular|SyntaxError/);
  });

  it('has a generic message for anything else', () => {
    expect(explainPatternError('(?<=a)(?<n>')).toBeTruthy();
  });

  it('asks for a capture group when a payee pattern has none', () => {
    expect(explainPatternError('paid to', { capture: true })).toMatch(/group/i);
    expect(explainPatternError('paid to (.+)', { capture: true })).toBeNull();
  });
});

describe('testPattern (IMP-5)', () => {
  const texts = [
    'Payroll Example Corp',
    'Paid to Demo Cafe',
    'Paid to Sample Landlord',
    'Card fee',
  ];

  it('counts matches and lists examples with the matched ranges', () => {
    const result = testPattern('paid to', texts);
    expect(result).toMatchObject({ error: null, total: 4, count: 2 });
    expect(result.matches).toEqual([
      { text: 'Paid to Demo Cafe', ranges: [[0, 7]] },
      { text: 'Paid to Sample Landlord', ranges: [[0, 7]] },
    ]);
    expect(result.misses).toEqual(['Payroll Example Corp', 'Card fee']);
  });

  it('is case-insensitive and finds every occurrence', () => {
    const result = testPattern('a', ['AbA']);
    expect(result.matches[0].ranges).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('limits the examples but not the count', () => {
    const many = Array.from({ length: 10 }, (_, i) => `item ${i}`);
    const result = testPattern('item', many, { examples: 3 });
    expect(result.count).toBe(10);
    expect(result.matches).toHaveLength(3);
    expect(result.misses).toEqual([]);
    expect(testPattern('zzz', many, { examples: 3 }).misses).toHaveLength(3);
  });

  it('reports an invalid pattern with a readable message and no matches', () => {
    const result = testPattern('(open', texts);
    expect(result.error).toMatch(/never closed/i);
    expect(result).toMatchObject({ count: 0, matches: [], misses: [] });
  });

  it('highlights the captured text for payee patterns and ignores empty captures', () => {
    const result = testPattern('paid to\\s*(.+?)\\s*$', [...texts, 'Paid to '], { capture: true });
    expect(result.count).toBe(2);
    expect(result.matches[0]).toEqual({
      text: 'Paid to Demo Cafe',
      ranges: [[8, 17]],
      capture: 'Demo Cafe',
    });
  });

  it('does not loop on a pattern that can match nothing', () => {
    const result = testPattern('x*', ['abc', 'xx']);
    expect(result.count).toBe(2);
    expect(result.matches[1].ranges).toEqual([[0, 2]]);
  });

  it('handles an empty pattern and no texts', () => {
    expect(testPattern('', texts)).toMatchObject({ count: 0, total: 4 });
    expect(testPattern('a', [])).toMatchObject({ count: 0, total: 0, matches: [], misses: [] });
  });
});

describe('summarizePattern (IMP-5)', () => {
  it('says in words what a pattern looks for', () => {
    expect(summarizePattern('market')).toBe('contains "market"');
    expect(summarizePattern('^market')).toBe('starts with "market"');
    expect(summarizePattern('market$')).toBe('ends with "market"');
    expect(summarizePattern('^market$')).toBe('is exactly "market"');
    expect(summarizePattern('payroll|acme')).toBe('any of: payroll, acme');
  });

  it('describes payee patterns by the words around the name', () => {
    const between = buildCapture({ mode: 'between', before: 'paid to', after: 'ref' });
    expect(summarizePattern(between, { capture: true })).toBe('text between "paid to" and "ref"');
    const after = buildCapture({ mode: 'after', before: 'paid to' });
    expect(summarizePattern(after, { capture: true })).toBe('text after "paid to"');
  });

  it('shows an advanced expression as it is and an empty pattern as a prompt', () => {
    expect(summarizePattern('^a.+b\\d')).toBe('expression ^a.+b\\d');
    expect(summarizePattern('')).toBe('not set yet');
  });
});
