// The right-hand column: one card per step that has something to show (live preview or result).
import { h } from '../dom.js';

export function createResults(container, placeholder) {
  const cards = new Map();

  function refresh() {
    placeholder.hidden = [...cards.values()].some(card => !card.hidden);
  }

  return {
    /** The body of the card for `id`, created on first use (hidden until `show(id, true)`). */
    card(id, title) {
      if (!cards.has(id)) {
        const heading = h('h2', { id: `result-${id}-title` }, title);
        const body = h('div', { class: 'result-body' });
        const card = h(
          'section',
          { class: 'card', id: `result-${id}`, hidden: true, 'aria-labelledby': heading.id },
          heading,
          body,
        );
        container.append(card);
        cards.set(id, card);
      }
      return cards.get(id).querySelector('.result-body');
    },
    show(id, visible) {
      cards.get(id).hidden = !visible;
      refresh();
    },
  };
}
