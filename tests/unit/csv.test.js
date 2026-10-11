import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../src/core/csv.js';

describe('parseCsv (ENG-2)', () => {
  it('splits rows and cells on the delimiter', () => {
    expect(parseCsv('a,b,c\n1,2,3\n', ',')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('supports semicolon and tab delimiters', () => {
    expect(parseCsv('a;b\n1;2', ';')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\tb\n1\t2', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps delimiters, quotes and newlines inside quoted fields', () => {
    const text = 'a,"b,1","say ""hi""","line1\nline2"\n';
    expect(parseCsv(text, ',')).toEqual([['a', 'b,1', 'say "hi"', 'line1\nline2']]);
  });

  it('handles CRLF and a lone CR as line breaks', () => {
    expect(parseCsv('a,b\r\n1,2\r\n', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\r1', ',')).toEqual([['a'], ['1']]);
  });

  it('drops a byte order mark', () => {
    expect(parseCsv('﻿a,b\n', ',')).toEqual([['a', 'b']]);
  });

  it('skips blank lines but keeps empty cells', () => {
    expect(parseCsv('a,,c\n\n\n,,\nd,e,f', ',')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
      ['d', 'e', 'f'],
    ]);
  });

  it('accepts an unterminated last row and an unterminated quote', () => {
    expect(parseCsv('a,b', ',')).toEqual([['a', 'b']]);
    expect(parseCsv('a,"b', ',')).toEqual([['a', 'b']]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCsv('', ',')).toEqual([]);
  });
});
