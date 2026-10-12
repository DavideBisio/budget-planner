// Receiving the cards the import page sent (STOR-6): read the payload once, check it, apply it to
// the plan and remove it. An invalid payload is discarded with a message and changes nothing; a
// payload from a newer version is left where it is.
import { HANDOFF_VERSION } from '../../core/handoff.js';
import { applyHandoff, validateHandoff } from '../../core/handoff-apply.js';
import { h, fill } from '../dom.js';
import { load, remove } from '../storage.js';

const entryCount = plan => plan.cards.reduce((sum, card) => sum + card.entries.length, 0);
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function receiveHandoff(store, root) {
  const { status, data } = load('handoff');
  if (status === 'empty' || status === 'unavailable') return;

  const show = (kind, text) =>
    fill(
      root,
      h(
        'p',
        {
          class: kind === 'error' ? 'notice' : 'hint',
          role: kind === 'error' ? 'alert' : 'status',
        },
        text,
      ),
    );

  if (status === 'newer') {
    show(
      'error',
      'The cards from the import page were written by a newer version of this app. They are left untouched and not applied.',
    );
    return;
  }

  const payload = { version: HANDOFF_VERSION, data };
  const problems = status === 'invalid' ? [{ path: '' }] : validateHandoff(payload);
  if (problems.length > 0) {
    remove('handoff');
    show('error', 'The cards sent from the import page could not be used, so nothing was changed.');
    return;
  }

  const before = entryCount(store.get().plan);
  store.apply(plan => applyHandoff(plan, payload));
  const added = entryCount(store.get().plan) - (data.mode === 'merge' ? before : 0);
  remove('handoff');
  show(
    'ok',
    added > 0
      ? `${count(added, 'card')} from the import page ${data.mode === 'replace' ? 'replaced your cards' : 'added to your plan'}.`
      : 'The import page sent no new cards: everything was already in your plan.',
  );
}
