// Values computed from the raw sources and the configuration. The raw text is kept in the state,
// so changing the parsing settings re-parses every file (IMP-4). Each value is recomputed only
// when what it depends on has changed.
import { filterTransactions } from '../../core/filter.js';
import { parseStatement } from '../../core/parser.js';
import { classifyTransactions } from '../../core/match.js';
import { assignPayees } from '../../core/payee.js';
import { errorsIn } from './config-edit.js';

const empty = name => ({
  file: name,
  transactions: [],
  descriptions: [],
  opening: null,
  closing: null,
  warnings: [],
  errors: [],
});

/** Remember the last result; run `compute` again only when one of `deps` has changed. */
function memo() {
  let last = null;
  return (deps, compute) => {
    if (last && deps.every((d, i) => Object.is(d, last.deps[i]))) return last.value;
    last = { deps, value: compute() };
    return last.value;
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function createDerive() {
  const parsed = memo();
  const flat = memo();
  const filtered = memo();
  const payeed = memo();
  const classified = memo();

  return state => {
    const { config, sources } = state;
    // The config object is replaced on every edit, so the dependency is the relevant section as text.
    const parseKey = JSON.stringify(config.parse);
    const filterKey = JSON.stringify(config.filter);
    const payeesKey = JSON.stringify(config.payees);
    const rulesKey = JSON.stringify(config.rules);

    const files = parsed([sources, parseKey], () => {
      const usable = errorsIn(config, 'parse').length === 0;
      return sources.map(s =>
        usable ? parseStatement(s.text, config.parse, s.name) : empty(s.name),
      );
    });
    const transactions = flat([files], () => files.flatMap(f => f.transactions));
    const result = filtered([transactions, filterKey], () => {
      const { from, to } = config.filter;
      return filterTransactions(transactions, {
        ...config.filter,
        from: ISO.test(from) ? from : '',
        to: ISO.test(to) ? to : '',
      });
    });
    const withPayees = payeed([result, payeesKey], () => assignPayees(result.kept, config.payees));
    const matched = classified([withPayees, rulesKey], () =>
      classifyTransactions(withPayees, Array.isArray(config.rules) ? config.rules : []),
    );
    return {
      ...state,
      files,
      transactions,
      filtered: result,
      payeed: withPayees,
      classified: matched,
    };
  };
}
