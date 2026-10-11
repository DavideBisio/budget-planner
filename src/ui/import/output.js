// Step 7 (IMP-12): preview the planner cards with totals, choose replace or merge, and send the
// cards to the planner or download them. The payload itself is built in core/handoff.js.
import { buildHandoff, describeHandoff } from '../../core/handoff.js';
import { h, uid } from '../dom.js';
import { formatCents } from '../format.js';
import { downloadText } from '../download.js';
import { sendToPlanner } from '../handoff.js';

const KIND_LABEL = { income: 'Income', expense: 'Expense', saving: 'Saving' };

export function mountOutput(body, store, results) {
  let mode = 'replace';
  let sent = '';

  const radio = (value, label) => {
    const id = uid('mode');
    const input = h('input', {
      type: 'radio',
      name: 'handoff-mode',
      id,
      value,
      checked: value === mode,
      onchange: () => {
        mode = value;
        sent = '';
        render(store.get());
      },
    });
    return h('div', { class: 'check' }, input, h('label', { for: id }, label));
  };

  const statusText = h('p', { class: 'handoff-status' });
  const sentNote = h('p', { class: 'handoff-sent' });
  const status = h('div', { role: 'status' }, statusText, sentNote);
  const send = h(
    'button',
    { class: 'btn', type: 'button', onclick: () => submit() },
    'Send to planner',
  );
  const download = h(
    'button',
    { class: 'btn secondary', type: 'button', onclick: () => save() },
    'Download JSON',
  );
  body.append(
    h(
      'fieldset',
      { class: 'group' },
      h('legend', {}, 'How to add the cards'),
      radio('replace', 'Replace the planner’s cards'),
      radio('merge', 'Add to the planner’s cards'),
    ),
    status,
    h('div', { class: 'pattern-controls' }, send, download),
  );

  const preview = results.card('output', 'Planner cards');
  const payload = () => {
    const { result } = store.get();
    return buildHandoff(result.cards, result.months, mode);
  };

  function submit() {
    sent = sendToPlanner(payload())
      ? 'Cards sent. Open the planner to see them.'
      : 'The cards could not be stored in this browser. Use Download JSON instead.';
    render(store.get());
  }

  function save() {
    downloadText('planner-cards.json', JSON.stringify(payload(), null, 2));
  }

  const line = card =>
    h(
      'li',
      { class: 'card-line' },
      h('strong', {}, card.payee),
      h('span', { class: 'hint' }, ` ${card.category} · ${KIND_LABEL[card.kind]}`),
      h(
        'span',
        { class: 'result-amount' },
        card.type === 'recurring'
          ? `${formatCents(card.amount)} / month`
          : `${card.date} · ${formatCents(card.amount)}`,
      ),
    );

  function render({ result }) {
    const { cards } = result;
    const count = cards.recurring.length + cards.oneTime.length;
    results.show('output', count > 0);
    send.disabled = count === 0;
    download.disabled = count === 0;
    statusText.textContent = count ? describeHandoff(cards, mode) : 'There are no cards to send.';
    sentNote.replaceChildren(
      ...(sent ? [sent] : []),
      ...(sent.startsWith('Cards sent')
        ? [' ', h('a', { href: './index.html' }, 'Open the planner')]
        : []),
    );

    const { byKind, net } = cards.totals;
    preview.replaceChildren(
      h(
        'p',
        { class: 'match-count' },
        `Over ${result.months.length} month${result.months.length === 1 ? '' : 's'}: Income ${formatCents(byKind.income)} · Expenses ${formatCents(byKind.expense)} · Savings ${formatCents(byKind.saving)} · Net ${formatCents(net)}`,
      ),
      h('ul', { class: 'plain card-lines' }, [...cards.recurring, ...cards.oneTime].map(line)),
    );
  }

  store.subscribe(render);
}
