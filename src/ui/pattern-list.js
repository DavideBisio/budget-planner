// An editable list of patterns (IMP-6, IMP-7): add, remove and, when order matters, move up and
// down. Items are compact by default: a line with what the pattern says, a note (for example how
// many rows it affects) and a red cross. The line opens the full card (the friendly pattern input
// and any extra controls) and closes it again. Buttons are the primary way to reorder.
import { summarizePattern } from '../core/pattern.js';
import { h, uid, fill } from './dom.js';
import { createPatternInput } from './pattern-input.js';

/**
 * `get()` returns the current items, `set(items)` stores a new list, `texts()` the descriptions to
 * try them on, `info(item, index)` a short text per item. Items are plain pattern strings unless
 * `pattern(item)`, `withPattern(item, pattern)` and `blank` say how to read, change and create
 * one (the matching rules also carry a category and a kind); `extra(index)` can add controls
 * `{node, update(item, index), summary?(item)}` to each row. Call `refresh()` whenever the state changes.
 */
export function createPatternList({
  label,
  addLabel,
  capture = false,
  reorder = false,
  get,
  set,
  texts = () => [],
  info = () => '',
  pattern = item => item,
  withPattern = (_, value) => value,
  blank = '',
  extra = null,
}) {
  let items = [];
  let opened = [];
  const list = h('ol', { class: 'pattern-list' });
  const add = h(
    'button',
    {
      class: 'btn',
      type: 'button',
      onclick: () => {
        opened = [...opened, true];
        set([...get(), typeof blank === 'function' ? blank() : blank]);
        items.at(-1)?.input.node.querySelector('select, input')?.focus();
      },
    },
    addLabel,
  );
  const node = h('fieldset', { class: 'group' }, h('legend', {}, label), list, add);

  function move(index, by, action) {
    const moving = [...get()];
    const [moved] = moving.splice(index, 1);
    moving.splice(index + by, 0, moved);
    const flags = [...opened];
    const [flag] = flags.splice(index, 1);
    flags.splice(index + by, 0, flag);
    opened = flags;
    set(moving);
    const row = items[index + by]?.row;
    const other = action === 'up' ? 'down' : 'up';
    const enabled = name => row?.querySelector(`[data-action="${name}"]:not([disabled])`);
    (enabled(action) ?? enabled(other) ?? enabled('remove'))?.focus();
  }

  function build(entries) {
    if (opened.length !== entries.length) opened = entries.map(() => false);
    items = entries.map((item, index) => {
      const bodyId = uid('pattern-body');
      const input = createPatternInput({
        label: `${label} ${index + 1}`,
        value: pattern(item),
        capture,
        texts: texts(),
        onChange: value => set(get().map((it, i) => (i === index ? withPattern(it, value) : it))),
      });
      const more = extra?.(index) ?? null;
      const note = h('p', { class: 'hint pattern-info' });
      const button = (action, text, name, onclick, className = 'btn secondary') =>
        h(
          'button',
          { class: className, type: 'button', 'data-action': action, 'aria-label': name, onclick },
          text,
        );
      const summary = h('span', { class: 'pattern-summary' });
      const toggle = h(
        'button',
        {
          class: 'pattern-toggle',
          type: 'button',
          'data-action': 'toggle',
          'aria-controls': bodyId,
          onclick: () => {
            opened = opened.map((flag, i) => (i === index ? !flag : flag));
            refresh();
          },
        },
        summary,
      );
      const body = h('div', { class: 'pattern-body', id: bodyId }, input.node, more?.node);
      body.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        opened = opened.map((flag, i) => (i === index ? false : flag));
        refresh();
        toggle.focus();
      });
      const controls = [
        reorder
          ? button('up', '↑', `Move ${label} ${index + 1} up`, () => move(index, -1, 'up'))
          : null,
        reorder
          ? button('down', '↓', `Move ${label} ${index + 1} down`, () => move(index, 1, 'down'))
          : null,
        button(
          'remove',
          '×',
          `Remove ${label} ${index + 1}`,
          () => {
            opened = opened.filter((_, i) => i !== index);
            set(get().filter((_, i) => i !== index));
            items[Math.min(index, items.length - 1)]?.row
              .querySelector('[data-action="remove"]')
              ?.focus();
          },
          'btn danger',
        ),
      ];
      const row = h(
        'li',
        { class: 'pattern-item' },
        h(
          'div',
          { class: 'pattern-head' },
          toggle,
          h('div', { class: 'pattern-controls' }, controls),
        ),
        note,
        body,
      );
      return { input, row, note, more, summary, toggle, body };
    });
    fill(list, ...items.map(i => i.row));
  }

  function refresh() {
    const current = get();
    if (items.length !== current.length) build(current);
    const samples = texts();
    items.forEach((item, index) => {
      const open = Boolean(opened[index]);
      item.input.setValue(pattern(current[index]));
      item.input.setTexts(samples);
      item.more?.update(current[index], index);
      item.note.textContent = info(current[index], index);
      const extraSummary = item.more?.summary?.(current[index]);
      item.summary.textContent = [
        summarizePattern(pattern(current[index]), { capture }),
        extraSummary,
      ]
        .filter(Boolean)
        .join(' → ');
      item.toggle.setAttribute('aria-label', `${label} ${index + 1}: ${item.summary.textContent}`);
      item.toggle.setAttribute('aria-expanded', String(open));
      item.body.hidden = !open;
      item.row.dataset.open = String(open);
      if (reorder) {
        item.row.querySelector('[data-action="up"]').disabled = index === 0;
        item.row.querySelector('[data-action="down"]').disabled = index === current.length - 1;
      }
    });
  }

  return { node, refresh };
}
