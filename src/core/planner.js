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
