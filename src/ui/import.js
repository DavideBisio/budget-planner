import './shell.js';
import './styles/main.css';
import { defaultConfig } from '../core/config.js';
import { initPopovers } from './popover.js';
import { mountStepper } from './import/stepper.js';
import { mountParsing } from './import/parsing.js';
import { createResults } from './import/results.js';
import { createStore } from './import/store.js';

initPopovers();

const store = createStore({ config: defaultConfig(), files: [], sample: null });
const bodies = mountStepper(document.getElementById('steps'), store, {
  label: document.getElementById('progress-label'),
  bar: document.querySelector('.progress progress'),
});

const results = createResults(
  document.getElementById('results'),
  document.getElementById('result-empty'),
);
mountParsing(bodies.parsing, store, results);
