import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/core/config.js';
import { exportConfig, importConfig } from '../../src/core/config-file.js';

const sampleText = () =>
  readFileSync(new URL('../../data/sample-config.json', import.meta.url), 'utf8');

describe('exportConfig (IMP-13)', () => {
  it('writes the versioned configuration as readable JSON', () => {
    const text = exportConfig(defaultConfig());
    expect(text).toContain('\n');
    expect(JSON.parse(text)).toEqual(defaultConfig());
    expect(text.endsWith('\n')).toBe(true);
  });

  it('writes only the configuration sections, never anything else', () => {
    const config = { ...defaultConfig(), transactions: [{ desc: 'secret' }], sources: ['x'] };
    const written = JSON.parse(exportConfig(config));
    expect(Object.keys(written).sort()).toEqual(
      ['cats', 'filter', 'parse', 'payees', 'rules', 'version'].sort(),
    );
    expect(exportConfig(config)).not.toContain('secret');
  });
});

describe('importConfig (IMP-13)', () => {
  it('reads the sample configuration', () => {
    const result = importConfig(sampleText());
    expect(result.errors).toEqual([]);
    expect(result.config).toEqual(defaultConfig());
  });

  it('round-trips an exported configuration', () => {
    const config = defaultConfig();
    config.cats.push('Hobbies');
    config.rules.push({ p: 'club', cat: 'Hobbies', kind: 'expense' });
    expect(importConfig(exportConfig(config))).toEqual({ config, errors: [] });
  });

  it('reports text that is not JSON', () => {
    const result = importConfig('{ not json');
    expect(result.config).toBeNull();
    expect(result.errors).toEqual([
      { path: '', message: expect.stringMatching(/not valid JSON/i) },
    ]);
  });

  it('reports problems by field path and returns no configuration', () => {
    const broken = JSON.parse(sampleText());
    broken.payees = ['(open'];
    broken.rules[0].cat = 'Nowhere';
    const result = importConfig(JSON.stringify(broken));
    expect(result.config).toBeNull();
    expect(result.errors.map(e => e.path)).toEqual(['payees[0]', 'rules[0].cat']);
  });

  it('ignores sections it does not know and does not keep them', () => {
    const extra = { ...JSON.parse(sampleText()), transactions: [{ desc: 'x' }] };
    const result = importConfig(JSON.stringify(extra));
    expect(result.errors).toEqual([]);
    expect(result.config).not.toHaveProperty('transactions');
  });

  it('rejects a file from a newer version with a clear message', () => {
    const newer = { ...JSON.parse(sampleText()), version: 99 };
    const result = importConfig(JSON.stringify(newer));
    expect(result.config).toBeNull();
    expect(result.errors).toEqual([{ path: 'version', message: expect.any(String) }]);
  });

  it('rejects JSON that is not a configuration', () => {
    expect(importConfig('[]').errors).toHaveLength(1);
    expect(importConfig('null').errors).toHaveLength(1);
  });
});
