import './shell.js';
import { createPlannerStore } from './planner/state.js';
import { mountInputs } from './planner/inputs.js';
import { mountCards } from './planner/cards.js';
import { mountSummary } from './planner/summary.js';

const store = createPlannerStore();
mountInputs(document.getElementById('inputs'), store);
mountSummary(document.getElementById('summary'), document.getElementById('totals'), store);
mountCards(document.getElementById('cards'), store);
