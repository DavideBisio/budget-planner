// The cards list (PLAN-3, PLAN-8): recurring and one-time cards with their entries, editable in
// place. The list is rebuilt only when cards or entries are added, removed or moved; typing in a
// field never rebuilds it, so focus stays where the person is.
import { parseCents } from '../../core/money.js';
import {
  addCard,
  addEntry,
  moveEntry,
  removeCard,
  removeEntry,
  updateCard,
  updateEntry,
} from '../../core/planner.js';
import { h, uid } from '../dom.js';
import { formatCents } from '../format.js';
import { monthLabel } from '../../core/chart.js';
import { initPopovers } from '../popover.js';

const KIND_LABEL = { income: 'Income', expense: 'Expense', saving: 'Saving' };
const SOURCE_LABEL = { imported: 'Imported', manual: 'Manual' };

const structureKey = cards =>
  cards.map(card => `${card.id}[${card.entries.map(entry => entry.id)}]`).join('|');

/** Imported when every entry came from the import page, Manual when none did, otherwise Mixed. */
export function cardSource(card) {
  const imported = card.entries.filter(entry => entry.source === 'imported').length;
  if (imported === 0) return 'Manual';
  return imported === card.entries.length ? 'Imported' : 'Mixed';
}

const badge = (text, kind) => h('span', { class: `badge ${kind}` }, text);

export function mountCards(root, store) {
  let key = null;
  let focusAfter = null;
  let dragging = null;
  const nodes = new Map();

  const addButtons = h(
    'div',
    { class: 'pattern-controls' },
    h(
      'button',
      {
        class: 'btn secondary',
        type: 'button',
        onclick: () => addNew('recurring'),
      },
      '+ recurring card',
    ),
    h(
      'button',
      {
        class: 'btn secondary',
        type: 'button',
        onclick: () => addNew('one-time'),
      },
      '+ one-time card',
    ),
  );
  const empty = h('p', { class: 'hint' }, 'No cards yet. Add one, or import a bank statement.');
  const moved = h('p', { class: 'hint', role: 'status' });
  const list = h('div', { class: 'plan-cards' });
  root.append(addButtons, moved, empty, list);

  const cardName = card => card.title || 'Untitled card';

  function move(entryId, toCardId) {
    const { plan } = store.get();
    const from = plan.cards.find(c => c.entries.some(e => e.id === entryId));
    const to = plan.cards.find(c => c.id === toCardId);
    if (!from || !to || from.id === to.id) return;
    const entry = from.entries.find(e => e.id === entryId);
    store.apply(p => moveEntry(p, entryId, toCardId));
    moved.textContent = `Moved ${entry.label || 'entry'} to ${cardName(to)}.`;
    focusAfter = () => nodes.get(toCardId)?.entries.get(entryId)?.move.focus();
    render(store.get());
  }

  function addNew(type) {
    store.apply(plan => addCard(plan, { type }));
    const { plan } = store.get();
    focusAfter = () => nodes.get(plan.cards.at(-1).id)?.title.focus();
    render(store.get());
  }

  function entryRow(card, entry) {
    const view = {};
    const kindId = uid('kind');
    const errorId = uid('amount-error');
    const label = h('input', {
      type: 'text',
      value: entry.label,
      'aria-label': 'Entry label',
      autocomplete: 'off',
      onchange: () => commit(),
    });
    const amount = h('input', {
      type: 'text',
      inputMode: 'decimal',
      autocomplete: 'off',
      value: formatCents(entry.amountCents),
      'aria-label': 'Amount',
      'aria-describedby': errorId,
      onchange: () => commit(),
    });
    const kind = h(
      'select',
      { id: kindId, 'aria-label': 'Kind', onchange: () => commit() },
      Object.entries(KIND_LABEL).map(([value, text]) =>
        h('option', { value, selected: value === entry.kind }, text),
      ),
    );
    const category = h('input', {
      type: 'text',
      value: entry.category,
      'aria-label': 'Category',
      autocomplete: 'off',
      onchange: () => commit(),
    });
    const error = h('span', { class: 'error', id: errorId, hidden: true });
    const moveSelect = h('select', {
      class: 'move',
      onchange: () => {
        if (moveSelect.value) move(entry.id, moveSelect.value);
      },
    });

    function commit() {
      const cents = parseCents(amount.value);
      let problem = '';
      if (cents === null) problem = 'Type an amount such as 30 or 30.50';
      else if (cents < 0 && kind.value !== 'saving') {
        problem = 'Only a saving can be negative (a withdrawal from savings)';
      }
      error.textContent = problem;
      error.hidden = !problem;
      if (problem) amount.setAttribute('aria-invalid', 'true');
      else amount.removeAttribute('aria-invalid');
      const patch = { label: label.value, category: category.value };
      if (!problem) Object.assign(patch, { kind: kind.value, amountCents: cents });
      store.apply(plan => updateEntry(plan, entry.id, patch));
    }

    const trigger = h(
      'button',
      { class: 'popover-trigger', type: 'button', 'aria-expanded': 'false' },
      'i',
    );
    const bodyId = uid('entry-info');
    trigger.setAttribute('aria-controls', bodyId);
    const info = h('span', { class: 'popover-body', id: bodyId, role: 'tooltip', hidden: true });
    const sourceBadge = badge('', 'source');
    const remove = h('button', {
      class: 'btn secondary',
      type: 'button',
      onclick: () => {
        store.apply(plan => removeEntry(plan, entry.id));
        focusAfter = () => nodes.get(card.id)?.add.focus();
        render(store.get());
      },
    });

    const field = (text, control) => h('label', { class: 'mini' }, h('span', {}, text), control);
    const item = h(
      'li',
      { class: 'entry' },
      h(
        'div',
        {
          class: 'entry-head',
        },
        h('span', {
          class: 'drag-handle',
          draggable: true,
          'aria-hidden': 'true',
          title: 'Drag to another card',
          ondragstart: event => {
            dragging = entry.id;
            event.dataTransfer.setData('text/plain', entry.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setDragImage(item, 0, 0);
          },
          ondragend: () => {
            dragging = null;
          },
        }),
        h('span', { class: 'popover', 'data-popover': '' }, trigger, info),
        sourceBadge,
        moveSelect,
        remove,
      ),
      h(
        'div',
        { class: 'entry-fields' },
        field('Label', label),
        field('Amount', amount),
        field('Kind', kind),
        field('Category', category),
      ),
      error,
    );

    /** Refresh what is derived from the stored entry: badge, details, names of the buttons. */
    view.sync = (current, owner, cards) => {
      const name = current.label || 'entry';
      sourceBadge.textContent = SOURCE_LABEL[current.source];
      trigger.setAttribute('aria-label', `About ${name}`);
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove entry ${name}`);
      moveSelect.setAttribute('aria-label', `Move ${name} to`);
      moveSelect.replaceChildren(
        h('option', { value: '' }, 'Move to…'),
        ...cards
          .filter(other => other.id !== owner.id)
          .map(other =>
            h(
              'option',
              { value: other.id },
              `${cardName(other)} (${other.type === 'recurring' ? 'recurring' : `one-time, ${monthLabel(other.month)}`})`,
            ),
          ),
      );
      const when = owner.type === 'recurring' ? 'Every month' : owner.month;
      info.textContent = `${name}: ${KIND_LABEL[current.kind]}, ${current.category || 'no category'}. ${formatCents(current.amountCents)} · ${when}. ${SOURCE_LABEL[current.source]}.`;
    };
    view.label = label;
    view.move = moveSelect;
    view.item = item;
    return view;
  }

  function cardView(card) {
    const view = { entries: new Map() };
    const titleInput = h('input', {
      type: 'text',
      value: card.title,
      'aria-label': 'Card title',
      autocomplete: 'off',
      placeholder: 'Card title',
      oninput: () => {
        store.apply(plan => updateCard(plan, card.id, { title: titleInput.value }));
      },
    });
    const month =
      card.type === 'one-time'
        ? h('input', {
            type: 'month',
            value: card.month,
            'aria-label': 'Month',
            onchange: () => {
              if (/^\d{4}-\d{2}$/.test(month.value)) {
                store.apply(plan => updateCard(plan, card.id, { month: month.value }));
              }
            },
          })
        : null;
    const kindBadge = badge(card.type === 'recurring' ? 'Recurring' : 'One-time', 'kind');
    const sourceBadge = badge('', 'source');
    const remove = h('button', {
      class: 'btn secondary',
      type: 'button',
      onclick: () => {
        const current = store.get().plan.cards.find(c => c.id === card.id);
        const count = current?.entries.length ?? 0;
        if (
          count &&
          !window.confirm(`Delete “${current.title || 'this card'}” and its ${count} entries?`)
        ) {
          return;
        }
        store.apply(plan => removeCard(plan, card.id));
        focusAfter = () => addButtons.querySelector('button').focus();
        render(store.get());
      },
    });
    const entries = h('ul', { class: 'plain entries' });
    for (const entry of card.entries) {
      const row = entryRow(card, entry);
      view.entries.set(entry.id, row);
      entries.append(row.item);
    }
    view.add = h(
      'button',
      {
        class: 'btn secondary',
        type: 'button',
        onclick: () => {
          store.apply(plan =>
            addEntry(plan, card.id, { label: '', kind: 'expense', amountCents: 0 }),
          );
          const added = store
            .get()
            .plan.cards.find(c => c.id === card.id)
            .entries.at(-1);
          render(store.get());
          nodes.get(card.id)?.entries.get(added.id)?.label.focus();
        },
      },
      'Add entry',
    );
    view.title = titleInput;
    view.el = h(
      'article',
      {
        class: 'plan-card',
        ondragover: event => {
          if (dragging) event.preventDefault();
        },
        ondragenter: () => dragging && view.el.classList.add('drop'),
        ondragleave: event => {
          if (!view.el.contains(event.relatedTarget)) view.el.classList.remove('drop');
        },
        ondrop: event => {
          event.preventDefault();
          view.el.classList.remove('drop');
          if (dragging) move(dragging, card.id);
        },
      },
      h(
        'div',
        { class: 'plan-card-head' },
        h('div', { class: 'badges' }, kindBadge, sourceBadge),
        remove,
      ),
      h(
        'div',
        { class: 'plan-card-fields' },
        h('label', { class: 'mini' }, h('span', {}, 'Title'), titleInput),
        month && h('label', { class: 'mini' }, h('span', {}, 'Month'), month),
      ),
      entries,
      view.add,
    );
    view.sync = (current, cards) => {
      const name = cardName(current);
      view.el.setAttribute('aria-label', name);
      sourceBadge.textContent = cardSource(current);
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete card ${name}`);
      for (const entry of current.entries) view.entries.get(entry.id)?.sync(entry, current, cards);
    };
    return view;
  }

  function render({ plan }) {
    const next = structureKey(plan.cards);
    if (next !== key) {
      key = next;
      nodes.clear();
      for (const card of plan.cards) nodes.set(card.id, cardView(card));
      list.replaceChildren(...plan.cards.map(card => nodes.get(card.id).el));
      initPopovers(list);
    }
    empty.hidden = plan.cards.length > 0;
    for (const card of plan.cards) nodes.get(card.id).sync(card, plan.cards);
    if (focusAfter) {
      const run = focusAfter;
      focusAfter = null;
      run();
    }
  }

  store.subscribe(render);
}
