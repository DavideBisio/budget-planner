// The guided sequence (IMP-1, IMP-2): one collapsible section per step with a purpose line and a
// status badge. Statuses come from core; the body of each step is mounted by its own module.
import { STEPS, stepStatuses } from '../../core/steps.js';

const BADGE = { todo: 'To do', valid: 'Ready', attention: 'Needs attention', waiting: 'Waiting' };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Build the sections inside `list` and keep them in sync with the store. Returns the bodies by step id. */
export function mountStepper(list, store, progress) {
  const sections = new Map();
  const bodies = {};

  for (const [index, step] of STEPS.entries()) {
    const item = element('li', 'step-section');
    const heading = element('h2', 'step-heading');
    const toggle = element('button', 'step-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', `step-body-${step.id}`);
    const text = element('span', 'step-text');
    const reason = element('span', 'step-reason');
    text.append(
      element('span', 'step-title', step.title),
      element('span', 'step-purpose', step.purpose),
      reason,
    );
    const badge = element('span', 'badge');
    toggle.append(text, badge);
    heading.append(toggle);

    const body = element('div', 'step-body');
    body.id = `step-body-${step.id}`;
    bodies[step.id] = body;
    item.append(element('span', 'step-number', String(index + 1)), heading, body);
    list.append(item);

    toggle.addEventListener('click', () =>
      setOpen(step.id, toggle.getAttribute('aria-expanded') !== 'true'),
    );
    sections.set(step.id, { item, toggle, body, badge, reason });
  }

  function setOpen(id, open) {
    const { toggle, body } = sections.get(id);
    toggle.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
  }

  let firstRender = true;
  store.subscribe(state => {
    const statuses = stepStatuses(state);
    for (const { id, status, reason: why } of statuses) {
      const { item, toggle, badge, reason } = sections.get(id);
      item.dataset.status = status;
      toggle.disabled = status === 'waiting';
      badge.textContent = BADGE[status];
      reason.textContent = why;
      reason.hidden = !why;
      if (status === 'waiting') setOpen(id, false);
    }
    if (firstRender) {
      for (const step of STEPS) setOpen(step.id, step === STEPS[0]);
      firstRender = false;
    }
    const ready = statuses.filter(s => s.status === 'valid').length;
    progress.label.textContent = `${ready} of ${STEPS.length} steps ready`;
    progress.bar.value = ready;
    progress.bar.max = STEPS.length;
  });

  return bodies;
}
