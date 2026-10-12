// Step 3 (IMP-6): date range, own-account transfers and exclusions, with what each one removes.
import { h, uid, fill } from '../dom.js';
import { formatCents } from '../format.js';
import { createPatternList } from '../pattern-list.js';
import { errorsIn, updateConfig } from './config-edit.js';

const REASONS = [
  ['range', 'Outside the date range'],
  ['exclude', 'Excluded by a pattern'],
  ['own', 'Own-account transfers'],
];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function dateField(label, name, set) {
  const id = uid('filter');
  const control = h('input', { type: 'date', id, oninput: event => set(event.target.value) });
  const error = h('span', { class: 'error', id: `${id}-error`, hidden: true });
  control.setAttribute('aria-describedby', error.id);
  const node = h(
    'div',
    { class: 'field' },
    h('label', { for: id }, label),
    control,
    h('span', { class: 'hint' }, 'Leave empty for no limit.'),
    error,
  );
  return { name, control, error, node };
}

export function mountFiltering(body, store, results) {
  const state = () => store.get();
  const set = (key, value) => updateConfig(store, ['filter', key], value);
  const removedBy = (reason, pattern) =>
    state().filtered.removed.filter(r => r.reason === reason && r.pattern === pattern).length;

  const span = h('p', { class: 'hint' });
  const dates = [
    dateField('First day to keep', 'from', v => set('from', v)),
    dateField('Last day to keep', 'to', v => set('to', v)),
  ];

  const ownId = uid('filter');
  const ownToggle = h('input', {
    type: 'checkbox',
    id: ownId,
    onchange: event => set('ownTransfers', event.target.checked),
  });

  const lists = {
    own: createPatternList({
      label: 'Own-account transfer patterns',
      addLabel: 'Add an own-transfer pattern',
      get: () => state().config.filter.own,
      set: patterns => set('own', patterns),
      texts: () => state().transactions.map(t => t.desc),
      info: pattern =>
        state().config.filter.ownTransfers
          ? `Removes ${plural(removedBy('own', pattern), 'row')}`
          : 'Not used while own-account transfers are kept.',
    }),
    exclude: createPatternList({
      label: 'Exclusion patterns',
      addLabel: 'Add an exclusion pattern',
      get: () => state().config.filter.exclude,
      set: patterns => set('exclude', patterns),
      texts: () => state().transactions.map(t => t.desc),
      info: pattern => `Removes ${plural(removedBy('exclude', pattern), 'row')}`,
    }),
  };

  body.append(
    span,
    h('fieldset', { class: 'group' }, h('legend', {}, 'Date range'), ...dates.map(d => d.node)),
    h(
      'div',
      { class: 'check' },
      ownToggle,
      h('label', { for: ownId }, 'Remove transfers between my own accounts'),
    ),
    lists.own.node,
    lists.exclude.node,
  );

  const summary = results.card('filtering', 'Filtering');

  function renderResult({ transactions, filtered }) {
    results.show('filtering', transactions.length > 0);
    const { counts } = filtered;
    fill(
      summary,
      h(
        'p',
        { class: 'match-count' },
        `${filtered.kept.length} of ${transactions.length} rows kept`,
      ),
      ...REASONS.filter(([reason]) => counts[reason] > 0).map(([reason, title]) =>
        h(
          'details',
          {},
          h('summary', {}, `${title}: ${plural(counts[reason], 'row')} removed`),
          h(
            'ul',
            { class: 'plain' },
            filtered.examples[reason].map(tx =>
              h('li', {}, `${tx.date} · ${formatCents(tx.amount)} · ${tx.desc}`),
            ),
            counts[reason] > filtered.examples[reason].length
              ? h(
                  'li',
                  { class: 'hint' },
                  `and ${counts[reason] - filtered.examples[reason].length} more`,
                )
              : null,
          ),
        ),
      ),
    );
  }

  store.subscribe(current => {
    const { filter } = current.config;
    const errors = errorsIn(current.config, 'filter');
    for (const { name, control, error } of dates) {
      if (control.value !== filter[name]) control.value = filter[name];
      const message = errors.find(e => e.path === `filter.${name}`)?.message ?? '';
      error.textContent = message;
      error.hidden = !message;
      if (message) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    }
    ownToggle.checked = filter.ownTransfers;

    const dayList = current.transactions.map(t => t.date).sort();
    span.textContent = dayList.length
      ? `Your files cover ${dayList[0]} to ${dayList.at(-1)}.`
      : 'Import files to see the dates they cover.';
    lists.own.refresh();
    lists.exclude.refresh();
    renderResult(current);
  });
}
