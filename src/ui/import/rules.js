// Step 5 (IMP-8): ordered matching rules with a category and a kind, hit counts per rule, and the
// list of transactions no rule matches. The first matching rule wins.
import { h, uid, fill } from '../dom.js';
import { formatCents } from '../format.js';
import { createPatternList } from '../pattern-list.js';
import { errorsIn, updateConfig } from './config-edit.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const UNMATCHED_SHOWN = 20;

const KINDS = [
  ['', 'From the direction of the money'],
  ['income', 'Income'],
  ['saving', 'Saving'],
  ['expense', 'Expense'],
];

export function mountRules(body, store, results) {
  const state = () => store.get();
  const setRule = (index, patch) =>
    updateConfig(
      store,
      ['rules'],
      state().config.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    );

  /** Category and kind selectors of one rule, with their validation messages. */
  function extra(index) {
    const catId = uid('rule-cat');
    const kindId = uid('rule-kind');
    const cat = h('select', { id: catId, onchange: e => setRule(index, { cat: e.target.value }) });
    const kind = h('select', {
      id: kindId,
      onchange: e => setRule(index, { kind: e.target.value }),
    });
    kind.append(...KINDS.map(([value, text]) => h('option', { value }, text)));
    const error = h('span', { class: 'error', hidden: true });
    const node = h(
      'div',
      { class: 'rule-fields' },
      h('div', { class: 'field' }, h('label', { for: catId }, 'Category'), cat),
      h('div', { class: 'field' }, h('label', { for: kindId }, 'Kind'), kind),
      error,
    );
    return {
      node,
      update(rule, at) {
        const cats = state().config.cats;
        const known = cats.includes(rule.cat);
        const options = known ? cats : [rule.cat, ...cats];
        if ([...cat.options].map(o => o.value).join('\n') !== options.join('\n')) {
          fill(cat, ...options.map(c => h('option', { value: c }, c)));
        }
        cat.value = rule.cat;
        kind.value = rule.kind;
        const message = errorsIn(state().config, 'rules')
          .filter(e => e.path === `rules[${at}].cat` || e.path === `rules[${at}].kind`)
          .map(e => e.message)
          .join('. ');
        error.textContent = message;
        error.hidden = !message;
      },
    };
  }

  const list = createPatternList({
    label: 'Matching rules',
    addLabel: 'Add a matching rule',
    reorder: true,
    get: () => state().config.rules,
    set: rules => updateConfig(store, ['rules'], rules),
    texts: () => state().payeed.map(t => t.desc),
    pattern: rule => rule.p,
    withPattern: (rule, p) => ({ ...rule, p }),
    blank: () => ({ p: '', cat: state().config.cats[0] ?? '', kind: '' }),
    extra,
    info: (_, index) =>
      `Matches ${plural(state().classified.filter(t => t.rule?.index === index).length, 'transaction')}`,
  });
  body.append(
    h('p', { class: 'hint' }, 'Rules are tried from the top; the first one that matches wins.'),
    list.node,
  );

  const summary = results.card('rules', 'Matching');

  function renderResult({ classified }) {
    results.show('rules', classified.length > 0);
    const unmatched = classified.filter(t => !t.rule);
    fill(
      summary,
      h('p', { class: 'match-count' }, `Matched: ${classified.length - unmatched.length}`),
      h(
        'details',
        { open: unmatched.length > 0 && unmatched.length <= 3 },
        h('summary', {}, `Unmatched: ${unmatched.length}`),
        unmatched.length
          ? h(
              'ul',
              { class: 'plain' },
              unmatched
                .slice(0, UNMATCHED_SHOWN)
                .map(t => h('li', {}, `${t.date} · ${formatCents(t.amount)} · ${t.desc}`)),
              unmatched.length > UNMATCHED_SHOWN
                ? h('li', { class: 'hint' }, `and ${unmatched.length - UNMATCHED_SHOWN} more`)
                : null,
            )
          : h('p', { class: 'hint' }, 'Every transaction matches a rule.'),
      ),
    );
  }

  store.subscribe(current => {
    list.refresh();
    renderResult(current);
  });
}
