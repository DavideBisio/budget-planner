// The result list (IMP-10, IMP-11): recurring, one-time and ignored entries, a details popover
// per entry for debugging the configuration, and manual overrides by transaction or payee.
import { withOverride } from '../../core/overrides.js';
import { h, uid } from '../dom.js';
import { formatCents } from '../format.js';
import { initPopovers } from '../popover.js';

const MAX_DETAILS = 5;
const TABS = [
  ['recurring', 'Recurring'],
  ['oneTime', 'One-time'],
  ['ignored', 'Ignored'],
];
const KINDS = [
  ['income', 'Income'],
  ['saving', 'Saving'],
  ['expense', 'Expense'],
];
const KIND_LABEL = Object.fromEntries(KINDS);
const SOURCE = {
  pattern: tx => `found by pattern ${tx.payeeRule + 1}`,
  type: () => 'taken from the Type column',
  description: () => 'taken from the first words of the description',
};
const CLEARED = { category: undefined, kind: undefined, ignore: undefined };

export function mountResult(store, results) {
  const state = () => store.get();
  let active = 'recurring';
  const editing = new Set();
  const scopeChoice = new Map();

  // ---- changing things ---------------------------------------------------------------------
  const commit = overrides => store.set({ overrides });
  const entryKey = row => (row.recurring ? row.payeeKey : row.txs[0].id);

  function change(row, patch) {
    const wantsPayee = row.recurring || scopeChoice.get(row.key) === 'payee';
    const scope = wantsPayee ? 'payees' : 'transactions';
    commit(
      withOverride(state().overrides, scope, wantsPayee ? row.payeeKey : entryKey(row), patch),
    );
  }

  function reset(row) {
    let overrides = state().overrides;
    for (const tx of row.txs) {
      if (tx.override === 'transaction')
        overrides = withOverride(overrides, 'transactions', tx.id, CLEARED);
      if (tx.override === 'payee')
        overrides = withOverride(overrides, 'payees', tx.payeeKey, CLEARED);
    }
    commit(overrides);
  }

  function restore(row) {
    let overrides = state().overrides;
    for (const tx of row.txs) {
      const own = overrides.transactions[tx.id]?.ignore === true;
      overrides = withOverride(overrides, 'transactions', tx.id, {
        ignore: own ? undefined : false,
      });
    }
    commit(overrides);
  }

  // ---- pieces of a row ---------------------------------------------------------------------
  const focusable = (node, key, field) => {
    node.dataset.focus = `${key}|${field}`;
    return node;
  };

  function details(row) {
    const shown = row.txs.slice(0, MAX_DETAILS);
    const id = uid('details');
    const trigger = h(
      'button',
      {
        class: 'popover-trigger',
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': id,
        'aria-label': `Details of ${row.payee}`,
      },
      'Details',
    );
    focusable(trigger, row.key, 'details');
    const content = shown.map(tx =>
      h(
        'li',
        { class: 'tx-detail' },
        h('strong', {}, `${tx.date} · ${formatCents(tx.amount)}`),
        h(
          'div',
          {},
          `Input row: ${Object.entries(tx.raw)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' · ')}`,
        ),
        h('div', {}, `Payee: ${tx.payee} (${SOURCE[tx.payeeSource](tx)})`),
        h(
          'div',
          {},
          tx.rule ? `Rule: ${tx.rule.index + 1} – ${tx.rule.pattern}` : 'Rule: none matched',
        ),
        h('div', {}, `Category: ${tx.category}`),
        h('div', {}, `Kind: ${tx.kind}`),
        tx.override ? h('div', {}, `Changed by hand: ${tx.override}`) : null,
      ),
    );
    const more = row.txs.length - shown.length;
    const bodyNode = h(
      'span',
      { class: 'popover-body wide', id, role: 'tooltip', hidden: true },
      h(
        'ul',
        { class: 'plain tx-details' },
        content,
        more > 0 ? h('li', { class: 'hint' }, `+${more} more`) : null,
      ),
    );
    return h('span', { class: 'popover', 'data-popover': true }, trigger, bodyNode);
  }

  function editor(row) {
    const { cats } = state().config;
    const select = (field, label, options, value, onChange) => {
      const id = uid('edit');
      const control = h(
        'select',
        { id, onchange: event => onChange(event.target.value) },
        options.map(([v, text]) => h('option', { value: v }, text)),
      );
      control.value = value;
      focusable(control, row.key, field);
      return h('div', { class: 'field' }, h('label', { for: id }, label), control);
    };
    const catOptions = (cats.includes(row.category) ? cats : [row.category, ...cats]).map(c => [
      c,
      c,
    ]);
    const parts = [
      select('category', 'Category', catOptions, row.category, v => change(row, { category: v })),
      select('kind', 'Kind', KINDS, row.kind, v => change(row, { kind: v })),
    ];
    if (!row.recurring) {
      parts.push(
        select(
          'scope',
          'Apply to',
          [
            ['transaction', 'This transaction'],
            ['payee', 'All transactions from this payee'],
          ],
          scopeChoice.get(row.key) ?? 'transaction',
          v => {
            scopeChoice.set(row.key, v);
            renderPanel();
          },
        ),
      );
    }
    const buttons = [
      focusable(
        h(
          'button',
          {
            class: 'btn secondary',
            type: 'button',
            'aria-label': `Ignore ${row.payee}`,
            onclick: () => change(row, { ignore: true }),
          },
          'Ignore',
        ),
        row.key,
        'ignore',
      ),
      row.txs.some(tx => tx.override)
        ? focusable(
            h(
              'button',
              { class: 'btn secondary', type: 'button', onclick: () => reset(row) },
              'Reset changes',
            ),
            row.key,
            'reset',
          )
        : null,
    ];
    return h(
      'fieldset',
      { class: 'group editor' },
      h('legend', {}, `Change ${row.payee}`),
      parts,
      h('div', { class: 'pattern-controls' }, buttons),
    );
  }

  function item(row, ignoredTab) {
    const changed = row.txs.some(tx => tx.override);
    const open = editing.has(row.key);
    const toggle = focusable(
      h(
        'button',
        {
          class: 'btn secondary',
          type: 'button',
          'aria-expanded': String(open),
          'aria-label': `Change ${row.payee}`,
          onclick: () => {
            if (open) editing.delete(row.key);
            else editing.add(row.key);
            renderPanel();
          },
        },
        'Change',
      ),
      row.key,
      'toggle',
    );
    const restoreButton = focusable(
      h(
        'button',
        {
          class: 'btn secondary',
          type: 'button',
          'aria-label': `Restore ${row.payee}`,
          onclick: () => restore(row),
        },
        'Restore',
      ),
      row.key,
      'restore',
    );
    return h(
      'li',
      { class: 'result-item' },
      h(
        'div',
        { class: 'result-main' },
        h('strong', {}, row.payee),
        h('span', { class: 'result-amount' }, row.amountText),
      ),
      h(
        'div',
        { class: 'hint' },
        `${row.category} · ${KIND_LABEL[row.kind]}`,
        changed ? ' · Changed by hand' : '',
      ),
      h('div', { class: 'pattern-controls' }, details(row), ignoredTab ? restoreButton : toggle),
      open && !ignoredTab ? editor(row) : null,
    );
  }

  // ---- rows of each tab --------------------------------------------------------------------
  const txRow = tx => ({
    key: `t:${tx.id}`,
    txs: [tx],
    payee: tx.payee,
    payeeKey: tx.payeeKey,
    category: tx.category,
    kind: tx.kind,
    amountText: `${tx.date} · ${formatCents(tx.amount)}`,
    recurring: false,
  });
  const recurringRow = entry => {
    const times = entry.perMonth > 1 ? ` (${entry.perMonth} × ${formatCents(entry.amount)})` : '';
    return {
      key: `r:${entry.key}`,
      txs: entry.transactions,
      payee: entry.payee,
      payeeKey: entry.payeeKey,
      category: entry.category,
      kind: entry.kind,
      amountText: `${formatCents(entry.monthly)} / month${times}`,
      recurring: true,
    };
  };
  const rowsOf = {
    recurring: result => result.recurring.map(recurringRow),
    oneTime: result => result.oneTime.map(txRow),
    ignored: result => result.ignored.map(txRow),
  };
  const EMPTY = {
    recurring: 'Nothing repeats the same way in every month yet.',
    oneTime: 'No one-time entries.',
    ignored: 'Nothing is ignored.',
  };

  // ---- tabs and panel ----------------------------------------------------------------------
  const tabNodes = Object.fromEntries(
    TABS.map(([name]) => {
      const node = h('button', {
        class: 'tab',
        type: 'button',
        role: 'tab',
        id: `result-tab-${name}`,
        'aria-controls': 'result-panel',
        onclick: () => select(name),
      });
      return [name, node];
    }),
  );
  const tablist = h(
    'div',
    { class: 'tabs', role: 'tablist', 'aria-label': 'Result' },
    Object.values(tabNodes),
  );
  tablist.addEventListener('keydown', event => {
    const names = TABS.map(([name]) => name);
    const at = names.indexOf(active);
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: names.length - 1 }[
      event.key
    ];
    if (next === undefined) return;
    event.preventDefault();
    select(names[(next + names.length) % names.length]);
    tabNodes[active].focus();
  });
  const panel = h('div', { role: 'tabpanel', id: 'result-panel', tabindex: 0 });
  const card = results.card('result', 'Result');
  card.append(tablist, panel);

  function select(name) {
    active = name;
    renderTabs(state().result);
    renderPanel();
  }

  function renderTabs(result) {
    for (const [name, label] of TABS) {
      const node = tabNodes[name];
      node.textContent = `${label} (${rowsOf[name](result).length})`;
      node.setAttribute('aria-selected', String(name === active));
      node.tabIndex = name === active ? 0 : -1;
    }
    panel.setAttribute('aria-labelledby', `result-tab-${active}`);
  }

  function renderPanel() {
    const focused = document.activeElement?.dataset?.focus;
    const rows = rowsOf[active](state().result);
    panel.replaceChildren(
      rows.length
        ? h(
            'ul',
            { class: 'result-list' },
            rows.map(row => item(row, active === 'ignored')),
          )
        : h('p', { class: 'hint' }, EMPTY[active]),
    );
    initPopovers(panel);
    if (focused) panel.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus();
  }

  store.subscribe(current => {
    results.show('result', current.classified.length > 0);
    renderTabs(current.result);
    renderPanel();
  });
}
