import { describe, expect, it } from 'vitest';
import {
  addCategory,
  categoryUsage,
  deleteCategory,
  isProtectedCategory,
  renameCategory,
} from '../../src/core/categories.js';
import { defaultConfig, validateConfig } from '../../src/core/config.js';

describe('categoryUsage (IMP-9)', () => {
  it('counts the rules that use a category', () => {
    const config = defaultConfig();
    expect(categoryUsage(config, 'Salary')).toBe(1);
    expect(categoryUsage(config, 'Own transfers')).toBe(0);
    expect(categoryUsage(config, 'Nothing')).toBe(0);
    config.rules.push({ p: 'x', cat: 'Salary', kind: '' });
    expect(categoryUsage(config, 'Salary')).toBe(2);
  });
});

describe('isProtectedCategory (IMP-9)', () => {
  it('protects the two categories used for transactions no rule matches', () => {
    expect(isProtectedCategory('Other income')).toBe(true);
    expect(isProtectedCategory('Other expenses')).toBe(true);
    expect(isProtectedCategory('Housing')).toBe(false);
  });
});

describe('addCategory (IMP-9)', () => {
  it('appends a trimmed name and leaves the input alone', () => {
    const input = defaultConfig();
    const { config, error } = addCategory(input, '  Hobbies ');
    expect(error).toBeNull();
    expect(config.cats.at(-1)).toBe('Hobbies');
    expect(input.cats).not.toContain('Hobbies');
    expect(validateConfig(config)).toEqual([]);
  });

  it('refuses an empty or duplicate name and returns the configuration unchanged', () => {
    const input = defaultConfig();
    expect(addCategory(input, '   ').error).toMatch(/name/i);
    const duplicate = addCategory(input, 'Housing');
    expect(duplicate.error).toMatch(/already exists/i);
    expect(duplicate.config).toEqual(input);
  });

  it('treats names that differ only by case as the same', () => {
    expect(addCategory(defaultConfig(), 'housing').error).toMatch(/already exists/i);
  });
});

describe('renameCategory (IMP-9)', () => {
  it('renames in place and updates every rule that uses it', () => {
    const input = defaultConfig();
    input.rules.push({ p: 'extra', cat: 'Housing', kind: '' });
    const { config, error } = renameCategory(input, 'Housing', 'Home');
    expect(error).toBeNull();
    expect(config.cats[1]).toBe('Home');
    expect(config.cats).not.toContain('Housing');
    expect(config.rules.filter(r => r.cat === 'Home')).toHaveLength(2);
    expect(config.rules.some(r => r.cat === 'Housing')).toBe(false);
    expect(validateConfig(config)).toEqual([]);
    expect(input.cats[1]).toBe('Housing');
  });

  it('allows a change of case only', () => {
    const { config, error } = renameCategory(defaultConfig(), 'Housing', 'HOUSING');
    expect(error).toBeNull();
    expect(config.cats[1]).toBe('HOUSING');
  });

  it('refuses an empty name, an existing name, an unknown category and protected ones', () => {
    const input = defaultConfig();
    expect(renameCategory(input, 'Housing', ' ').error).toMatch(/name/i);
    expect(renameCategory(input, 'Housing', 'Utilities').error).toMatch(/already exists/i);
    expect(renameCategory(input, 'Nope', 'X').error).toMatch(/not found|unknown/i);
    expect(renameCategory(input, 'Other income', 'Misc').error).toMatch(/cannot be changed/i);
    expect(renameCategory(input, 'Housing', 'Other expenses').error).toMatch(/already exists/i);
  });

  it('does nothing when the name is the same', () => {
    const input = defaultConfig();
    const result = renameCategory(input, 'Housing', 'Housing');
    expect(result.error).toBeNull();
    expect(result.config).toEqual(input);
  });
});

describe('deleteCategory (IMP-9)', () => {
  it('deletes a category no rule uses', () => {
    const { config, error } = deleteCategory(defaultConfig(), 'Own transfers');
    expect(error).toBeNull();
    expect(config.cats).not.toContain('Own transfers');
    expect(validateConfig(config)).toEqual([]);
  });

  it('is blocked while rules use the category, and says how many', () => {
    const input = defaultConfig();
    const { config, error } = deleteCategory(input, 'Housing');
    expect(error).toMatch(/used by 1 rule/i);
    expect(config).toEqual(input);
  });

  it('moves the rules to another category when asked to', () => {
    const { config, error } = deleteCategory(defaultConfig(), 'Housing', 'Utilities');
    expect(error).toBeNull();
    expect(config.cats).not.toContain('Housing');
    expect(config.rules[1].cat).toBe('Utilities');
    expect(validateConfig(config)).toEqual([]);
  });

  it('refuses a missing, identical or unknown target and protected categories', () => {
    const input = defaultConfig();
    expect(deleteCategory(input, 'Housing', 'Housing').error).toMatch(/another category/i);
    expect(deleteCategory(input, 'Housing', 'Nope').error).toMatch(/another category/i);
    expect(deleteCategory(input, 'Nope').error).toMatch(/not found|unknown/i);
    expect(deleteCategory(input, 'Other expenses').error).toMatch(/cannot be changed/i);
  });
});
