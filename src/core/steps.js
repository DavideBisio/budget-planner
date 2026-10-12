/**
 * The import workflow (IMP-1, IMP-2): the seven steps in order and the status of each one.
 * Status is derived from the configuration and the imported files, never stored.
 */
import { validateConfig } from './config.js';

export const STEPS = [
  { id: 'import', title: 'Import', purpose: 'Choose your statement files and your settings file.' },
  { id: 'parsing', title: 'Parsing', purpose: 'Tell the app how your bank file is laid out.' },
  {
    id: 'categories',
    title: 'Categories',
    purpose: 'Manage the categories and the rules that put each transaction in one.',
  },
  {
    id: 'filtering',
    title: 'Filtering',
    purpose: 'Leave out rows you do not want: dates outside a range, own transfers, exclusions.',
  },
  {
    id: 'payees',
    title: 'Payees',
    purpose: 'Read who was paid, or who paid you, from each description.',
  },
  {
    id: 'output',
    title: 'Output',
    purpose: 'Download your settings, or send the planner cards to the planner.',
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

  const badFile = files.find(f => f.errors.length);
  if (badFile) set('import', 'attention', badFile.errors[0].message);
  else set('import', files.length ? 'valid' : 'todo');
  const filesReady = files.length > 0 && !badFile;

  const parseErrors = sectionErrors('parse');
  if (!files.length) set('parsing', 'waiting', 'Waiting for step 1 (import) to have a file.');
  else if (parseErrors.length) set('parsing', 'attention', message(parseErrors[0]));
  else if (badFile) set('parsing', 'attention', badFile.errors[0].message);
  else set('parsing', 'valid');
  const parsingReady = result.get('parsing').status === 'valid';

  const missing = [];
  if (!filesReady) missing.push('step 1 (import) to have a readable file');
  if (!parsingReady) missing.push('step 2 (parsing) to be valid');
  const waiting = missing.length ? `Waiting for ${missing.join(' and ')}.` : '';

  const own = {
    categories: ['cats', 'rules'],
    filtering: ['filter'],
    payees: ['payees'],
  };
  for (const [id, sections] of Object.entries(own)) {
    const found = sections.flatMap(sectionErrors);
    if (waiting) set(id, 'waiting', waiting);
    else if (found.length) set(id, 'attention', message(found[0]));
    else set(id, 'valid');
  }

  const broken = Object.keys(own)
    .filter(id => result.get(id).status === 'attention')
    .map(number)
    .sort((x, y) => x - y);
  if (waiting) set('output', 'waiting', waiting);
  else if (broken.length)
    set('output', 'attention', `Fix step${broken.length > 1 ? 's' : ''} ${list(broken)} first.`);
  else set('output', 'valid');

  return STEPS.map(step => result.get(step.id));
}
