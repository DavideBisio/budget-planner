/**
 * The import workflow (IMP-1, IMP-2): the seven steps in order and the status of each one.
 * Status is derived from the configuration and the imported files, never stored.
 */
import { validateConfig } from './config.js';

export const STEPS = [
  { id: 'parsing', title: 'Parsing', purpose: 'Tell the app how your bank file is laid out.' },
  { id: 'import', title: 'Import', purpose: 'Choose your statement files and check the totals.' },
  {
    id: 'filtering',
    title: 'Filtering',
    purpose: 'Leave out rows you do not want: dates outside a range, own transfers, exclusions.',
  },
  {
    id: 'payees',
    title: 'Payee extraction',
    purpose: 'Read who was paid, or who paid you, from each description.',
  },
  {
    id: 'rules',
    title: 'Matching rules',
    purpose: 'Give each transaction a category and a kind by what its description says.',
  },
  { id: 'categories', title: 'Categories', purpose: 'Manage the list of categories.' },
  {
    id: 'output',
    title: 'Output',
    purpose: 'Review the planner cards, then send them to the planner or download them.',
  },
];

/** The configuration section each step edits, as the leading part of a validation path. */
const sectionOf = path => path.split(/[.[]/)[0];
const message = error => (error.path ? `${error.path}: ${error.message}` : error.message);
const list = numbers =>
  `${numbers.slice(0, -1).join(', ')}${numbers.length > 1 ? ' and ' : ''}${numbers.at(-1)}`;

/**
 * Status of every step: `[{id, status, reason}]`. Status is `todo`, `valid`, `attention` or
 * `waiting` (an earlier step is not ready). `reason` explains attention and waiting, else ''.
 */
export function stepStatuses({ config, files }) {
  const errors = validateConfig(config);
  const sectionErrors = section =>
    errors.filter(e =>
      (section === 'parse' ? ['', 'version', 'parse'] : [section]).includes(sectionOf(e.path)),
    );
  const result = new Map();
  const set = (id, status, reason = '') => result.set(id, { id, status, reason });
  const number = id => STEPS.findIndex(s => s.id === id) + 1;

  const parseErrors = sectionErrors('parse');
  if (parseErrors.length) set('parsing', 'attention', message(parseErrors[0]));
  else set('parsing', 'valid');
  const parsingReady = result.get('parsing').status === 'valid';

  const badFile = files.find(f => f.errors.length);
  if (!parsingReady) set('import', 'waiting', 'Waiting for step 1 (parsing) to be valid.');
  else if (badFile) set('import', 'attention', badFile.errors[0].message);
  else set('import', files.length ? 'valid' : 'todo');
  const filesReady = files.length > 0 && !badFile;

  const missing = [];
  if (!parsingReady) missing.push('step 1 (parsing) to be valid');
  if (!filesReady) missing.push('step 2 (import) to have a readable file');
  const waiting = missing.length ? `Waiting for ${missing.join(' and ')}.` : '';

  const own = { filtering: 'filter', payees: 'payees', rules: 'rules', categories: 'cats' };
  for (const id of Object.keys(own)) {
    const found = sectionErrors(own[id]);
    if (waiting) set(id, 'waiting', waiting);
    else if (found.length) set(id, 'attention', message(found[0]));
    else set(id, 'valid');
  }

  const broken = Object.keys(own)
    .filter(id => result.get(id).status === 'attention')
    .map(number);
  if (waiting) set('output', 'waiting', waiting);
  else if (broken.length)
    set('output', 'attention', `Fix step${broken.length > 1 ? 's' : ''} ${list(broken)} first.`);
  else set('output', 'valid');

  return STEPS.map(step => result.get(step.id));
}
