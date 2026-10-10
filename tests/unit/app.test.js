import { describe, expect, it } from 'vitest';
import { APP_NAME } from '../../src/core/app.js';

describe('app', () => {
  it('has a name', () => {
    expect(APP_NAME).toBe('budget-planner');
  });
});
