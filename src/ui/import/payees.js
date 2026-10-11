// Step 4 (IMP-7): how the counterparty is read from each description, in order, with a test panel.
import { h, uid } from '../dom.js';
import { formatCents } from '../format.js';
import { createPatternList } from '../pattern-list.js';
import { updateConfig } from './config-edit.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const MAX_TEST_ROWS = 500;
const TOP_PAYEES = 8;

const SOURCES = [
  ['pattern', 'Read by a pattern'],
  ['type', 'Type column'],
  ['description', 'First words of the description'],
];

const describeSource = tx =>
  ({
    pattern: `found by pattern ${tx.payeeRule + 1}`,
    type: 'taken from the Type column',
    description: 'taken from the first words of the description',
  })[tx.payeeSource];

export function mountPayees(body, store, results) {
  const state = () => store.get();

  const list = createPatternList({
    label: 'Payee patterns',
    addLabel: 'Add a payee pattern',
    capture: true,
    reorder: true,
    get: () => state().config.payees,
    set: patterns => updateConfig(store, ['payees'], patterns),
    texts: () => state().filtered.kept.map(t => t.desc),
    info: (_, index) =>
      `Used for ${plural(state().payeed.filter(t => t.payeeRule === index).length, 'transaction')}`,
  });

  const pickId = uid('payee-test');
  const pick = h('select', { id: pickId, onchange: () => showPayee() });
  const outcome = h('p', { role: 'status' });
  const tryPanel = h(
    'fieldset',
    { class: 'group' },
    h('legend', {}, 'Try a transaction'),
    h(
      'div',
      { class: 'field' },
      h('label', { for: pickId }, 'Transaction'),
      pick,
      h('span', { class: 'hint' }, 'See which payee the patterns above give it.'),
    ),
    outcome,
  );
  body.append(list.node, tryPanel);

  const summary = results.card('payees', 'Payees');
  let shown = [];

  function showPayee() {
    const tx = shown[pick.selectedIndex];
    outcome.textContent = tx
      ? `Payee: ${tx.payee} · ${describeSource(tx)}`
      : 'Import files to try a transaction.';
  }

  function renderPick(payeed) {
    const rows = payeed.slice(0, MAX_TEST_ROWS);
    const same =
      rows.length === shown.length &&
      rows.every((tx, i) => tx.id === shown[i].id && tx.file === shown[i].file);
    const keep = pick.selectedIndex;
    if (!same) {
      pick.replaceChildren(
        ...rows.map(tx => h('option', {}, `${tx.date} · ${formatCents(tx.amount)} · ${tx.desc}`)),
      );
      if (keep >= 0 && keep < rows.length) pick.selectedIndex = keep;
    }
    shown = rows;
    showPayee();
  }

  function renderResult({ payeed }) {
    results.show('payees', payeed.length > 0);
    const bySource = source => payeed.filter(t => t.payeeSource === source).length;
    const missing = payeed.length - bySource('pattern');
    const counts = new Map();
    for (const tx of payeed) {
      const entry = counts.get(tx.payeeKey) ?? { name: tx.payee, n: 0 };
      entry.n += 1;
      counts.set(tx.payeeKey, entry);
    }
    const top = [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    summary.replaceChildren(
      h(
        'ul',
        { class: 'plain' },
        ...SOURCES.map(([source, title]) => h('li', {}, `${title}: ${bySource(source)}`)),
        h('li', { class: 'match-count' }, `No payee extracted: ${missing}`),
      ),
      h(
        'p',
        { class: 'hint' },
        `${plural(counts.size, 'distinct payee')} in ${plural(payeed.length, 'transaction')}.`,
      ),
      top.length
        ? h(
            'details',
            {},
            h('summary', {}, `Most frequent payees`),
            h(
              'ul',
              { class: 'plain' },
              top.slice(0, TOP_PAYEES).map(p => h('li', {}, `${p.name}: ${p.n}`)),
            ),
          )
        : null,
    );
  }

  store.subscribe(current => {
    list.refresh();
    renderPick(current.payeed);
    renderResult(current);
  });
}
