// The friendly pattern input (IMP-5), used by every pattern field. The user picks a way of
// matching and types plain words; the stored value stays a regular expression string (ENG-1).
import {
  buildCapture,
  buildPattern,
  explainPatternError,
  parseCapture,
  parsePattern,
  testPattern,
} from '../core/pattern.js';
import { h, uid, fill } from './dom.js';

const TEXT_MODES = ['contains', 'starts', 'ends', 'equals'];

const MODES = [
  ['contains', 'contains'],
  ['starts', 'starts with'],
  ['ends', 'ends with'],
  ['equals', 'is exactly'],
  ['anyOf', 'is any of these words'],
  ['advanced', 'advanced (regular expression)'],
];

const CAPTURE_MODES = [
  ['between', 'text between two words'],
  ['after', 'text after a word'],
  ['advanced', 'advanced (regular expression)'],
];

const emptyState = mode => ({ mode, text: '', words: [], before: '', after: '', regex: '' });

function fromPattern(pattern, capture) {
  const state = emptyState(capture ? 'between' : 'contains');
  const parsed = capture ? parseCapture(pattern) : parsePattern(pattern);
  const { mode } = parsed;
  if (mode === 'advanced') return { ...state, mode, regex: parsed.text };
  if (mode === 'anyOf') return { ...state, mode, words: parsed.words };
  if (mode === 'between' || mode === 'after') {
    return { ...state, mode, before: parsed.before, after: parsed.after ?? '' };
  }
  return { ...state, mode, text: parsed.text };
}

function toPattern(state, capture) {
  if (state.mode === 'advanced') return state.regex;
  if (capture) return buildCapture({ mode: state.mode, before: state.before, after: state.after });
  return buildPattern({ mode: state.mode, text: state.text, words: state.words });
}

/** The text with the matched ranges wrapped in <mark>. */
function highlight(text, ranges) {
  const parts = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start < at) continue;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(h('mark', {}, text.slice(start, end)));
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

/**
 * Create a pattern field. `capture` makes it a payee field (group 1 is the payee). Returns
 * `{node, setValue, setTexts}`; `onChange(pattern)` runs when the user changes the pattern.
 */
export function createPatternInput({ label, value = '', capture = false, texts = [], onChange }) {
  const id = uid('pattern');
  const modes = capture ? CAPTURE_MODES : MODES;
  let state = fromPattern(value, capture);
  let pattern = value;
  let samples = texts;

  const input = (name, labelText, hint) => {
    const control = h('input', { type: 'text', id: `${id}-${name}` });
    const wrap = h(
      'div',
      { class: 'field' },
      h('label', { for: control.id }, labelText),
      control,
      hint ? h('span', { class: 'hint' }, hint) : null,
    );
    return { control, wrap };
  };

  const mode = h(
    'select',
    { id: `${id}-mode`, onchange: event => switchMode(event.target.value) },
    modes.map(([key, text]) => h('option', { value: key }, text)),
  );
  const modeField = h(
    'div',
    { class: 'field' },
    h('label', { for: mode.id }, 'Match when the text'),
    mode,
  );

  const text = input('text', 'Text to look for');
  const before = input('before', 'Text just before the part to keep', 'For example: paid to');
  const after = input('after', 'Text just after the part to keep', 'For example: ref');
  const regex = input(
    'regex',
    'Regular expression',
    capture ? 'The first group in brackets is the part to keep.' : 'Ignores upper and lower case.',
  );

  const chips = h('ul', { class: 'chips', 'aria-label': 'Words' });
  const wordInput = h('input', { type: 'text', id: `${id}-word` });
  const addWord = () => {
    const word = wordInput.value.trim();
    if (!word) return;
    if (!state.words.includes(word)) state.words = [...state.words, word];
    wordInput.value = '';
    changed();
    wordInput.focus();
  };
  wordInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addWord();
  });
  const words = h(
    'div',
    { class: 'field' },
    h('label', { for: wordInput.id }, 'Add a word'),
    h(
      'div',
      { class: 'chip-add' },
      wordInput,
      h('button', { class: 'btn secondary', type: 'button', onclick: addWord }, 'Add'),
    ),
    chips,
    h('span', { class: 'hint' }, 'Matches any one of the words.'),
  );

  const stored = h('code', {});
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const feedback = h('div', { class: 'pattern-feedback', 'aria-live': 'polite' });
  const node = h(
    'fieldset',
    { class: 'group pattern-input' },
    h('legend', {}, label),
    modeField,
    text.wrap,
    words,
    before.wrap,
    after.wrap,
    regex.wrap,
    error,
    feedback,
    h('p', { class: 'hint' }, 'Stored as: ', stored),
  );

  for (const [key, control] of [
    ['text', text.control],
    ['before', before.control],
    ['after', after.control],
    ['regex', regex.control],
  ]) {
    control.addEventListener('input', () => {
      state[key] = control.value;
      changed();
    });
  }

  function switchMode(next) {
    const current = toPattern(state, capture);
    if (next === 'advanced') state.regex = current;
    else if (state.mode === 'advanced') {
      const parsed = fromPattern(current, capture);
      state = parsed.mode === 'advanced' ? emptyState(next) : parsed;
    }
    state.mode = next;
    changed();
  }

  function renderChips() {
    fill(
      chips,
      ...state.words.map(word =>
        h(
          'li',
          { class: 'chip' },
          h('span', {}, word),
          h(
            'button',
            {
              class: 'chip-remove',
              type: 'button',
              'aria-label': `Remove ${word}`,
              onclick: () => {
                state.words = state.words.filter(w => w !== word);
                changed();
              },
            },
            '×',
          ),
        ),
      ),
    );
  }

  function exampleList(title, items) {
    return h('div', {}, h('h4', {}, title), h('ul', { class: 'plain examples' }, items));
  }

  function renderFeedback() {
    const message = pattern ? explainPatternError(pattern, { capture }) : null;
    error.textContent = message ?? '';
    error.hidden = !message;
    stored.textContent = pattern || '(nothing yet)';

    if (!pattern || message) {
      fill(
        feedback,
        h('p', { class: 'hint' }, pattern ? '' : 'Type something to see which descriptions match.'),
      );
      return;
    }
    if (!samples.length) {
      fill(feedback, h('p', { class: 'hint' }, 'Import a file to see which descriptions match.'));
      return;
    }
    const result = testPattern(pattern, samples, { capture });
    fill(
      feedback,
      h(
        'p',
        { class: 'match-count' },
        capture
          ? `A name is found in ${result.count} of ${result.total} descriptions.`
          : `${result.count} of ${result.total} descriptions match.`,
      ),
      result.matches.length
        ? exampleList(
            capture ? 'Examples (the name is marked)' : 'Matching examples',
            result.matches.map(m => h('li', {}, highlight(m.text, m.ranges))),
          )
        : null,
      result.misses.length
        ? exampleList(
            capture ? 'No name found in' : 'Not matching',
            result.misses.map(t => h('li', {}, t)),
          )
        : null,
    );
  }

  function render() {
    mode.value = state.mode;
    const simple = TEXT_MODES.includes(state.mode);
    text.wrap.hidden = !simple;
    words.hidden = state.mode !== 'anyOf';
    before.wrap.hidden = !(state.mode === 'between' || state.mode === 'after');
    after.wrap.hidden = state.mode !== 'between';
    regex.wrap.hidden = state.mode !== 'advanced';
    for (const [key, control] of [
      ['text', text.control],
      ['before', before.control],
      ['after', after.control],
      ['regex', regex.control],
    ]) {
      if (control.value !== state[key]) control.value = state[key];
    }
    renderChips();
    renderFeedback();
  }

  function changed() {
    const next = toPattern(state, capture);
    const same = next === pattern;
    pattern = next;
    render();
    if (!same) onChange?.(pattern);
  }

  render();
  return {
    node,
    /** Show a stored pattern (does not call onChange). Ignored when it is already what is shown. */
    setValue(next) {
      if (next === pattern) return;
      pattern = next;
      state = fromPattern(next, capture);
      render();
    },
    /** The descriptions the feedback is computed against. */
    setTexts(next) {
      samples = next;
      renderFeedback();
    },
  };
}
