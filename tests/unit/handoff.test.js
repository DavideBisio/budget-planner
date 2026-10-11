import { describe, expect, it } from 'vitest';
import { HANDOFF_VERSION, buildHandoff, cardId, describeHandoff } from '../../src/core/handoff.js';

const cards = {
  recurring: [
    {
      id: 'in|ACME|150000',
      type: 'recurring',
      month: null,
      payee: 'Acme',
      category: 'Salary',
      kind: 'income',
      perMonth: 1,
      flow: 150000,
      amount: 150000,
      transactionIds: ['t1', 't2'],
    },
    {
      id: 'out|BROKER|-20000',
      type: 'recurring',
      month: null,
      payee: 'Broker',
      category: 'Investments',
      kind: 'saving',
      perMonth: 1,
      flow: -20000,
      amount: 20000,
      transactionIds: ['t3', 't4'],
    },
  ],
  oneTime: [
    {
      id: '2026-01-09|-1990|Cafe#1',
      type: 'one-time',
      month: '2026-01',
      date: '2026-01-09',
      payee: 'Cafe',
      category: 'Other expenses',
      kind: 'expense',
      flow: -1990,
      amount: 1990,
      transactionIds: ['2026-01-09|-1990|Cafe#1'],
    },
  ],
  totals: { byKind: { income: 300000, expense: 3980, saving: 40000 }, byCategory: [], net: 256020 },
};

describe('buildHandoff (STOR-6)', () => {
  it('builds a versioned payload with one entry per card', () => {
    const payload = buildHandoff(cards, ['2026-01', '2026-02'], 'replace');
    expect(payload.version).toBe(HANDOFF_VERSION);
    expect(payload.data.mode).toBe('replace');
    expect(payload.data.months).toEqual(['2026-01', '2026-02']);
    expect(payload.data.cards).toEqual([
      {
        id: cardId('in|ACME|150000'),
        type: 'recurring',
        kind: 'income',
        category: 'Salary',
        label: 'Acme',
        amountCents: 150000,
        perMonth: 1,
      },
      {
        id: cardId('out|BROKER|-20000'),
        type: 'recurring',
        kind: 'saving',
        category: 'Investments',
        label: 'Broker',
        amountCents: 20000,
        perMonth: 1,
      },
      {
        id: cardId('2026-01-09|-1990|Cafe#1'),
        type: 'one-time',
        kind: 'expense',
        category: 'Other expenses',
        label: 'Cafe',
        amountCents: 1990,
        month: '2026-01',
      },
    ]);
  });

  it('accepts merge and rejects any other mode', () => {
    expect(buildHandoff(cards, [], 'merge').data.mode).toBe('merge');
    expect(() => buildHandoff(cards, [], 'append')).toThrow(/mode/i);
  });

  it('carries no transaction detail, only what the planner needs', () => {
    const text = JSON.stringify(buildHandoff(cards, [], 'replace'));
    expect(text).not.toContain('transactionIds');
    expect(text).not.toContain('t1');
    expect(text).not.toContain('flow');
  });

  it('survives a JSON round trip unchanged', () => {
    const payload = buildHandoff(cards, ['2026-01'], 'merge');
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it('handles no cards', () => {
    const empty = { recurring: [], oneTime: [], totals: cards.totals };
    expect(buildHandoff(empty, [], 'replace').data.cards).toEqual([]);
  });
});

describe('cardId (STOR-6)', () => {
  it('is stable, short and distinct for distinct cards', () => {
    expect(cardId('in|ACME|150000')).toBe(cardId('in|ACME|150000'));
    expect(cardId('in|ACME|150000')).not.toBe(cardId('in|ACME|150001'));
    expect(cardId('in|ACME|150000')).toMatch(/^[0-9a-z]{6,14}$/);
  });

  it('does not repeat the text it was made from, so bank descriptions stay out of the payload', () => {
    const id = cardId('2026-01-09|-1990|Paid to Corner Cafe ref 77#1');
    expect(id).not.toMatch(/Paid|Cafe|2026/i);
    const payload = buildHandoff(
      {
        recurring: [],
        oneTime: [{ ...cards.oneTime[0], id: '2026-01-09|-1990|Paid to Corner Cafe#1' }],
      },
      [],
      'replace',
    );
    expect(JSON.stringify(payload)).not.toContain('Paid to');
  });
});

describe('describeHandoff (IMP-12)', () => {
  it('says what replacing will do', () => {
    expect(describeHandoff(cards, 'replace')).toBe(
      'The planner’s current cards will be replaced by 2 recurring cards and 1 one-time card.',
    );
  });

  it('says what merging will do', () => {
    expect(describeHandoff(cards, 'merge')).toBe(
      '2 recurring cards and 1 one-time card will be added to the planner. Cards already there stay.',
    );
  });

  it('uses singular and zero correctly', () => {
    const one = { recurring: [cards.recurring[0]], oneTime: [], totals: cards.totals };
    expect(describeHandoff(one, 'merge')).toMatch(/^1 recurring card and 0 one-time cards/);
  });
});
