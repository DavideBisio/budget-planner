import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, buildBackup, parseBackup } from '../../src/core/backup.js';
import { defaultConfig } from '../../src/core/config.js';
import { emptyOverrides } from '../../src/core/overrides.js';
import { emptyPlanner } from '../../src/core/planner.js';

const plan = { ...emptyPlanner('2026-01'), salaryCents: 250000 };
const sections = () => ({
  config: defaultConfig(),
  overrides: emptyOverrides(),
  planner: plan,
  files: [{ name: 'january', text: 'fictional raw text' }],
});

describe('buildBackup (STOR-4)', () => {
  it('is one versioned document with the planner state and the configuration', () => {
    const backup = buildBackup(sections());
    expect(backup).toMatchObject({ app: 'budget-planner', version: BACKUP_VERSION });
    expect(Object.keys(backup.data).sort()).toEqual(['config', 'overrides', 'planner']);
    expect(backup.data.planner).toEqual(plan);
  });

  it('leaves the raw bank files out unless asked', () => {
    expect(buildBackup(sections()).data.files).toBeUndefined();
    expect(JSON.stringify(buildBackup(sections()))).not.toContain('fictional raw text');
    expect(buildBackup(sections(), { includeFiles: true }).data.files).toEqual(sections().files);
  });

  it('holds only what exists', () => {
    const backup = buildBackup({ planner: plan });
    expect(Object.keys(backup.data)).toEqual(['planner']);
  });

  it('records the schema version of each section, for migration on restore', () => {
    expect(buildBackup(sections()).versions).toEqual({ config: 1, overrides: 1, planner: 1 });
  });
});

describe('parseBackup (STOR-4)', () => {
  const text = (mutate = () => {}) => {
    const backup = structuredClone(buildBackup(sections(), { includeFiles: true }));
    mutate(backup);
    return JSON.stringify(backup);
  };

  it('accepts what buildBackup produced and returns the sections to write', () => {
    const result = parseBackup(text());
    expect(result.problems).toEqual([]);
    expect(result.sections.map(s => s.name).sort()).toEqual([
      'config',
      'files',
      'overrides',
      'planner',
    ]);
    expect(result.sections.find(s => s.name === 'planner')).toEqual({
      name: 'planner',
      version: 1,
      data: plan,
    });
  });

  it('rejects text that is not JSON', () => {
    const { problems, sections: found } = parseBackup('not json');
    expect(problems[0].message).toMatch(/not a valid backup file/i);
    expect(found).toEqual([]);
  });

  it('rejects another kind of file, and a backup from a newer version', () => {
    expect(parseBackup(JSON.stringify({ hello: 1 })).problems[0].path).toBe('app');
    expect(parseBackup(text(b => (b.version = 9))).problems[0].message).toMatch(/newer version/i);
  });

  it('rejects a backup with no sections', () => {
    expect(parseBackup(text(b => (b.data = {}))).problems[0].message).toMatch(
      /nothing to restore/i,
    );
  });

  it('validates every section and names the problems with their paths', () => {
    const { problems, sections: found } = parseBackup(
      text(b => {
        b.data.planner.start = 'soon';
        b.data.config.rules = 'none';
        b.data.overrides = [];
        b.data.files = [{ name: 1 }];
      }),
    );
    const paths = problems.map(p => p.path);
    expect(paths).toEqual(
      expect.arrayContaining(['planner.start', 'config.rules', 'overrides', 'files']),
    );
    expect(found).toEqual([]);
  });

  it('migrates a section written by an older schema, and refuses one from a newer schema', () => {
    const older = parseBackup(
      text(b => (b.versions.planner = 1)),
      {
        planner: { version: 2, migrations: { 1: d => ({ ...d, horizon: 24 }) } },
      },
    );
    expect(older.problems).toEqual([]);
    expect(older.sections.find(s => s.name === 'planner')).toMatchObject({
      version: 2,
      data: { horizon: 24 },
    });
    const newer = parseBackup(text(b => (b.versions.planner = 5)));
    expect(newer.problems.map(p => p.path)).toContain('planner');
    expect(newer.sections).toEqual([]);
  });

  it('ignores sections it does not know', () => {
    const { problems, sections: found } = parseBackup(text(b => (b.data.extra = { a: 1 })));
    expect(problems).toEqual([]);
    expect(found.map(s => s.name)).not.toContain('extra');
  });
});
