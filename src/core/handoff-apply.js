/**
 * The planner side of the handoff (STOR-6): check a payload from the import page and apply it to a
 * plan. The payload is built by `buildHandoff` (core/handoff.js); its schema is documented in
 * docs/ARCHITECTURE.md. Pure functions: nothing here touches storage.
 */
import { monthLabel } from './chart.js';
import { HANDOFF_VERSION } from './handoff.js';
import { nextId } from './planner.js';

const KINDS = ['income', 'expense', 'saving'];
const TYPES = ['recurring', 'one-time'];
const HORIZONS = [6, 12, 24, 36];
const RECURRING_TITLE = 'Imported recurring';
const isMonth = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/**
 * Check a payload. Returns a list of `{path, message}` and never throws; an empty list means the
 * payload can be applied. A payload with problems must be discarded whole, never applied in part.
 */
export function validateHandoff(payload) {
  const problems = [];
  const fail = (path, message) => problems.push({ path, message });
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    fail('', 'The payload must be an object with a version and data');
    return problems;
  }
  if (payload.version !== HANDOFF_VERSION)
    fail('version', `Only version ${HANDOFF_VERSION} is understood`);
  const { data } = payload;
  if (!data || typeof data !== 'object') {
    fail('data', 'The data must be an object');
    return problems;
  }
  if (!['replace', 'merge'].includes(data.mode))
    fail('data.mode', 'The mode must be replace or merge');
  if (!Array.isArray(data.months) || !data.months.every(isMonth)) {
    fail('data.months', 'The months must be a list such as 2026-01');
  }
  if (!Array.isArray(data.cards)) {
    fail('data.cards', 'The cards must be a list');
    return problems;
  }
  const ids = new Set();
  data.cards.forEach((card, i) => {
    const at = `data.cards[${i}]`;
    if (typeof card?.id !== 'string' || card.id === '') fail(`${at}.id`, 'An id is required');
    else if (ids.has(card.id)) fail(`${at}.id`, `The id "${card.id}" is used twice`);
    else ids.add(card.id);
    if (!TYPES.includes(card?.type)) fail(`${at}.type`, 'The type must be recurring or one-time');
    if (!KINDS.includes(card?.kind))
      fail(`${at}.kind`, 'The kind must be income, expense or saving');
    if (typeof card?.category !== 'string') fail(`${at}.category`, 'The category must be text');
    if (typeof card?.label !== 'string') fail(`${at}.label`, 'The label must be text');
    if (!Number.isInteger(card?.amountCents))
      fail(`${at}.amountCents`, 'The amount must be whole cents');
    if (card?.type === 'one-time' && !isMonth(card.month)) {
      fail(`${at}.month`, 'A one-time card needs a month such as 2026-03');
    }
  });
  return problems;
}

/** The smallest of the usual month counts that shows `count` months, else `count` itself. */
const horizonFor = count => HORIZONS.find(n => n >= count) ?? Math.min(count, 120);

const allIds = plan => new Set(plan.cards.flatMap(card => card.entries.map(entry => entry.id)));

/**
 * Apply a valid payload. Replace drops every current card and starts the plan at the first
 * imported month; merge keeps the cards and the start and adds only the entries whose id is not
 * in the plan yet, so applying the same payload twice changes nothing the second time. Imported
 * entries go on a card called "Imported recurring" or "Imported · Mar 26"; the salary is kept.
 */
export function applyHandoff(plan, payload) {
  const { mode, months, cards } = payload.data;
  let state = {
    ...plan,
    cards: mode === 'replace' ? [] : structuredClone(plan.cards),
  };
  if (mode === 'replace' && months.length > 0) state.start = [...months].sort()[0];
  state.horizon = horizonFor(Math.max(plan.horizon, months.length));

  const known = allIds(state);
  for (const card of cards) {
    const entryId = `imp-${card.id}`;
    if (known.has(entryId)) continue;
    known.add(entryId);

    const recurring = card.type === 'recurring';
    const title = recurring ? RECURRING_TITLE : `Imported · ${monthLabel(card.month)}`;
    let target = state.cards.find(
      c => c.type === card.type && c.title === title && (recurring || c.month === card.month),
    );
    if (!target) {
      target = {
        id: nextId(state, 'card'),
        type: card.type,
        title,
        month: recurring ? null : card.month,
        entries: [],
      };
      state = { ...state, cards: [...state.cards, target] };
    }
    target.entries.push({
      id: entryId,
      label: card.label,
      category: card.category,
      kind: card.kind,
      amountCents: card.amountCents,
      source: 'imported',
    });
  }
  return state;
}
