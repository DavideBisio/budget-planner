import { describe, expect, it } from 'vitest';
import { unwrap, wrap } from '../../src/core/envelope.js';

describe('wrap (STOR-1)', () => {
  it('stores a value with its schema version', () => {
    expect(wrap(2, { a: 1 })).toEqual({ version: 2, data: { a: 1 } });
  });
});

describe('unwrap (STOR-1, STOR-2)', () => {
  const options = { version: 2, migrations: { 1: data => ({ ...data, b: 2 }) } };

  it('reports nothing stored', () => {
    expect(unwrap(null, options)).toEqual({ status: 'empty', data: null });
    expect(unwrap(undefined, options)).toEqual({ status: 'empty', data: null });
  });

  it('returns the data of a current value', () => {
    expect(unwrap(wrap(2, { a: 1 }), options)).toEqual({ status: 'ok', data: { a: 1 } });
  });

  it('applies the migrations in order up to the current version', () => {
    const steps = {
      1: data => ({ ...data, b: 2 }),
      2: data => ({ ...data, c: 3 }),
    };
    const result = unwrap(wrap(1, { a: 1 }), { version: 3, migrations: steps });
    expect(result).toEqual({ status: 'migrated', data: { a: 1, b: 2, c: 3 } });
  });

  it('does not modify the stored value while migrating', () => {
    const stored = wrap(1, { a: 1 });
    unwrap(stored, options);
    expect(stored).toEqual({ version: 1, data: { a: 1 } });
  });

  it('leaves a newer value alone and says so', () => {
    const result = unwrap(wrap(5, { z: 1 }), options);
    expect(result).toEqual({ status: 'newer', data: null, version: 5 });
  });

  it('keeps the original when a migration fails', () => {
    const throwing = {
      version: 2,
      migrations: {
        1: () => {
          throw new Error('boom');
        },
      },
    };
    expect(unwrap(wrap(1, { a: 1 }), throwing)).toMatchObject({ status: 'failed', data: null });
    expect(unwrap(wrap(1, { a: 1 }), throwing).error).toMatch(/boom/);
  });

  it('reports a missing migration step as a failure', () => {
    const result = unwrap(wrap(1, { a: 1 }), { version: 3, migrations: { 1: d => d } });
    expect(result).toMatchObject({ status: 'failed', data: null });
  });

  it.each([
    42,
    'text',
    [],
    {},
    { version: 'x', data: 1 },
    { version: 1.5, data: 1 },
    { version: 0, data: 1 },
    { version: 1 },
  ])('calls %j invalid', value => {
    expect(unwrap(value, options)).toEqual({ status: 'invalid', data: null });
  });
});
