/**
 * The planner model (PLAN-1, 2, 4, 5, 6): a monthly projection of cash and savings. Pure functions,
 * no DOM. Money is integer cents.
 *
 * State shape (stored with schema version 1):
 *   { salaryCents, start: 'YYYY-MM', horizon: months shown,
 *     cards: [{ id, type: 'recurring' | 'one-time', title, month: 'YYYY-MM' | null,
 *               entries: [{ id, label, category, kind: 'income' | 'expense' | 'saving',
 *                           amountCents, source: 'imported' | 'manual' }] }] }
 *
 * `amountCents` is the figure the user sees: income and expenses are positive, and a saving is
 * positive for money put aside and negative for a withdrawal (ENG-9).
 */

export const PLANNER_VERSION = 1;
export const DEFAULT_HORIZON = 12;

/** The month `count` months after `month` (YYYY-MM); negative counts go back. */
export function addMonths(month, count) {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** `count` consecutive months starting at `start`. */
export const monthRange = (start, count) =>
  Array.from({ length: count }, (_, i) => addMonths(start, i));

/** An empty plan: no salary, no cards. */
export const emptyPlanner = start => ({
  salaryCents: 0,
  start,
  horizon: DEFAULT_HORIZON,
  cards: [],
});

const sumKind = (card, kind) =>
  card.entries.filter(e => e.kind === kind).reduce((sum, e) => sum + e.amountCents, 0);

/**
 * Project the plan month by month. Cash changes by salary + income - expenses - saving; savings
 * change by the saving amount. Nothing is clamped: a negative balance is a result, not an error.
 *
 * @returns {{rows: {month: string, salary: number, income: number, expenses: number,
 *   saving: number, net: number, cash: number, savings: number}[],
 *   totals: {income: number, expenses: number, saving: number, net: number, cash: number,
 *     savings: number},
 *   outside: string[]}} `outside` lists the one-time cards whose month is not shown.
 */
export function project(state) {
  const months = monthRange(state.start, state.horizon);
  const shown = new Set(months);
  const monthly = { income: 0, expenses: 0, saving: 0 };
  const oneTime = new Map(months.map(m => [m, { income: 0, expenses: 0, saving: 0 }]));
  const outside = [];

  for (const card of state.cards) {
    const parts = {
      income: sumKind(card, 'income'),
      expenses: sumKind(card, 'expense'),
      saving: sumKind(card, 'saving'),
    };
    if (card.type === 'recurring') {
      for (const key of Object.keys(monthly)) monthly[key] += parts[key];
    } else if (shown.has(card.month)) {
      const bucket = oneTime.get(card.month);
      for (const key of Object.keys(bucket)) bucket[key] += parts[key];
    } else {
      outside.push(card.id);
    }
  }

  let cash = 0;
  let savings = 0;
  const totals = { income: 0, expenses: 0, saving: 0, net: 0 };
  const rows = months.map(month => {
    const extra = oneTime.get(month);
    const income = monthly.income + extra.income;
    const expenses = monthly.expenses + extra.expenses;
    const saving = monthly.saving + extra.saving;
    const net = state.salaryCents + income - expenses - saving;
    cash += net;
    savings += saving;
    totals.income += income;
    totals.expenses += expenses;
    totals.saving += saving;
    totals.net += net;
    return { month, salary: state.salaryCents, income, expenses, saving, net, cash, savings };
  });
  return { rows, totals: { ...totals, cash, savings }, outside };
}

const KINDS = ['income', 'expense', 'saving'];
const TYPES = ['recurring', 'one-time'];
const SOURCES = ['imported', 'manual'];
const isMonth = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const isText = value => typeof value === 'string' && value !== '';

/**
 * Check a planner state, for example one read from storage or from a backup file. Returns a list
 * of `{path, message}` and never throws; an empty list means the state can be used.
 */
export function validatePlanner(state) {
  const problems = [];
  const fail = (path, message) => problems.push({ path, message });
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    fail('', 'The planner state must be an object');
    return problems;
  }
  if (!Number.isInteger(state.salaryCents)) fail('salaryCents', 'The salary must be whole cents');
  if (!isMonth(state.start)) fail('start', 'The first month must look like 2026-01');
  if (!Number.isInteger(state.horizon) || state.horizon < 1 || state.horizon > 120) {
    fail('horizon', 'The number of months must be between 1 and 120');
  }
  if (!Array.isArray(state.cards)) {
    fail('cards', 'The cards must be a list');
    return problems;
  }
  const ids = new Set();
  const unique = (path, id) => {
    if (!isText(id)) fail(path, 'An id is required');
    else if (ids.has(id)) fail(path, `The id "${id}" is used twice`);
    else ids.add(id);
  };
  state.cards.forEach((card, i) => {
    const at = `cards[${i}]`;
    unique(`${at}.id`, card?.id);
    if (!TYPES.includes(card?.type)) fail(`${at}.type`, 'The type must be recurring or one-time');
    if (typeof card?.title !== 'string') fail(`${at}.title`, 'The title must be text');
    if (card?.type === 'one-time' && !isMonth(card.month)) {
      fail(`${at}.month`, 'A one-time card needs a month such as 2026-03');
    }
    if (!Array.isArray(card?.entries)) {
      fail(`${at}.entries`, 'The entries must be a list');
      return;
    }
    card.entries.forEach((entry, j) => {
      const path = `${at}.entries[${j}]`;
      unique(`${path}.id`, entry?.id);
      if (typeof entry?.label !== 'string') fail(`${path}.label`, 'The label must be text');
      if (!KINDS.includes(entry?.kind))
        fail(`${path}.kind`, 'The kind must be income, expense or saving');
      if (!Number.isInteger(entry?.amountCents))
        fail(`${path}.amountCents`, 'The amount must be whole cents');
      if (!SOURCES.includes(entry?.source))
        fail(`${path}.source`, 'The source must be imported or manual');
    });
  });
  return problems;
}
