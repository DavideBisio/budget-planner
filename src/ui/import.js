import { showNotice } from './shell.js';
import './styles/main.css';
import { initPopovers } from './popover.js';
import { mountStepper } from './import/stepper.js';
import { mountParsing } from './import/parsing.js';
import { createResults } from './import/results.js';
import { createDerive } from './import/derive.js';
import { mountFiltering } from './import/filtering.js';
import { mountPayees } from './import/payees.js';
import { loadSettings, mountSettings } from './import/settings.js';
import { mountOutput } from './import/output.js';
import { mountResult } from './import/result.js';
import { mountCategories } from './import/categories.js';
import { mountRules } from './import/rules.js';
import { mountImporting } from './import/importing.js';
import { loadFiles, persistFiles } from './import/files-store.js';
import { createStore } from './store.js';

initPopovers();

const { config, overrides, notices } = loadSettings();
const store = createStore({ config, sources: loadFiles(), overrides }, createDerive());
const { panes } = mountStepper(
  {
    tabs: document.getElementById('tabs'),
    note: document.getElementById('tabs-note'),
    panels: document.getElementById('panels'),
  },
  store,
  {
    label: document.getElementById('progress-label'),
    bar: document.querySelector('.progress progress'),
  },
);

// Cards that are not named after a step live in the step they belong to.
const results = createResults(panes, {
  settings: 'import',
  files: 'import',
  rules: 'categories',
  result: ['output', 'left'],
});
mountSettings(results, store, notices, showNotice);
mountImporting(panes.import.left, store, results);
mountParsing(panes.parsing.left, store, results);
mountCategories(panes.categories.left, store, results);
mountRules(panes.categories.left, store, results);
mountFiltering(panes.filtering.left, store, results);
mountPayees(panes.payees.left, store, results);
mountResult(store, results);
mountOutput(panes.output.left, store, results);
persistFiles(store);
