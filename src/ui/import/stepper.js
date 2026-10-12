// The guided sequence (IMP-1, IMP-2): numbered tabs, one panel per step with a settings column and
// a result column, and a status badge per tab. Statuses come from core; the content of each step is
// mounted by its own module into the panes returned here.
import { STEPS, stepStatuses } from '../../core/steps.js';

const BADGE = { todo: 'To do', valid: 'Ready', attention: 'Needs attention', waiting: 'Waiting' };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Build the tabs and panels and keep them in sync with the store. Returns `{panes}`: for every
 * step id the `left` and `right` column nodes to fill. The progress bar counts the steps that are
 * ready and that the person has opened, so it starts at zero and advances as they go.
 */
export function mountStepper({ tabs, note, panels }, store, progress) {
  const parts = new Map();
  const panes = {};
  const visited = new Set();
  let selected = STEPS[0].id;
  let statuses = [];
  let state = null;

  for (const [index, step] of STEPS.entries()) {
    const tab = element('button', 'step-tab');
    tab.type = 'button';
    tab.id = `tab-${step.id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `step-body-${step.id}`);
    const number = element('span', 'step-number', String(index + 1));
    number.setAttribute('aria-hidden', 'true');
    const badge = element('span', 'badge');
    const reason = element('span', 'step-reason sr-only');
    tab.append(number, element('span', 'step-title', step.title), badge, reason);

    const panel = element('section', 'tab-panel');
    panel.id = `step-body-${step.id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    const left = element('div', 'stack');
    const right = element('div', 'stack');
    const next = STEPS[index + 1];
    const nextButton = next ? element('button', 'btn', `Next: ${next.title}`) : null;
    if (nextButton) {
      nextButton.type = 'button';
      nextButton.addEventListener('click', () => select(next.id, true));
    }
    const columns = element('div', 'columns');
    columns.append(left, right);
    panel.append(element('p', 'step-purpose', step.purpose), columns);
    if (nextButton) {
      const footer = element('div', 'step-next');
      footer.append(nextButton);
      panel.append(footer);
    }

    tab.addEventListener('click', () => select(step.id, false));
    tab.addEventListener('keydown', event => onKey(event, index));
    tabs.append(tab);
    panels.append(panel);
    panes[step.id] = { left, right };
    parts.set(step.id, { tab, panel, badge, reason, nextButton });
  }

  const status = id => statuses.find(s => s.id === id)?.status;
  const enabled = id => status(id) !== 'waiting';

  function onKey(event, index) {
    const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
    if (!(event.key in keys)) return;
    const open = STEPS.filter(s => enabled(s.id));
    const at = open.findIndex(s => s.id === STEPS[index].id);
    const move = keys[event.key];
    const target =
      move === 'first'
        ? open[0]
        : move === 'last'
          ? open.at(-1)
          : open[(at + move + open.length) % open.length];
    if (!target) return;
    event.preventDefault();
    select(target.id, true);
  }

  function select(id, focus) {
    if (!enabled(id)) return;
    selected = id;
    visited.add(id);
    render();
    if (focus) parts.get(id).tab.focus();
  }

  function render() {
    statuses = stepStatuses(state);
    if (!enabled(selected)) selected = STEPS[0].id;
    visited.add(selected);
    for (const { id, status: current, reason: why } of statuses) {
      const { tab, panel, badge, reason, nextButton } = parts.get(id);
      const open = id === selected;
      tab.dataset.status = current;
      tab.disabled = current === 'waiting';
      tab.setAttribute('aria-selected', String(open));
      tab.tabIndex = open ? 0 : -1;
      if (why) tab.title = why;
      else tab.removeAttribute('title');
      badge.textContent = BADGE[current];
      reason.textContent = why;
      panel.hidden = !open;
      if (nextButton) {
        const next = STEPS[STEPS.findIndex(s => s.id === id) + 1];
        nextButton.disabled = status(next.id) === 'waiting';
      }
    }
    const firstWaiting = statuses.find(s => s.status === 'waiting');
    note.textContent = firstWaiting?.reason ?? '';
    note.hidden = !firstWaiting;

    const done = statuses.filter(s => s.status === 'valid' && visited.has(s.id)).length;
    progress.label.textContent = `${done} of ${STEPS.length} steps done`;
    progress.bar.max = STEPS.length;
    progress.bar.value = done;
  }

  store.subscribe(current => {
    state = current;
    render();
  });

  return { panes };
}
