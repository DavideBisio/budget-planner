// The balance summary that stays in view on a phone, and the totals card (PLAN-4, PLAN-5).
import { monthLabel } from '../../core/chart.js';
import { h } from '../dom.js';
import { formatCents } from '../format.js';

/** The sentence that warns about negative savings, or an empty text when there is nothing to warn about. */
export function savingsWarning({ warnings }) {
  const low = warnings.savingsBelowZero;
  return low
    ? `Savings go below zero from ${monthLabel(low.month)} (lowest ${formatCents(low.lowest)}).`
    : '';
}

export function mountSummary(summary, totals, store) {
  function render({ plan, projection }) {
    const t = projection.totals;
    summary.replaceChildren(
      h(
        'span',
        { class: 'summary-item' },
        `Cash after ${plan.horizon} months: ${formatCents(t.cash)}`,
      ),
      h('span', { class: 'summary-item' }, `Savings: ${formatCents(t.savings)}`),
      savingsWarning(projection) &&
        h('span', { class: 'warning', role: 'status' }, savingsWarning(projection)),
    );
    const row = (label, cents) =>
      h('div', { class: 'total-row' }, h('dt', {}, label), h('dd', {}, formatCents(cents)));
    totals.replaceChildren(
      h(
        'dl',
        { class: 'totals' },
        row('Salary', plan.salaryCents * plan.horizon),
        row('Other income', t.income),
        row('Expenses', t.expenses),
        row('Saved', t.saving),
        row('Net cash', t.net),
        row('Cash at the end', t.cash),
        row('Savings at the end', t.savings),
      ),
    );
  }
  store.subscribe(render);
}
