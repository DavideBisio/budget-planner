import { describe, expect, it } from 'vitest';
import {
  addCard,
  addEntry,
  addMonths,
  emptyPlanner,
  monthRange,
  moveEntry,
  project,
  removeCard,
  removeEntry,
  updateCard,
  updateEntry,
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

describe('editing cards and entries (PLAN-3)', () => {
  it('adds a recurring card with a fresh id and leaves the old state alone', () => {
    const before = sample();
    const copy = structuredClone(before);
    const after = addCard(before, { type: 'recurring', title: 'Bills' });
    expect(before).toEqual(copy);
    expect(after.cards).toHaveLength(3);
    expect(after.cards[2]).toEqual({
      id: expect.any(String),
      type: 'recurring',
      title: 'Bills',
      month: null,
      entries: [],
    });
    expect(after.cards.map(c => c.id)).toEqual(['c1', 'c2', after.cards[2].id]);
  });

  it('gives a one-time card the month it was given, and the start month by default', () => {
    const state = addCard(addCard(sample(), { type: 'one-time', title: 'A', month: '2026-02' }), {
      type: 'one-time',
      title: 'B',
    });
    expect(state.cards[2].month).toBe('2026-02');
    expect(state.cards[3].month).toBe('2026-01');
  });

  it('never reuses an id, even after a delete', () => {
    let state = addCard(emptyPlanner('2026-01'), { type: 'recurring', title: 'A' });
    const first = state.cards[0].id;
    state = addCard(state, { type: 'recurring', title: 'B' });
    state = removeCard(state, first);
    state = addCard(state, { type: 'recurring', title: 'C' });
    expect(new Set(state.cards.map(c => c.id)).size).toBe(2);
    expect(validatePlanner(state)).toEqual([]);
  });

  it('renames a card and changes the month of a one-time card', () => {
    const state = updateCard(sample(), 'c2', { title: 'Trip', month: '2026-04' });
    expect(state.cards[1]).toMatchObject({ title: 'Trip', month: '2026-04' });
    expect(project(state).rows[3].expenses).toBe(62000);
  });

  it('ignores a month given to a recurring card', () => {
    expect(updateCard(sample(), 'c1', { month: '2026-04' }).cards[0].month).toBeNull();
  });

  it('removes a card with its entries', () => {
    const state = removeCard(sample(), 'c2');
    expect(state.cards.map(c => c.id)).toEqual(['c1']);
  });

  it('adds a manual entry to a card', () => {
    const state = addEntry(sample(), 'c1', {
      label: 'Gym',
      kind: 'expense',
      amountCents: 3000,
    });
    const added = state.cards[0].entries.at(-1);
    expect(added).toMatchObject({
      label: 'Gym',
      kind: 'expense',
      amountCents: 3000,
      category: '',
      source: 'manual',
    });
    expect(validatePlanner(state)).toEqual([]);
  });

  it('edits and removes an entry wherever it is', () => {
    let state = updateEntry(sample(), 'trip', { amountCents: 30000, label: 'Big trip' });
    expect(state.cards[1].entries[0]).toMatchObject({ amountCents: 30000, label: 'Big trip' });
    state = removeEntry(state, 'rent');
    expect(state.cards[0].entries.map(e => e.id)).toEqual(['piggy']);
  });

  it('keeps the source of an entry when it is edited', () => {
    const state = sample();
    state.cards[0].entries[0].source = 'imported';
    expect(
      updateEntry(state, 'rent', { source: 'manual', label: 'Rent' }).cards[0].entries[0].source,
    ).toBe('imported');
  });

  it('leaves the state as it is for an unknown id', () => {
    const state = sample();
    expect(updateEntry(state, 'nope', { label: 'x' })).toEqual(state);
    expect(removeCard(state, 'nope')).toEqual(state);
    expect(addEntry(state, 'nope', { label: 'x', kind: 'expense', amountCents: 1 })).toEqual(state);
  });
});

describe('moveEntry (PLAN-7)', () => {
  it('moves an entry to the end of another card and keeps it as it was', () => {
    const state = sample();
    state.cards[0].entries[0].source = 'imported';
    const moved = moveEntry(state, 'rent', 'c2');
    expect(moved.cards[0].entries.map(e => e.id)).toEqual(['piggy']);
    expect(moved.cards[1].entries.map(e => e.id)).toEqual(['trip', 'rent']);
    expect(moved.cards[1].entries[1]).toEqual(state.cards[0].entries[0]);
  });

  it('changes the projection: a rent moved to a one-time card is paid once', () => {
    const moved = moveEntry(sample(), 'rent', 'c2');
    expect(project(moved).rows.map(r => r.expenses)).toEqual([0, 0, 62000, 0]);
  });

  it('does not change the state it is given', () => {
    const state = sample();
    const copy = structuredClone(state);
    moveEntry(state, 'rent', 'c2');
    expect(state).toEqual(copy);
  });

  it('does nothing for the same card or an unknown entry or card', () => {
    const state = sample();
    expect(moveEntry(state, 'rent', 'c1')).toEqual(state);
    expect(moveEntry(state, 'nope', 'c2')).toEqual(state);
    expect(moveEntry(state, 'rent', 'nope')).toEqual(state);
  });
});

describe('withdrawals (PLAN-6)', () => {
  const withdrawal = amountCents => {
    const state = sample();
    state.cards[0].entries = [entry('w', 'saving', amountCents)];
    return state;
  };

  it('a negative saving puts money back into cash and takes it out of savings', () => {
    const { rows } = project(withdrawal(-30000));
    expect(rows.map(r => r.savings)).toEqual([-30000, -60000, -90000, -120000]);
    expect(rows[0].net).toBe(250000 + 30000);
  });

  it('never clamps savings at zero and reports the first month below zero', () => {
    const state = sample();
    state.cards[0].entries = [entry('put', 'saving', 50000)];
    state.cards[1].entries = [entry('take', 'saving', -170000)]; // taken out in March
    const { rows, warnings } = project(state);
    expect(rows.map(r => r.savings)).toEqual([50000, 100000, -20000, 30000]);
    expect(warnings.savingsBelowZero).toEqual({ month: '2026-03', lowest: -20000 });
  });

  it('reports the lowest value, not the first', () => {
    const { warnings } = project(withdrawal(-30000));
    expect(warnings.savingsBelowZero).toEqual({ month: '2026-01', lowest: -120000 });
  });

  it('has no warning while savings stay at or above zero', () => {
    expect(project(sample()).warnings.savingsBelowZero).toBeNull();
    const zero = withdrawal(0);
    expect(project(zero).warnings.savingsBelowZero).toBeNull();
  });
});
