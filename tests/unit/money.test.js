import { describe, expect, it } from 'vitest';
import { parseCents } from '../../src/core/money.js';

describe('parseCents', () => {
  it.each([
    ['1234', 123400],
    ['1234.5', 123450],
    ['1234.56', 123456],
    ['1234,56', 123456],
    ['0.07', 7],
    ['  42  ', 4200],
    ['-19.90', -1990],
    ['+5', 500],
    ['.5', 50],
  ])('reads %j as %i cents', (text, cents) => {
    expect(parseCents(text)).toBe(cents);
  });

  it('accepts a thousands separator when a decimal part follows', () => {
    expect(parseCents('1,234.56')).toBe(123456);
    expect(parseCents('1.234,56')).toBe(123456);
    expect(parseCents('1 234,56')).toBe(123456);
  });

  it.each(['', '   ', 'abc', '12.345', '1.2.3', '--5', '5-', '1e3'])('rejects %j', text => {
    expect(parseCents(text)).toBeNull();
  });

  it('never returns negative zero', () => {
    expect(Object.is(parseCents('-0'), 0)).toBe(true);
  });
});
