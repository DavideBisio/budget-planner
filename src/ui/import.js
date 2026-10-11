import './shell.js';
import './styles/main.css';
import { defaultConfig } from '../core/config.js';
import { initPopovers } from './popover.js';
import { mountStepper } from './import/stepper.js';
import { createStore } from './import/store.js';

initPopovers();

const store = createStore({ config: defaultConfig(), files: [] });
mountStepper(document.getElementById('steps'), store, {
  label: document.getElementById('progress-label'),
  bar: document.querySelector('.progress progress'),
});
