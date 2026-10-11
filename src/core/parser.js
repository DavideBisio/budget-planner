/**
 * Statement parser (ENG-2): raw text to transactions, using only the parse settings.
 * Amounts are integer cents (money in is positive, money out is negative); dates are YYYY-MM-DD.
 */
import { compilePattern } from './config.js';
import { parseCsv } from './csv.js';

const HEADER_SEARCH_ROWS = 30;

/** Integer cents from text such as "1.234,56", or null when empty or not a number. */
export function parseAmount(text, decimal) {
  const cleaned = String(text).replace(/[\s€$£]/g, '');
  const thousands = decimal === '.' ? ',' : '.';
  const plain = cleaned.split(thousands).join('');
  const pattern = new RegExp(`^([+-]?)(\\d*)(?:\\${decimal}(\\d*))?$`);
  const match = pattern.exec(plain);
  if (!match || (match[2] === '' && !match[3])) return null;
  const [, sign, whole, fraction = ''] = match;
  const digits = (fraction + '000').slice(0, 3);
  const cents =
    Number(whole || 0) * 100 + Number(digits.slice(0, 2)) + (Number(digits[2]) >= 5 ? 1 : 0);
  return sign === '-' ? -cents || 0 : cents;
}

/** YYYY-MM-DD from a date in the given format (ymd, dmy, mdy), or null. */
export function parseDate(text, format) {
  const match = /^\s*(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/.exec(String(text));
  if (!match) return null;
  const [a, b, c] = match.slice(1).map(Number);
  const [year, month, day] = { ymd: [a, b, c], dmy: [c, b, a], mdy: [c, a, b] }[format];
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));
  const valid =
    date.getUTCFullYear() === fullYear &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!valid) return null;
  const pad = (n, width) => String(n).padStart(width, '0');
  return `${pad(fullYear, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

const findColumn = (header, name) => {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return -1;
  return header.findIndex(cell => cell.trim().toLowerCase().startsWith(wanted));
};

/** The columns this configuration needs, as [key, configured name]. */
function requiredColumns(cols) {
  const required = [
    ['date', cols.date],
    ['desc', cols.desc],
  ];
  if (cols.amount) required.push(['amount', cols.amount]);
  else required.push(['out', cols.out], ['in', cols.in]);
  return required;
}

/**
 * Parse one statement file.
 * Returns `{file, transactions, opening, closing, warnings, errors}`. `errors` (a missing
 * column, an empty file) mean nothing was parsed; `warnings` list rows that were skipped.
 */
export function parseStatement(text, parse, file = 'statement') {
  const result = { file, transactions: [], opening: null, closing: null, warnings: [], errors: [] };
  const rows = parseCsv(text, parse.delim);
  if (!rows.length) {
    result.errors.push({ file, column: '', message: `${file}: the file is empty` });
    return result;
  }

  const { cols } = parse;
  const required = requiredColumns(cols);
  const found = row => required.filter(([, name]) => findColumn(row, name) >= 0).length;
  let headerAt = 0;
  rows.slice(0, HEADER_SEARCH_ROWS).forEach((row, i) => {
    if (found(row) > found(rows[headerAt])) headerAt = i;
  });
  const header = rows[headerAt];

  const missing = required.filter(([, name]) => findColumn(header, name) < 0);
  if (missing.length) {
    result.errors = missing.map(([, name]) => ({
      file,
      column: name,
      message: `${file}: column "${name}" not found in the header`,
    }));
    return result;
  }

  const at = {};
  for (const key of ['date', 'value', 'out', 'in', 'amount', 'causale', 'desc']) {
    at[key] = findColumn(header, cols[key] ?? '');
  }
  const openingRe = compilePattern(parse.openingRe);
  const closingRe = compilePattern(parse.closingRe);
  const seen = new Map();
  const warn = (row, message) =>
    result.warnings.push({ file, row, message: `${file}, row ${row}: ${message}` });
  const cell = (row, key) => (at[key] >= 0 ? (row[at[key]] ?? '').trim() : '');

  /** Cents of a row, or `{error}` when the amount is missing or unreadable. */
  const amountOf = row => {
    if (cols.amount) {
      const text = cell(row, 'amount');
      const cents = parseAmount(text, parse.decimal);
      return cents === null ? { error: text ? 'unreadable amount' : 'no amount' } : { cents };
    }
    const texts = [cell(row, 'out'), cell(row, 'in')];
    const [out, inn] = texts.map(t => parseAmount(t, parse.decimal));
    if (texts.some((t, i) => t && [out, inn][i] === null)) return { error: 'unreadable amount' };
    if (out === null && inn === null) return { error: 'no amount' };
    return { cents: (inn ?? 0) - Math.abs(out ?? 0) };
  };

  rows.slice(headerAt + 1).forEach((row, i) => {
    const rowNumber = headerAt + 2 + i;
    const desc = cell(row, 'desc');
    const isOpening = openingRe?.test(desc);
    const isClosing = !isOpening && closingRe?.test(desc);
    if (isOpening || isClosing) {
      const amount = amountOf(row);
      if (amount.error) return warn(rowNumber, `balance row has ${amount.error}`);
      if (isOpening) result.opening ??= amount.cents;
      else result.closing = amount.cents;
      return;
    }

    const dateText = cell(row, 'date');
    const date = dateText ? parseDate(dateText, parse.dateFmt) : null;
    if (!date) return warn(rowNumber, dateText ? 'unreadable date' : 'no booking date');
    const amount = amountOf(row);
    if (amount.error) return warn(rowNumber, amount.error);

    const key = `${date}|${amount.cents}|${desc}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    result.transactions.push({
      id: `${key}#${n}`,
      date,
      valueDate: parseDate(cell(row, 'value'), parse.dateFmt) ?? '',
      amount: amount.cents,
      desc,
      type: cell(row, 'causale'),
      raw: Object.fromEntries(header.map((name, col) => [name, row[col] ?? ''])),
      file,
      row: rowNumber,
    });
  });
  return result;
}
