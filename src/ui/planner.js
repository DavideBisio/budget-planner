import './shell.js';
import { createPlannerStore } from './planner/state.js';
import { receiveHandoff } from './planner/handoff.js';
import { mountInputs } from './planner/inputs.js';
import { mountCards } from './planner/cards.js';
import { mountChart } from './planner/chart.js';
import { mountSummary } from './planner/summary.js';

const store = createPlannerStore();
receiveHandoff(store, document.getElementById('handoff-message'));
mountInputs(document.getElementById('inputs'), store);
mountSummary(document.getElementById('summary'), document.getElementById('totals'), store);
mountCards(document.getElementById('cards'), store);
mountChart(document.getElementById('chart'), store);
