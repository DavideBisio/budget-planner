// Step 1 (IMP-3): parsing settings, suggestions from a sample file, and a live preview.
import { applySuggestion, sniffParse, suggestionLines } from '../../core/sniff.js';
import { parseStatement } from '../../core/parser.js';
import { h, uid } from '../dom.js';
import { formatCents } from '../format.js';
import { createPatternInput } from '../pattern-input.js';
import { errorsIn, updateConfig } from './config-edit.js';

const PREVIEW_ROWS = 8;

const CHOICES = {
  delim: [
    [',', 'Comma (,)'],
    [';', 'Semicolon (;)'],
    ['\t', 'Tab'],
  ],
  decimal: [
    ['.', 'Point (.)'],
    [',', 'Comma (,)'],
  ],
  dateFmt: [
    ['ymd', 'Year-month-day (2026-01-31)'],
    ['dmy', 'Day/month/year (31/01/2026)'],
    ['mdy', 'Month/day/year (01/31/2026)'],
  ],
};

const COLUMNS = [
  ['date', 'Booking date column', 'Required'],
  ['desc', 'Description column', 'Required'],
  ['out', 'Debit column (money out)', 'Needed with the credit column, unless one amount column'],
  ['in', 'Credit column (money in)', 'Needed with the debit column, unless one amount column'],
  ['amount', 'Amount column (one signed column)', 'Leave empty when debit and credit are separate'],
  ['value', 'Value date column', 'Optional'],
  ['causale', 'Type column', 'Optional'],
];

/** A labelled control with a hint and an error line that `render` fills in. */
function field(label, control, hint) {
  const id = uid('parse');
  control.id = id;
  const error = h('span', { class: 'error', id: `${id}-error`, hidden: true });
  control.setAttribute('aria-describedby', [hint ? `${id}-hint` : '', error.id].join(' ').trim());
  const node = h(
    'div',
    { class: 'field' },
    h('label', { for: id }, label),
    control,
    hint ? h('span', { class: 'hint', id: `${id}-hint` }, hint) : null,
    error,
  );
  return { node, error, control };
}

const select = (choices, onChange) =>
  h(
    'select',
    { onchange: event => onChange(event.target.value) },
    choices.map(([value, label]) => h('option', { value }, label)),
  );

const text = onChange =>
  h('input', { type: 'text', oninput: event => onChange(event.target.value) });

const group = (legend, ...nodes) =>
  h('fieldset', { class: 'group' }, h('legend', {}, legend), nodes);

function previewTable(result) {
  const head = ['Row', 'Booking date', 'Amount', 'Type', 'Description'];
  return h(
    'div',
    { class: 'table-wrap', tabindex: 0, role: 'region', 'aria-label': 'First rows as parsed' },
    h(
      'table',
      {},
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          head.map(c => h('th', { scope: 'col' }, c)),
        ),
      ),
      h(
        'tbody',
        {},
        result.transactions
          .slice(0, PREVIEW_ROWS)
          .map(t =>
            h(
              'tr',
              {},
              h('td', {}, String(t.row)),
              h('td', {}, t.date),
              h('td', { class: 'num' }, formatCents(t.amount)),
              h('td', {}, t.type),
              h('td', {}, t.desc),
            ),
          ),
      ),
    ),
  );
}

/** The text to preview and to sniff: the chosen sample, else the first imported file. */
const subjectOf = ({ sample, sources }) => sample ?? sources[0] ?? null;

export function mountParsing(body, store, results) {
  const set = (path, value) => updateConfig(store, ['parse', ...path], value);

  const fields = {
    delim: field(
      'Delimiter',
      select(CHOICES.delim, v => set(['delim'], v)),
    ),
    decimal: field(
      'Decimal separator',
      select(CHOICES.decimal, v => set(['decimal'], v)),
    ),
    dateFmt: field(
      'Date format',
      select(CHOICES.dateFmt, v => set(['dateFmt'], v)),
    ),
  };
  for (const [key, label, hint] of COLUMNS) {
    fields[`cols.${key}`] = field(
      label,
      text(v => set(['cols', key], v)),
      hint,
    );
  }
  const balancePatterns = {
    openingRe: createPatternInput({
      label: 'Opening balance row',
      value: store.get().config.parse.openingRe,
      onChange: v => set(['openingRe'], v),
    }),
    closingRe: createPatternInput({
      label: 'Closing balance row',
      value: store.get().config.parse.closingRe,
      onChange: v => set(['closingRe'], v),
    }),
  };

  // Suggestions come from a sample file and are never applied until the user says so.
  const sampleId = uid('sample');
  const suggestions = h('div', { class: 'suggestions', 'aria-live': 'polite' });
  const sampleField = h(
    'div',
    { class: 'field' },
    h('label', { for: sampleId }, 'Sample statement'),
    h('input', {
      type: 'file',
      id: sampleId,
      accept: '.csv,.txt,.tsv,text/csv,text/plain',
      onchange: async event => {
        const [file] = event.target.files;
        if (file) store.set({ sample: { name: file.name, text: await file.text() } });
      },
    }),
    h(
      'span',
      { class: 'hint' },
      'Used to suggest settings and to preview. It stays in this browser.',
    ),
  );

  body.append(
    sampleField,
    suggestions,
    group('Format', ...['delim', 'decimal', 'dateFmt'].map(k => fields[k].node)),
    group('Columns', ...COLUMNS.map(([k]) => fields[`cols.${k}`].node)),
    group('Balance rows', balancePatterns.openingRe.node, balancePatterns.closingRe.node),
  );

  const preview = results.card('parsing', 'Parsing preview');
  let suggestedFor = null;

  function renderSuggestions(state) {
    const { config } = state;
    const sample = subjectOf(state);
    if (!sample) {
      suggestions.replaceChildren();
      suggestedFor = null;
      return;
    }
    const suggestion = sniffParse(sample.text);
    const lines = suggestionLines(suggestion, config.parse);
    const changes = lines.filter(l => l.changed);
    const key = JSON.stringify([sample.name, lines]);
    if (key === suggestedFor) return;
    suggestedFor = key;
    suggestions.replaceChildren(
      h('h3', {}, 'Suggested settings'),
      lines.length
        ? h(
            'ul',
            { class: 'plain' },
            lines.map(l =>
              h('li', {}, `${l.label}: ${l.value}${l.changed ? '' : ' (already set)'}`),
            ),
          )
        : h('p', {}, 'No settings could be told from this file. Fill them in below.'),
      lines.length && suggestion.dateFmt === undefined
        ? h('p', {}, 'Date format could not be told from this file. Check it below.')
        : null,
      changes.length
        ? h(
            'button',
            {
              class: 'btn',
              type: 'button',
              onclick: () =>
                updateConfig(
                  store,
                  ['parse'],
                  applySuggestion(store.get().config.parse, suggestion),
                ),
            },
            'Apply suggestions',
          )
        : lines.length
          ? h('p', {}, 'Your settings already match.')
          : null,
    );
  }

  function renderPreview(state, result) {
    const { config } = state;
    const sample = subjectOf(state);
    if (!sample) {
      results.show('parsing', false);
      return;
    }
    results.show('parsing', true);
    if (errorsIn(config, 'parse').length) {
      preview.replaceChildren(
        h('p', { role: 'alert' }, 'Fix the settings on the left to see the preview.'),
      );
      return;
    }
    const balances = [];
    if (result.opening !== null) balances.push(`Opening balance ${formatCents(result.opening)}`);
    if (result.closing !== null) balances.push(`Closing balance ${formatCents(result.closing)}`);
    preview.replaceChildren(
      h('p', {}, `${sample.name}: ${result.transactions.length} transactions read.`),
      balances.length ? h('p', {}, balances.join(' · ')) : null,
      result.errors.length
        ? h(
            'ul',
            { class: 'plain', role: 'alert' },
            result.errors.map(e => h('li', {}, e.message)),
          )
        : result.transactions.length
          ? previewTable(result)
          : h('p', {}, 'No transaction rows were found.'),
      result.warnings.length
        ? h(
            'details',
            {},
            h('summary', {}, `${result.warnings.length} rows skipped`),
            h(
              'ul',
              { class: 'plain' },
              result.warnings.slice(0, 20).map(w => h('li', {}, w.message)),
            ),
          )
        : null,
    );
  }

  store.subscribe(state => {
    const { parse } = state.config;
    const errors = errorsIn(state.config, 'parse');
    const values = {
      delim: parse.delim,
      decimal: parse.decimal,
      dateFmt: parse.dateFmt,
      ...Object.fromEntries(COLUMNS.map(([k]) => [`cols.${k}`, parse.cols[k] ?? ''])),
    };
    for (const [key, { control, error }] of Object.entries(fields)) {
      if (control.value !== values[key]) control.value = values[key];
      const message = errors.find(e => e.path === `parse.${key}`)?.message ?? '';
      error.textContent = message;
      error.hidden = !message;
      if (message) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    }
    const subject = subjectOf(state);
    const parsed =
      subject && !errors.length ? parseStatement(subject.text, parse, subject.name) : null;
    for (const [key, input] of Object.entries(balancePatterns)) {
      input.setValue(parse[key]);
      input.setTexts(parsed?.descriptions ?? []);
    }
    renderSuggestions(state);
    renderPreview(state, parsed);
  });
}
