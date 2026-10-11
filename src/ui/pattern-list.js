// An editable list of patterns (IMP-6, IMP-7): add, remove and, when order matters, move up and
// down. Each item is a friendly pattern input plus a line of information (for example how many
// rows it affects). Buttons are the primary way to reorder; nothing needs a pointer.
import { h } from './dom.js';
import { createPatternInput } from './pattern-input.js';

/**
 * `get()` returns the current items, `set(items)` stores a new list, `texts()` the descriptions to
 * try them on, `info(item, index)` a short text per item. Items are plain pattern strings unless
 * `pattern(item)`, `withPattern(item, pattern)` and `blank` say how to read, change and create
 * one (the matching rules also carry a category and a kind); `extra(index)` can add controls
 * `{node, update(item, index)}` to each row. Call `refresh()` whenever the state changes.
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
  const list = h('ol', { class: 'pattern-list' });
  const add = h(
    'button',
    {
      class: 'btn secondary',
      type: 'button',
      onclick: () => {
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
    set(moving);
    const row = items[index + by]?.row;
    const target = row?.querySelector(`[data-action="${action}"]:not([disabled])`);
    (target ?? row?.querySelector('[data-action]:not([disabled])'))?.focus();
  }

  function build(entries) {
    items = entries.map((item, index) => {
      const input = createPatternInput({
        label: `${label} ${index + 1}`,
        value: pattern(item),
        capture,
        texts: texts(),
        onChange: value => set(get().map((it, i) => (i === index ? withPattern(it, value) : it))),
      });
      const more = extra?.(index) ?? null;
      const note = h('p', { class: 'hint pattern-info' });
      const button = (action, text, name, onclick) =>
        h(
          'button',
          {
            class: 'btn secondary',
            type: 'button',
            'data-action': action,
            'aria-label': name,
            onclick,
          },
          text,
        );
      const controls = [
        reorder
          ? button('up', '↑', `Move ${label} ${index + 1} up`, () => move(index, -1, 'up'))
          : null,
        reorder
          ? button('down', '↓', `Move ${label} ${index + 1} down`, () => move(index, 1, 'down'))
          : null,
        button('remove', 'Remove', `Remove ${label} ${index + 1}`, () => {
          set(get().filter((_, i) => i !== index));
          items[Math.min(index, items.length - 1)]?.row
            .querySelector('[data-action="remove"]')
            ?.focus();
        }),
      ];
      const row = h(
        'li',
        { class: 'pattern-item' },
        input.node,
        more?.node,
        note,
        h('div', { class: 'pattern-controls' }, controls),
      );
      return { input, row, note, more };
    });
    list.replaceChildren(...items.map(i => i.row));
  }

  function refresh() {
    const current = get();
    if (items.length !== current.length) build(current);
    const samples = texts();
    items.forEach((item, index) => {
      item.input.setValue(pattern(current[index]));
      item.input.setTexts(samples);
      item.more?.update(current[index], index);
      item.note.textContent = info(current[index], index);
      if (reorder) {
        item.row.querySelector('[data-action="up"]').disabled = index === 0;
        item.row.querySelector('[data-action="down"]').disabled = index === current.length - 1;
      }
    });
  }

  return { node, refresh };
}
