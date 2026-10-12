// The cards of a tab: each card lives in the right-hand column of the step it belongs to, and is
// hidden until it has something to show.
import { h } from '../dom.js';

export function createResults(panes, homes = {}) {
  const cards = new Map();

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
        const [step, side = 'right'] = [].concat(homes[id] ?? id);
        panes[step][side].append(card);
        cards.set(id, card);
      }
      return cards.get(id).querySelector('.result-body');
    },
    show(id, visible) {
      cards.get(id).hidden = !visible;
    },
  };
}
