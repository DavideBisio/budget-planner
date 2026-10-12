import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/core/config.js';
import { STEPS, stepStatuses } from '../../src/core/steps.js';

const state = (patch = {}) => ({ config: defaultConfig(), files: [], ...patch });
const byId = statuses => Object.fromEntries(statuses.map(s => [s.id, s]));
const okFile = { file: 'first', errors: [] };
const LATER = ['categories', 'filtering', 'payees', 'output'];

describe('STEPS (IMP-1)', () => {
  it('lists the six steps in order, each with a title and a purpose', () => {
    expect(STEPS.map(s => s.id)).toEqual([
      'import',
      'parsing',
      'categories',
      'filtering',
      'payees',
      'output',
    ]);
    for (const step of STEPS) {
      expect(step.title).toBeTruthy();
      expect(step.purpose).toBeTruthy();
    }
  });
});

describe('stepStatuses (IMP-2)', () => {
  it('starts with import to do and every other step waiting', () => {
    const s = byId(stepStatuses(state()));
    expect(s.import.status).toBe('todo');
    expect(s.parsing.status).toBe('waiting');
    expect(s.parsing.reason).toMatch(/step 1/i);
    for (const id of LATER) {
      expect(s[id].status).toBe('waiting');
      expect(s[id].reason).toMatch(/step 1/i);
    }
  });

  it('opens every later step once a file is imported', () => {
    const s = byId(stepStatuses(state({ files: [okFile] })));
    expect(s.import.status).toBe('valid');
    expect(s.parsing.status).toBe('valid');
    for (const id of LATER) {
      expect(s[id].status).toBe('valid');
      expect(s[id].reason).toBe('');
    }
  });

  it('flags parsing settings that do not validate and holds back the steps that need them', () => {
    const config = state().config;
    config.parse.delim = 'x';
    const s = byId(stepStatuses(state({ config, files: [okFile] })));
    expect(s.import.status).toBe('valid');
    expect(s.parsing.status).toBe('attention');
    expect(s.parsing.reason).toMatch(/delim/i);
    expect(s.filtering.status).toBe('waiting');
    expect(s.filtering.reason).toMatch(/step 2/i);
    expect(s.filtering.reason).not.toMatch(/step 1/i);
  });

  it('names both missing steps when neither is ready', () => {
    const config = state().config;
    config.parse.delim = 'x';
    const bad = { file: 'second', errors: [{ message: 'second: column not found' }] };
    const { reason } = byId(stepStatuses(state({ config, files: [bad] })))['filtering'];
    expect(reason).toMatch(/step 1/i);
    expect(reason).toMatch(/step 2/i);
  });

  it('flags a file that could not be read on import and on parsing, where it is fixed', () => {
    const bad = { file: 'second', errors: [{ message: 'second: column "Description" not found' }] };
    const s = byId(stepStatuses(state({ files: [okFile, bad] })));
    expect(s.import.status).toBe('attention');
    expect(s.import.reason).toContain('second');
    expect(s.parsing.status).toBe('attention');
    expect(s.parsing.reason).toContain('second');
    expect(s.filtering.status).toBe('waiting');
  });

  it('attributes configuration errors to the step that owns the field', () => {
    const config = state().config;
    config.filter.own = ['('];
    config.payees = ['no group'];
    config.rules[0].cat = 'Missing';
    config.cats.push('Salary');
    const s = byId(stepStatuses(state({ config, files: [okFile] })));
    expect(s.filtering.status).toBe('attention');
    expect(s.payees.status).toBe('attention');
    expect(s.categories.status).toBe('attention');
    expect(s.parsing.status).toBe('valid');
    expect(s.output.status).toBe('attention');
    expect(s.output.reason).toMatch(/steps? 3/i);
  });
});
