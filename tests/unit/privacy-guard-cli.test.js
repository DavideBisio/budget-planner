import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { isProtected, protectedPathsIn } from '../../scripts/privacy-guard.mjs';

const guard = fileURLToPath(new URL('../../scripts/privacy-guard.mjs', import.meta.url));
const run = (args, options = {}) =>
  spawnSync(process.execPath, [guard, ...args], { encoding: 'utf8', ...options });

describe('path forms', () => {
  it.each([
    'C:\\Users\\me\\prj\\budget-planner\\data\\a.json',
    'c:/users/me/prj/budget-planner/data/a.json',
    '\\\\server\\share\\budget-planner\\data\\a.json',
    '/home/me/prj/budget-planner/data/a.json',
    '/mnt/c/Users/me/budget-planner/data/a.json',
    './data/a.json',
    '../budget-planner/data/a.json',
    'data\\sub/dir\\a.json',
    'DATA/A.JSON',
    'data/',
    'data',
    'notes/export.CSV',
    'src/data/rows.json',
  ])('protects %s', path => {
    expect(isProtected(path)).toBe(true);
  });

  it.each([
    '/home/me/prj/budget-planner/data/README.md',
    'C:\\prj\\budget-planner\\data\\sample-config.json',
    './data/sample-bank-report.csv',
    '/home/me/prj/budget-planner/tests/fixtures/semi.csv',
    'C:\\prj\\budget-planner\\tests\\fixtures\\a.csv',
    'database/schema.sql',
    'src/core/metadata.js',
  ])('allows %s', path => {
    expect(isProtected(path)).toBe(false);
  });
});

describe('only path fields are checked', () => {
  it('ignores text that is written, not read', () => {
    const text = 'see data/my-bank.csv and fictional data';
    expect(protectedPathsIn('Write', { file_path: 'docs/a.md', content: text })).toEqual([]);
    expect(
      protectedPathsIn('Edit', { file_path: 'docs/a.md', old_string: text, new_string: text }),
    ).toEqual([]);
    expect(protectedPathsIn('Bash', { command: 'ls', description: text })).toEqual([]);
  });

  it('still blocks the path of a write or edit', () => {
    expect(protectedPathsIn('Write', { file_path: 'data/x.json', content: 'x' })).toHaveLength(1);
    expect(protectedPathsIn('Edit', { file_path: 'a/b/c.csv', new_string: 'x' })).toHaveLength(1);
    expect(protectedPathsIn('NotebookEdit', { notebook_path: 'data/n.ipynb' })).toHaveLength(1);
  });

  it('does not treat a search expression as a path', () => {
    expect(protectedPathsIn('Grep', { pattern: 'data', path: 'src' })).toEqual([]);
    expect(protectedPathsIn('Grep', { pattern: 'x', path: 'data/' })).toHaveLength(1);
    expect(protectedPathsIn('Grep', { pattern: 'x', glob: '**/*.csv' })).toHaveLength(1);
  });

  it('checks the pattern and path of Glob', () => {
    expect(protectedPathsIn('Glob', { pattern: 'data/**' })).toHaveLength(1);
    expect(protectedPathsIn('Glob', { pattern: '*.js', path: 'data' })).toHaveLength(1);
    expect(protectedPathsIn('Glob', { pattern: 'src/**/*.js' })).toEqual([]);
  });

  it('checks every field of a tool it does not know', () => {
    expect(protectedPathsIn('Other', { anything: { nested: ['data/x.json'] } })).toHaveLength(1);
  });

  it('blocks shell commands in POSIX and PowerShell forms', () => {
    expect(protectedPathsIn('Bash', { command: 'cat ./data/x.json' })).toHaveLength(1);
    expect(protectedPathsIn('Bash', { command: 'cd data && ls' })).toEqual([]);
    expect(protectedPathsIn('Bash', { command: 'cat "$PWD"/data/x.json' })).toHaveLength(1);
    expect(protectedPathsIn('PowerShell', { command: 'gc .\\data\\x.json' })).toHaveLength(1);
    expect(protectedPathsIn('PowerShell', { command: 'gc C:\\a\\b.CSV' })).toHaveLength(1);
  });
});

describe('--hook', () => {
  const call = input => run(['--hook'], { input: JSON.stringify(input) });

  it('exits 2 for a protected path and 0 otherwise', () => {
    expect(call({ tool_name: 'Read', tool_input: { file_path: 'data/x.json' } }).status).toBe(2);
    expect(call({ tool_name: 'Read', tool_input: { file_path: 'src/a.js' } }).status).toBe(0);
  });

  it('blocks when the call cannot be parsed', () => {
    expect(run(['--hook'], { input: 'not json' }).status).toBe(2);
  });
});

describe('--staged and --tracked in a git repository', () => {
  const dirs = [];
  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
  });

  function repo() {
    const dir = mkdtempSync(join(tmpdir(), 'guard-'));
    dirs.push(dir);
    const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    // an ignore rule like the real one, so a plain `git add` skips the private folder
    writeFileSync(join(dir, '.gitignore'), 'data/*\n');
    return { dir, git };
  }

  it('fails when a private file is staged with git add -f', () => {
    const { dir, git } = repo();
    mkdirSync(join(dir, 'data'));
    writeFileSync(join(dir, 'data', 'secret.json'), '{}');
    expect(git('add', 'data/secret.json').status).not.toBe(0);
    expect(git('add', '-f', 'data/secret.json').status).toBe(0);
    const result = run(['--staged'], { cwd: dir });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('data/secret.json');
  });

  it('passes when only ordinary files are staged', () => {
    const { dir, git } = repo();
    writeFileSync(join(dir, 'a.js'), '');
    git('add', 'a.js');
    expect(run(['--staged'], { cwd: dir }).status).toBe(0);
  });

  it('--tracked fails on a committed private file', () => {
    const { dir, git } = repo();
    writeFileSync(join(dir, 'export.csv'), 'x');
    git('add', '-f', 'export.csv');
    git('commit', '-q', '-m', 'x');
    expect(run(['--tracked'], { cwd: dir }).status).toBe(1);
  });

  it('rejects an unknown mode', () => {
    expect(run(['--nope']).status).toBe(64);
  });
});
