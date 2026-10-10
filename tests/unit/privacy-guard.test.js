import { describe, expect, it } from 'vitest';
import { isProtected, protectedPathsIn } from '../../scripts/privacy-guard.mjs';

describe('isProtected', () => {
  it.each([
    'data/config.json',
    'data\\my-bank-2026.csv',
    'E:/Dropbox/documenti/budget-planner/data/notes.txt',
    'statement.csv',
    'src/old/export.CSV',
    '.env',
    '.env.local',
  ])('protects %s', path => {
    expect(isProtected(path)).toBe(true);
  });

  it.each([
    'data/README.md',
    'data/sample-config.json',
    'data/sample-bank-report.csv',
    'tests/fixtures/small.csv',
    'src/core/parser.js',
    'package.json',
  ])('allows %s', path => {
    expect(isProtected(path)).toBe(false);
  });
});

describe('protectedPathsIn', () => {
  it('blocks file tools pointing at private data', () => {
    expect(
      protectedPathsIn('Read', { file_path: 'E:\\x\\budget-planner\\data\\config.json' }),
    ).toHaveLength(1);
    expect(protectedPathsIn('Glob', { pattern: '**/*.csv' })).toHaveLength(1);
  });

  it('blocks shell commands that name private data', () => {
    expect(protectedPathsIn('Bash', { command: 'cat data/my-bank.csv | head' })).toHaveLength(1);
    expect(
      protectedPathsIn('PowerShell', { command: 'Get-Content "data\\config.json"' }),
    ).toHaveLength(1);
  });

  it('lets the samples and ordinary commands through', () => {
    expect(protectedPathsIn('Read', { file_path: 'data/sample-config.json' })).toEqual([]);
    expect(protectedPathsIn('Bash', { command: 'cat data/sample-bank-report.csv' })).toEqual([]);
    expect(protectedPathsIn('Bash', { command: 'git commit -m "update data model"' })).toEqual([]);
    expect(protectedPathsIn('Edit', { file_path: 'src/core/parser.js' })).toEqual([]);
  });
});
