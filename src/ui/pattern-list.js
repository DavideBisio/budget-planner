// An editable list of patterns (IMP-6, IMP-7): add, remove and, when order matters, move up and
// down. Each item is a friendly pattern input plus a line of information (for example how many
// rows it affects). Buttons are the primary way to reorder; nothing needs a pointer.
import { h } from './dom.js';
import { createPatternInput } from './pattern-input.js';

/**
 * `get()` returns the current patterns, `set(patterns)` stores a new list, `texts()` the
 * descriptions to try them on, `info(pattern, index)` a short text per item. Call `refresh()`
 * whenever the state changes.
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
}) {
  let items = [];
  const list = h('ol', { class: 'pattern-list' });
  const add = h(
    'button',
    {
      class: 'btn secondary',
      type: 'button',
      onclick: () => {
        set([...get(), '']);
        items.at(-1)?.input.node.querySelector('select, input')?.focus();
      },
    },
    addLabel,
  );
  const node = h('fieldset', { class: 'group' }, h('legend', {}, label), list, add);

  function move(index, by, action) {
    const patterns = [...get()];
    const [moved] = patterns.splice(index, 1);
    patterns.splice(index + by, 0, moved);
    set(patterns);
    const row = items[index + by]?.row;
    const target = row?.querySelector(`[data-action="${action}"]:not([disabled])`);
    (target ?? row?.querySelector('[data-action]:not([disabled])'))?.focus();
  }

  function build(patterns) {
    items = patterns.map((pattern, index) => {
      const input = createPatternInput({
        label: `${label} ${index + 1}`,
        value: pattern,
        capture,
        texts: texts(),
        onChange: value => set(get().map((p, i) => (i === index ? value : p))),
      });
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
        note,
        h('div', { class: 'pattern-controls' }, controls),
      );
      return { input, row, note };
    });
    list.replaceChildren(...items.map(i => i.row));
  }

  function refresh() {
    const patterns = get();
    if (items.length !== patterns.length) build(patterns);
    const samples = texts();
    items.forEach((item, index) => {
      item.input.setValue(patterns[index]);
      item.input.setTexts(samples);
      item.note.textContent = info(patterns[index], index);
      if (reorder) {
        item.row.querySelector('[data-action="up"]').disabled = index === 0;
        item.row.querySelector('[data-action="down"]').disabled = index === patterns.length - 1;
      }
    });
  }

  return { node, refresh };
}
