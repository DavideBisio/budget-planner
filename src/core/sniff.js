/**
 * Suggest parsing settings from the text of a statement (IMP-3). Suggestions are offered to the
 * user and never applied silently; anything that cannot be told is left out.
 */
import { parseCsv } from './csv.js';

const DELIMITERS = [',', ';', '\t'];
const SAMPLE_ROWS = 30;
const DATE = /^\s*(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/;
const NUMBER = /^[-+]?\d[\d.,]*[.,]\d{1,2}$/;

const modal = values => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] ?? [0, 0];
};

/** The delimiter that splits the first rows into the most consistent number of columns. */
function sniffDelimiter(text) {
  let best = null;
  for (const delim of DELIMITERS) {
    const rows = parseCsv(text, delim).slice(0, SAMPLE_ROWS);
    const [columns, rowsWithIt] = modal(rows.map(r => r.length));
    const score = columns > 1 ? rowsWithIt * columns : 0;
    if (score > (best?.score ?? 0)) best = { delim, score, columns };
  }
  return best;
}

const looksLikeData = cell =>
  DATE.test(cell) || NUMBER.test(cell.trim()) || /^[-+]?\d+$/.test(cell.trim());

function sniffDateFormat(cells) {
  const formats = new Set();
  for (const cell of cells) {
    const match = DATE.exec(cell);
    if (!match) continue;
    const [first, second] = match.slice(1);
    if (first.length === 4) formats.add('ymd');
    else if (Number(first) > 12) formats.add('dmy');
    else if (Number(second) > 12) formats.add('mdy');
  }
  return formats.size === 1 ? [...formats][0] : undefined;
}

function sniffDecimal(cells) {
  let dots = 0;
  let commas = 0;
  for (const cell of cells) {
    const text = cell.trim();
    if (!NUMBER.test(text)) continue;
    const separator = /[.,]\d{1,2}$/.exec(text)[0][0];
    if (separator === '.') dots += 1;
    else commas += 1;
  }
  if (dots === commas) return undefined;
  return dots > commas ? '.' : ',';
}

/** Keywords that identify a header cell, tried in this order; a cell is used once. */
const COLUMN_KEYWORDS = [
  ['value', /value|valuta/i],
  ['out', /debit|dare|withdraw|outgoing|uscite/i],
  ['in', /credit|avere|deposit|incoming|entrate/i],
  ['desc', /descr|detail|narrat|memo|reason/i],
  ['causale', /type|causale/i],
  ['date', /book|regist|contab|^date|^data/i],
  ['amount', /amount|importo|^sum/i],
];

function sniffColumns(header) {
  const taken = new Set();
  const cols = {};
  for (const [key, pattern] of COLUMN_KEYWORDS) {
    const at = header.findIndex((cell, i) => !taken.has(i) && pattern.test(cell));
    if (at < 0) continue;
    taken.add(at);
    cols[key] = header[at].trim();
  }
  if (cols.amount && !cols.out && !cols.in) Object.assign(cols, { out: '', in: '' });
  else if (cols.out && cols.in) cols.amount ??= '';
  return cols;
}

/** Suggested `{delim, decimal, dateFmt, cols}`; keys it cannot tell are absent. */
export function sniffParse(text) {
  const found = sniffDelimiter(text);
  if (!found) return {};
  const rows = parseCsv(text, found.delim).slice(0, SAMPLE_ROWS);
  const wide = rows.filter(r => r.length === found.columns);
  const headerAt = wide.findIndex(
    row => row.filter(c => c.trim()).length >= 2 && !row.some(looksLikeData),
  );
  const data = headerAt >= 0 ? wide.slice(headerAt + 1) : wide;
  const cells = data.flat();

  const suggestion = { delim: found.delim };
  const decimal = sniffDecimal(cells);
  if (decimal) suggestion.decimal = decimal;
  const dateFmt = sniffDateFormat(cells);
  if (dateFmt) suggestion.dateFmt = dateFmt;
  if (headerAt >= 0) {
    const cols = sniffColumns(wide[headerAt]);
    if (Object.keys(cols).length) suggestion.cols = cols;
  }
  return suggestion;
}

const NAMES = {
  delim: { label: 'Delimiter', values: { ',': 'comma (,)', ';': 'semicolon (;)', '\t': 'tab' } },
  decimal: { label: 'Decimal separator', values: { '.': 'point (.)', ',': 'comma (,)' } },
  dateFmt: {
    label: 'Date format',
    values: { ymd: 'year-month-day', dmy: 'day/month/year', mdy: 'month/day/year' },
  },
};
const COLUMN_LABELS = {
  date: 'Booking date column',
  value: 'Value date column',
  out: 'Debit column',
  in: 'Credit column',
  amount: 'Amount column',
  causale: 'Type column',
  desc: 'Description column',
};

/** The suggestion as `[{key, label, value, changed}]`, `changed` when it differs from `current`. */
export function suggestionLines(suggestion, current) {
  const lines = [];
  for (const key of ['delim', 'decimal', 'dateFmt']) {
    if (suggestion[key] === undefined) continue;
    const { label, values } = NAMES[key];
    lines.push({
      key,
      label,
      value: values[suggestion[key]],
      changed: suggestion[key] !== current[key],
    });
  }
  for (const [key, label] of Object.entries(COLUMN_LABELS)) {
    if (suggestion.cols?.[key] === undefined) continue;
    const value = suggestion.cols[key];
    lines.push({
      key: `cols.${key}`,
      label,
      value: value || '(none)',
      changed: value !== (current.cols[key] ?? ''),
    });
  }
  return lines;
}

/** A copy of the parse settings with the suggestion applied. */
export function applySuggestion(parse, suggestion) {
  const next = structuredClone(parse);
  for (const key of ['delim', 'decimal', 'dateFmt']) {
    if (suggestion[key] !== undefined) next[key] = suggestion[key];
  }
  Object.assign(next.cols, suggestion.cols);
  return next;
}
