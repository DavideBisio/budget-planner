import { describe, expect, it } from 'vitest';
import { applyHandoff, validateHandoff } from '../../src/core/handoff-apply.js';
import { buildHandoff } from '../../src/core/handoff.js';
import { emptyPlanner, project, validatePlanner } from '../../src/core/planner.js';

// Fictional cards as the import page builds them.
const recurring = (id, payee, kind, amount) => ({
  id,
  type: 'recurring',
  month: null,
  payee,
  category: 'Sample',
  kind,
  perMonth: 1,
  amount,
});
const oneTime = (id, payee, month, kind, amount) => ({
  id,
  type: 'one-time',
  month,
  date: `${month}-10`,
  payee,
  category: 'Sample',
  kind,
  amount,
});

const cards = {
  recurring: [
    recurring('r1', 'Sample Landlord', 'expense', 42000),
    recurring('r2', 'Demo Broker', 'saving', 10000),
  ],
  oneTime: [
    oneTime('o1', 'Demo Trip', '2026-03', 'expense', 20000),
    oneTime('o2', 'Demo Refund', '2026-03', 'income', 3000),
    oneTime('o3', 'Demo Repair', '2026-05', 'expense', 9000),
  ],
};
const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
const payload = (mode = 'replace', source = cards) => buildHandoff(source, months, mode);

const manualPlan = () => ({
  ...emptyPlanner('2025-01'),
  salaryCents: 250000,
  cards: [
    {
      id: 'card-1',
      type: 'recurring',
      title: 'My bills',
      month: null,
      entries: [
        {
          id: 'entry-1',
          label: 'Gym',
          category: '',
          kind: 'expense',
          amountCents: 3000,
          source: 'manual',
        },
      ],
    },
  ],
});

describe('validateHandoff (STOR-6)', () => {
  it('accepts what buildHandoff produces', () => {
    expect(validateHandoff(payload())).toEqual([]);
  });

  it('names what is wrong, with a path', () => {
    const bad = payload();
    bad.version = 2;
    bad.data.mode = 'overwrite';
    bad.data.months = 'all';
    bad.data.cards[0].kind = 'gift';
    bad.data.cards[1].amountCents = 1.5;
    bad.data.cards[2].month = 'March';
    const paths = validateHandoff(bad).map(p => p.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'version',
        'data.mode',
        'data.months',
        'data.cards[0].kind',
        'data.cards[1].amountCents',
        'data.cards[2].month',
      ]),
    );
  });

  it('rejects duplicate card ids and things that are not an envelope', () => {
    const dup = payload();
    dup.data.cards[1].id = dup.data.cards[0].id;
    expect(validateHandoff(dup).map(p => p.path)).toContain('data.cards[1].id');
    expect(validateHandoff(null)).toHaveLength(1);
    expect(validateHandoff({ version: 1 })).toHaveLength(1);
  });
});

describe('applyHandoff, replace (STOR-6)', () => {
  it('drops the current cards and builds new ones, keeping the salary', () => {
    const plan = applyHandoff(manualPlan(), payload('replace'));
    expect(plan.salaryCents).toBe(250000);
    expect(plan.cards.map(c => c.title)).toEqual([
      'Imported recurring',
      'Imported · Mar 26',
      'Imported · May 26',
    ]);
    expect(plan.cards.flatMap(c => c.entries).map(e => e.label)).not.toContain('Gym');
  });

  it('puts recurring entries on one recurring card and one-time entries on a card per month', () => {
    const plan = applyHandoff(manualPlan(), payload('replace'));
    const [monthly, march, may] = plan.cards;
    expect(monthly).toMatchObject({ type: 'recurring', month: null });
    expect(monthly.entries.map(e => e.label)).toEqual(['Sample Landlord', 'Demo Broker']);
    expect(march).toMatchObject({ type: 'one-time', month: '2026-03' });
    expect(march.entries.map(e => e.label)).toEqual(['Demo Trip', 'Demo Refund']);
    expect(may.month).toBe('2026-05');
  });

  it('marks entries as imported and keeps kind, category and amount as the planner shows them', () => {
    const entry = applyHandoff(manualPlan(), payload('replace')).cards[0].entries[1];
    expect(entry).toMatchObject({
      label: 'Demo Broker',
      category: 'Sample',
      kind: 'saving',
      amountCents: 10000,
      source: 'imported',
    });
  });

  it('starts the plan at the first imported month and shows at least all of them', () => {
    const plan = applyHandoff({ ...manualPlan(), horizon: 3 }, payload('replace'));
    expect(plan.start).toBe('2026-01');
    expect(plan.horizon).toBeGreaterThanOrEqual(5);
    const many = buildHandoff(
      cards,
      Array.from({ length: 14 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`),
      'replace',
    );
    expect(applyHandoff({ ...manualPlan(), horizon: 6 }, many).horizon).toBeGreaterThanOrEqual(14);
  });

  it('gives a result that is a valid plan and projects the imported months', () => {
    const plan = applyHandoff(manualPlan(), payload('replace'));
    expect(validatePlanner(plan)).toEqual([]);
    const { rows, outside } = project(plan);
    expect(outside).toEqual([]);
    expect(rows[2].expenses).toBe(42000 + 20000);
  });

  it('handles a payload with no cards', () => {
    const plan = applyHandoff(manualPlan(), payload('replace', { recurring: [], oneTime: [] }));
    expect(plan.cards).toEqual([]);
  });

  it('does not change the plan it is given', () => {
    const before = manualPlan();
    const copy = structuredClone(before);
    applyHandoff(before, payload('replace'));
    expect(before).toEqual(copy);
  });
});

describe('applyHandoff, merge (STOR-6)', () => {
  it('keeps the current cards and adds the new ones', () => {
    const plan = applyHandoff(manualPlan(), payload('merge'));
    expect(plan.cards[0].title).toBe('My bills');
    expect(plan.cards[0].entries.map(e => e.label)).toEqual(['Gym']);
    expect(plan.cards.map(c => c.title)).toEqual([
      'My bills',
      'Imported recurring',
      'Imported · Mar 26',
      'Imported · May 26',
    ]);
    expect(validatePlanner(plan)).toEqual([]);
  });

  it('keeps the start of the plan and does not shrink it', () => {
    const plan = applyHandoff(manualPlan(), payload('merge'));
    expect(plan.start).toBe('2025-01');
    expect(plan.horizon).toBeGreaterThanOrEqual(12);
  });

  it('merging the same payload twice adds nothing the second time', () => {
    const once = applyHandoff(manualPlan(), payload('merge'));
    const twice = applyHandoff(once, payload('merge'));
    expect(twice).toEqual(once);
  });

  it('adds only the cards that are new and puts them on the existing imported card', () => {
    const once = applyHandoff(manualPlan(), payload('merge'));
    const more = {
      recurring: [...cards.recurring, recurring('r3', 'Demo Gym', 'expense', 3500)],
      oneTime: cards.oneTime,
    };
    const next = applyHandoff(once, payload('merge', more));
    const imported = next.cards.find(c => c.title === 'Imported recurring');
    expect(imported.entries.map(e => e.label)).toEqual([
      'Sample Landlord',
      'Demo Broker',
      'Demo Gym',
    ]);
    expect(next.cards).toHaveLength(once.cards.length);
  });

  it('does not bring back an entry the person moved to another card', () => {
    const once = applyHandoff(manualPlan(), payload('merge'));
    const landlord = once.cards[1].entries[0];
    once.cards[0].entries.push(landlord);
    once.cards[1].entries = once.cards[1].entries.slice(1);
    const next = applyHandoff(once, payload('merge'));
    expect(next.cards.flatMap(c => c.entries).filter(e => e.id === landlord.id)).toHaveLength(1);
  });

  it('keeps entry ids unique across plan and import', () => {
    const plan = applyHandoff(manualPlan(), payload('merge'));
    const ids = plan.cards.flatMap(c => [c.id, ...c.entries.map(e => e.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
