import './shell.js';
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
import { createStore } from './import/store.js';

initPopovers();

const { config, overrides, notices } = loadSettings();
const store = createStore({ config, sources: [], sample: null, overrides }, createDerive());
const bodies = mountStepper(document.getElementById('steps'), store, {
  label: document.getElementById('progress-label'),
  bar: document.querySelector('.progress progress'),
});

const results = createResults(
  document.getElementById('results'),
  document.getElementById('result-empty'),
);
mountParsing(bodies.parsing, store, results);
mountImporting(bodies.import, store, results);
mountFiltering(bodies.filtering, store, results);
mountPayees(bodies.payees, store, results);
mountRules(bodies.rules, store, results);
mountCategories(bodies.categories, store, results);
mountResult(store, results);
mountOutput(bodies.output, store, results);
mountSettings(document.getElementById('settings-body'), store, notices);
