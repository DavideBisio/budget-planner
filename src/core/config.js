/**
 * Configuration (ENG-1): one versioned object holding parsing, filtering, payee extraction,
 * matching rules and categories. Patterns are stored as regular expression strings.
 */
import { plainRegexError } from './pattern.js';

export const CONFIG_VERSION = 1;

const DELIMITERS = [',', ';', '\t'];
const DECIMALS = ['.', ','];
const DATE_FORMATS = ['ymd', 'dmy', 'mdy'];
const KINDS = ['', 'income', 'saving', 'expense'];

/** Migration steps keyed by the version they upgrade from. Add one when the schema changes. */
const MIGRATIONS = {};

/** The error message for an unusable pattern, or null when it compiles. Never throws. */
export function patternError(pattern) {
  if (typeof pattern !== 'string' || pattern === '') return 'invalid pattern: expected text';
  try {
    new RegExp(pattern, 'i');
    return null;
  } catch (error) {
    return `invalid pattern: ${plainRegexError(error)}`;
  }
}

/** A case-insensitive RegExp, or null when the pattern is invalid. */
export function compilePattern(pattern) {
  return patternError(pattern) ? null : new RegExp(pattern, 'i');
}

/** The sample placeholders; a fresh copy on every call. */
export function defaultConfig() {
  return {
    version: CONFIG_VERSION,
    parse: {
      delim: ',',
      decimal: '.',
      dateFmt: 'ymd',
      cols: {
        date: 'Booking date',
        value: 'Value date',
        out: 'Debit',
        in: 'Credit',
        amount: '',
        causale: 'Type',
        desc: 'Description',
      },
      openingRe: '^opening balance',
      closingRe: '^closing balance',
    },
    filter: {
      from: '',
      to: '',
      ownTransfers: true,
      own: ['transfer to own account'],
      exclude: [],
    },
    payees: ['paid to\\s+(.+?)(?:\\s+ref\\b|$)'],
    rules: [
      { p: 'payroll|acme', cat: 'Salary', kind: 'income' },
      { p: 'landlord|rent', cat: 'Housing', kind: '' },
      { p: 'broker|invest', cat: 'Investments', kind: 'saving' },
      { p: 'streamco|power utility', cat: 'Utilities', kind: '' },
      { p: 'market', cat: 'Food & dining', kind: '' },
    ],
    cats: [
      'Salary',
      'Housing',
      'Utilities',
      'Food & dining',
      'Investments',
      'Other income',
      'Other expenses',
      'Own transfers',
    ],
  };
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string';

function isIsoDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(text);
}

/** Upgrade an older configuration step by step; anything it cannot upgrade is left as is. */
export function migrateConfig(config, steps = MIGRATIONS, target = CONFIG_VERSION) {
  let current = structuredClone(config);
  while (isObject(current) && current.version < target && steps[current.version]) {
    current = steps[current.version](current);
  }
  return current;
}

/** Validate a configuration. Returns a list of `{path, message}`; empty means valid. */
export function validateConfig(config) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });

  if (!isObject(config)) return [{ path: '', message: 'configuration must be an object' }];
  if (config.version !== CONFIG_VERSION) {
    return [{ path: 'version', message: `unsupported version, expected ${CONFIG_VERSION}` }];
  }

  const pattern = (path, value) => {
    const message = patternError(value);
    if (message) add(path, message);
    return !message;
  };
  const patternList = (path, list, { capture = false } = {}) => {
    if (!Array.isArray(list)) return add(path, 'expected a list of patterns');
    list.forEach((value, i) => {
      if (!pattern(`${path}[${i}]`, value) || !capture) return;
      if (new RegExp(`${value}|`, 'i').exec('').length < 2) {
        add(`${path}[${i}]`, 'pattern needs a capture group, for example (.+)');
      }
    });
  };

  // parse
  if (!isObject(config.parse)) add('parse', 'expected an object');
  else {
    const { parse } = config;
    if (!DELIMITERS.includes(parse.delim)) add('parse.delim', 'expected , ; or tab');
    if (!DECIMALS.includes(parse.decimal)) add('parse.decimal', 'expected . or ,');
    if (!DATE_FORMATS.includes(parse.dateFmt)) add('parse.dateFmt', 'expected ymd, dmy or mdy');
    const cols = isObject(parse.cols) ? parse.cols : null;
    if (!cols) add('parse.cols', 'expected an object');
    else {
      for (const name of ['date', 'desc']) {
        if (!isText(cols[name]) || cols[name].trim() === '') {
          add(`parse.cols.${name}`, 'column name is required');
        }
      }
      for (const name of ['value', 'out', 'in', 'amount', 'causale']) {
        if (cols[name] !== undefined && !isText(cols[name])) {
          add(`parse.cols.${name}`, 'expected text');
        }
      }
      if (!cols.amount && !(cols.out && cols.in)) {
        add('parse.cols', 'needs an amount column, or both debit and credit columns');
      }
    }
    pattern('parse.openingRe', parse.openingRe);
    pattern('parse.closingRe', parse.closingRe);
  }

  // filter
  if (!isObject(config.filter)) add('filter', 'expected an object');
  else {
    const { filter } = config;
    const dateOk = {};
    for (const name of ['from', 'to']) {
      const value = filter[name];
      dateOk[name] = value === '' || (isText(value) && isIsoDate(value));
      if (!dateOk[name]) add(`filter.${name}`, 'expected a date as YYYY-MM-DD, or empty');
    }
    if (dateOk.from && dateOk.to && filter.from && filter.to && filter.to < filter.from) {
      add('filter.to', 'ends before the start date');
    }
    if (typeof filter.ownTransfers !== 'boolean')
      add('filter.ownTransfers', 'expected true or false');
    patternList('filter.own', filter.own);
    patternList('filter.exclude', filter.exclude);
  }

  patternList('payees', config.payees, { capture: true });

  const cats = Array.isArray(config.cats) ? config.cats : null;
  if (!Array.isArray(config.rules)) add('rules', 'expected a list of rules');
  else {
    config.rules.forEach((rule, i) => {
      const at = `rules[${i}]`;
      if (!isObject(rule)) return add(at, 'expected an object with p, cat and kind');
      pattern(`${at}.p`, rule.p);
      if (!isText(rule.cat) || rule.cat === '') add(`${at}.cat`, 'category is required');
      else if (cats && !cats.includes(rule.cat)) add(`${at}.cat`, `unknown category "${rule.cat}"`);
      if (!KINDS.includes(rule.kind))
        add(`${at}.kind`, 'expected income, saving, expense or empty');
    });
  }

  if (!cats) add('cats', 'expected a list of category names');
  else {
    const seen = new Set();
    cats.forEach((name, i) => {
      if (!isText(name) || name.trim() === '') add(`cats[${i}]`, 'category name is required');
      else if (seen.has(name)) add(`cats[${i}]`, `duplicate category "${name}"`);
      seen.add(name);
    });
  }

  return errors;
}
