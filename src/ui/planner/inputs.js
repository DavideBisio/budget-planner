// The inputs card (PLAN-1): salary, first month and how many months to show.
import { parseCents } from '../../core/money.js';
import { h, uid } from '../dom.js';
import { formatCents } from '../format.js';

const HORIZONS = [6, 12, 24, 36];

export function mountInputs(root, store) {
  const { plan } = store.get();
  const salaryId = uid('salary');
  const errorId = uid('salary-error');
  const salary = h('input', {
    id: salaryId,
    type: 'text',
    inputMode: 'decimal',
    autocomplete: 'off',
    'aria-describedby': errorId,
    value: formatCents(plan.salaryCents),
    oninput: () => {
      const cents = parseCents(salary.value);
      const bad = cents === null || cents < 0;
      if (bad) salary.setAttribute('aria-invalid', 'true');
      else salary.removeAttribute('aria-invalid');
      error.hidden = !bad;
      if (!bad) store.update(p => (p.salaryCents = cents));
    },
  });
  const error = h(
    'span',
    { class: 'error', id: errorId, hidden: true },
    'Type an amount such as 2500 or 2500.50',
  );

  const startId = uid('start');
  const start = h('input', {
    id: startId,
    type: 'month',
    value: plan.start,
    onchange: () => {
      if (/^\d{4}-\d{2}$/.test(start.value)) store.update(p => (p.start = start.value));
    },
  });

  const horizonId = uid('horizon');
  const horizon = h(
    'select',
    {
      id: horizonId,
      onchange: () => store.update(p => (p.horizon = Number(horizon.value))),
    },
    [...new Set([...HORIZONS, plan.horizon])]
      .sort((a, b) => a - b)
      .map(n => h('option', { value: String(n), selected: n === plan.horizon }, `${n}`)),
  );

  root.append(
    h('div', { class: 'field' }, h('label', { for: salaryId }, 'Monthly salary'), salary, error),
    h('div', { class: 'field' }, h('label', { for: startId }, 'First month'), start),
    h('div', { class: 'field' }, h('label', { for: horizonId }, 'Months shown'), horizon),
  );
}
