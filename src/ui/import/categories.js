// Step 6 (IMP-9): add, rename and delete categories. Rules follow a rename; deleting a category
// that rules use asks where they go. The logic is in core/categories.js.
import {
  addCategory,
  categoryUsage,
  deleteCategory,
  isProtectedCategory,
  renameCategory,
} from '../../core/categories.js';
import { h, uid } from '../dom.js';
import { formatCents } from '../format.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function mountCategories(body, store, results) {
  const state = () => store.get();
  let deleting = null;
  let message = '';

  /** Apply a core result: store the new configuration, or show why it was refused. */
  function apply({ config, error }) {
    message = error ?? '';
    deleting = null;
    if (error) render(state());
    else store.set({ config });
    return !error;
  }

  const newId = uid('category');
  const newName = h('input', {
    type: 'text',
    id: newId,
    onkeydown: event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      add();
    },
  });
  function add() {
    if (apply(addCategory(state().config, newName.value))) newName.value = '';
    newName.focus();
  }

  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const list = h('ul', { class: 'category-list' });
  body.append(
    h(
      'div',
      { class: 'field' },
      h('label', { for: newId }, 'New category'),
      h(
        'div',
        { class: 'chip-add' },
        newName,
        h('button', { class: 'btn', type: 'button', onclick: add }, 'Add category'),
      ),
    ),
    error,
    list,
  );

  function row(name) {
    const { config } = state();
    const locked = isProtectedCategory(name);
    const used = categoryUsage(config, name);
    const input = h('input', {
      type: 'text',
      value: name,
      readOnly: locked,
      'aria-label': `Name of ${name}`,
      onchange: event => {
        if (!apply(renameCategory(state().config, name, event.target.value))) {
          event.target.value = name;
        }
      },
    });
    const note = locked
      ? 'Used for unmatched transactions'
      : used
        ? `Used by ${plural(used, 'rule')}`
        : 'Not used by any rule';
    const remove = h(
      'button',
      {
        class: 'btn secondary',
        type: 'button',
        disabled: locked,
        'aria-label': `Delete ${name}`,
        onclick: () => {
          if (used === 0) apply(deleteCategory(state().config, name));
          else {
            message = '';
            deleting = name;
            render(state());
            list.querySelector('.delete-confirm select')?.focus();
          }
        },
      },
      'Delete',
    );
    const others = config.cats.filter(c => c !== name);
    const selectId = uid('move');
    const confirm =
      deleting === name
        ? h(
            'fieldset',
            { class: 'group delete-confirm', 'aria-label': `Delete ${name}` },
            h('legend', {}, `Delete ${name}`),
            h('p', {}, `"${name}" is used by ${plural(used, 'rule')}.`),
            h(
              'div',
              { class: 'field' },
              h('label', { for: selectId }, 'Move the rules to'),
              h(
                'select',
                { id: selectId },
                others.map(c => h('option', { value: c }, c)),
              ),
            ),
            h(
              'div',
              { class: 'pattern-controls' },
              h(
                'button',
                {
                  class: 'btn',
                  type: 'button',
                  onclick: event => {
                    const target = event.target.closest('fieldset').querySelector('select').value;
                    apply(deleteCategory(state().config, name, target));
                  },
                },
                'Move rules and delete',
              ),
              h(
                'button',
                {
                  class: 'btn secondary',
                  type: 'button',
                  onclick: () => {
                    deleting = null;
                    render(state());
                    list
                      .querySelector(`[data-category="${CSS.escape(name)}"] [data-action="delete"]`)
                      ?.focus();
                  },
                },
                'Cancel',
              ),
            ),
          )
        : null;
    remove.dataset.action = 'delete';
    const item = h(
      'li',
      { class: 'category-row' },
      h('div', { class: 'category-main' }, input, remove),
      h('span', { class: 'hint' }, note),
      confirm,
    );
    item.dataset.category = name;
    return item;
  }

  const summary = results.card('categories', 'By category');

  function renderResult({ classified }) {
    results.show('categories', classified.length > 0);
    const totals = new Map();
    for (const tx of classified) {
      const entry = totals.get(tx.category) ?? { count: 0, sum: 0 };
      entry.count += 1;
      entry.sum += tx.amount;
      totals.set(tx.category, entry);
    }
    const names = [...totals.keys()].sort();
    summary.replaceChildren(
      h(
        'div',
        { class: 'table-wrap', tabindex: 0, role: 'region', 'aria-label': 'Totals by category' },
        h(
          'table',
          {},
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', { scope: 'col' }, 'Category'),
              h('th', { scope: 'col', class: 'num' }, 'Transactions'),
              h('th', { scope: 'col', class: 'num' }, 'Total'),
            ),
          ),
          h(
            'tbody',
            {},
            names.map(name =>
              h(
                'tr',
                {},
                h('td', {}, name),
                h('td', { class: 'num' }, String(totals.get(name).count)),
                h('td', { class: 'num' }, formatCents(totals.get(name).sum)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  function render(current) {
    error.textContent = message;
    error.hidden = !message;
    list.replaceChildren(...current.config.cats.map(row));
  }

  store.subscribe(current => {
    render(current);
    renderResult(current);
  });
}
