import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Every file in the fixtures folder is invented. The tests look at the folder as a whole, so a new
// fixture is checked automatically and the coverage of cases does not depend on file names.
const folder = new URL('../fixtures/', import.meta.url);
const names = readdirSync(folder).filter(n => !n.startsWith('.'));
const all = names.map(name => {
  const raw = readFileSync(new URL(name, folder));
  return { name, raw, text: raw.toString('utf8') };
});
const some = predicate => all.some(predicate);
const lines = text => text.split(/\r?\n/).filter(Boolean);

// IBAN-like: two letters, two digits, then 11 to 30 letters or digits, optionally in groups of four.
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/;
// Long digit runs (card, account, phone numbers).
const LONG_DIGITS = /\d{9,}/;

describe('fixtures are fictional (PRIV)', () => {
  it('there are fixtures', () => {
    expect(names.length).toBeGreaterThan(0);
  });

  for (const { name, text } of all) {
    it(`${name} has no IBAN-like strings or long digit runs`, () => {
      expect(text).not.toMatch(IBAN);
      expect(text).not.toMatch(LONG_DIGITS);
    });
  }

  it('the pattern does catch an IBAN-like string', () => {
    expect('IT60 X054 2811 1010 0000 0123 456').toMatch(IBAN);
    expect('GB82WEST12345698765432').toMatch(IBAN);
  });
});

describe('fixtures cover the parsing cases (ENG-2)', () => {
  it('comma delimiter with a decimal point', () => {
    expect(some(({ text }) => lines(text)[0].includes(',') && /\d\.\d{2}/.test(text))).toBe(true);
  });

  it('semicolon delimiter with a decimal comma', () => {
    expect(some(({ text }) => lines(text)[0].includes(';') && /\d,\d{2}/.test(text))).toBe(true);
  });

  it('split debit and credit columns', () => {
    expect(
      some(({ text }) => /debit/i.test(lines(text)[0]) && /credit/i.test(lines(text)[0])),
    ).toBe(true);
  });

  it('one signed amount column', () => {
    expect(some(({ text }) => /amount/i.test(lines(text)[0]) && /,-\d/.test(text))).toBe(true);
  });

  it('byte order mark', () => {
    expect(some(({ raw }) => raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf)).toBe(true);
  });

  it('CRLF line endings', () => {
    expect(some(({ text }) => text.includes('\r\n'))).toBe(true);
  });

  it('duplicate rows', () => {
    expect(
      some(({ text }) => {
        const rows = lines(text).slice(1);
        return new Set(rows).size < rows.length;
      }),
    ).toBe(true);
  });

  it('missing balance rows', () => {
    expect(some(({ text }) => !/opening|closing|iniziale|finale/i.test(text))).toBe(true);
  });

  it('balance rows present', () => {
    expect(some(({ text }) => /opening balance/i.test(text) && /closing balance/i.test(text))).toBe(
      true,
    );
  });
});
