import { describe, expect, it } from 'vitest';
import {
  addMonths,
  emptyPlanner,
  monthRange,
  project,
  validatePlanner,
} from '../../src/core/planner.js';

// Fictional sample plan: salary 2500.00, rent 420.00 every month, a 200.00 holiday in March,
// 100.00 put into savings every month.
const entry = (id, kind, amountCents, label = id) => ({
  id,
  label,
  category: 'Sample',
  kind,
  amountCents,
  source: 'manual',
});

const sample = (overrides = {}) => ({
  ...emptyPlanner('2026-01'),
  salaryCents: 250000,
  horizon: 4,
  cards: [
    {
      id: 'c1',
      type: 'recurring',
      title: 'Every month',
      month: null,
      entries: [entry('rent', 'expense', 42000), entry('piggy', 'saving', 10000)],
    },
    {
      id: 'c2',
      type: 'one-time',
      title: 'Holiday',
      month: '2026-03',
      entries: [entry('trip', 'expense', 20000)],
    },
  ],
  ...overrides,
});

describe('month helpers', () => {
  it('adds months across a year end', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', 0)).toBe('2026-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('lists consecutive months from a start', () => {
    expect(monthRange('2026-11', 3)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('project (PLAN-1, 2, 4, 5)', () => {
  it('applies the salary and recurring cards to every month', () => {
    const { rows } = project(sample());
    expect(rows.map(r => r.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(rows[0]).toMatchObject({ salary: 250000, income: 0, expenses: 42000, saving: 10000 });
  });

  it('applies a one-time card only to its month', () => {
    const { rows } = project(sample());
    expect(rows.map(r => r.expenses)).toEqual([42000, 42000, 62000, 42000]);
  });

  it('accumulates the cash balance: salary + income - expenses - saving', () => {
    const { rows } = project(sample());
    expect(rows.map(r => r.net)).toEqual([198000, 198000, 178000, 198000]);
    expect(rows.map(r => r.cash)).toEqual([198000, 396000, 574000, 772000]);
  });

  it('accumulates savings, which also leave the cash balance', () => {
    const { rows, totals } = project(sample());
    expect(rows.map(r => r.savings)).toEqual([10000, 20000, 30000, 40000]);
    expect(totals).toMatchObject({ cash: 772000, savings: 40000 });
  });

  it('counts income entries on top of the salary', () => {
    const state = sample();
    state.cards[1].entries.push(entry('gift', 'income', 5000));
    const { rows } = project(state);
    expect(rows[2]).toMatchObject({ income: 5000, net: 183000 });
    expect(rows[1].income).toBe(0);
  });

  it('works with no salary and no cards', () => {
    const { rows, totals } = project(emptyPlanner('2026-01'));
    expect(rows).toHaveLength(12);
    expect(rows.every(r => r.cash === 0 && r.savings === 0)).toBe(true);
    expect(totals).toMatchObject({ cash: 0, savings: 0 });
  });

  it('reports one-time cards outside the chosen months instead of dropping them silently', () => {
    const state = sample();
    state.cards.push({
      id: 'c3',
      type: 'one-time',
      title: 'Far away',
      month: '2030-06',
      entries: [entry('x', 'expense', 999)],
    });
    const { rows, outside } = project(state);
    expect(outside).toEqual(['c3']);
    expect(rows.reduce((sum, r) => sum + r.expenses, 0)).toBe(42000 * 4 + 20000);
  });

  it('does not change the state it is given', () => {
    const state = sample();
    const copy = structuredClone(state);
    project(state);
    expect(state).toEqual(copy);
  });
});

describe('validatePlanner', () => {
  it('accepts the sample plan and an empty plan', () => {
    expect(validatePlanner(sample())).toEqual([]);
    expect(validatePlanner(emptyPlanner('2026-01'))).toEqual([]);
  });

  it('names what is wrong, with a path', () => {
    const state = sample({ salaryCents: 12.5, start: '2026-13', horizon: 0 });
    const paths = validatePlanner(state).map(p => p.path);
    expect(paths).toEqual(expect.arrayContaining(['salaryCents', 'start', 'horizon']));
  });

  it('checks cards and entries', () => {
    const state = sample();
    state.cards[0].type = 'weekly';
    state.cards[1].month = null;
    state.cards[1].entries[0].kind = 'gift';
    state.cards[1].entries[0].amountCents = 'ten';
    const paths = validatePlanner(state).map(p => p.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'cards[0].type',
        'cards[1].month',
        'cards[1].entries[0].kind',
        'cards[1].entries[0].amountCents',
      ]),
    );
  });

  it('rejects duplicate ids and things that are not objects', () => {
    const state = sample();
    state.cards[1].entries[0].id = 'rent';
    expect(validatePlanner(state).map(p => p.path)).toContain('cards[1].entries[0].id');
    expect(validatePlanner(null)).toHaveLength(1);
    expect(validatePlanner({ ...sample(), cards: 'none' }).map(p => p.path)).toContain('cards');
  });
});
