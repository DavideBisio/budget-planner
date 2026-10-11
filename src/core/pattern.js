/**
 * Friendly patterns (IMP-5). Users think in words; the configuration stores a regular expression
 * string (ENG-1). This module builds the string from a mode and some words, reads a stored string
 * back into the closest mode, explains errors in plain language, and tests a pattern against
 * descriptions. Patterns are always case-insensitive, like the rest of the engine.
 */

const SPECIAL = '.*+?^${}()|[]\\';

/** Text that matches itself: every character with a meaning in a regular expression is escaped. */
export function escapeRegex(text) {
  return [...text].map(c => (SPECIAL.includes(c) ? `\\${c}` : c)).join('');
}

/**
 * The pattern for `{mode, text}` (contains, starts, ends, equals, advanced) or `{mode: 'anyOf',
 * words}`. Returns '' when there is nothing to look for.
 */
export function buildPattern({ mode, text = '', words = [] }) {
  if (mode === 'advanced') return text;
  if (mode === 'anyOf') {
    return words
      .map(w => w.trim())
      .filter(Boolean)
      .map(escapeRegex)
      .join('|');
  }
  if (text === '') return '';
  const body = escapeRegex(text);
  return { contains: body, starts: `^${body}`, ends: `${body}$`, equals: `^${body}$` }[mode];
}

/** Split at the `|` characters that are not escaped. */
function splitAlternatives(pattern) {
  const parts = [];
  let current = '';
  for (let i = 0; i < pattern.length; i += 1) {
    if (pattern[i] === '\\') {
      current += pattern[i] + (pattern[i + 1] ?? '');
      i += 1;
    } else if (pattern[i] === '|') {
      parts.push(current);
      current = '';
    } else current += pattern[i];
  }
  return [...parts, current];
}

/** The plain text a piece of pattern stands for, or null when it uses any regular expression syntax. */
function decode(piece) {
  let text = '';
  for (let i = 0; i < piece.length; i += 1) {
    const c = piece[i];
    if (c === '\\') {
      if (!SPECIAL.includes(piece[i + 1] ?? '')) return null;
      text += piece[i + 1];
      i += 1;
    } else if (SPECIAL.includes(c)) return null;
    else text += c;
  }
  return text;
}

/** True when the last character is an unescaped `$`. */
function endsWithAnchor(body) {
  if (!body.endsWith('$')) return false;
  let slashes = 0;
  for (let i = body.length - 2; i >= 0 && body[i] === '\\'; i -= 1) slashes += 1;
  return slashes % 2 === 0;
}

/** The closest mode for a stored pattern: `{mode, text}`, `{mode: 'anyOf', words}`, or advanced. */
export function parsePattern(pattern) {
  if (pattern === '') return { mode: 'contains', text: '' };
  const advanced = { mode: 'advanced', text: pattern };

  const parts = splitAlternatives(pattern);
  if (parts.length > 1) {
    const words = parts.map(decode);
    const plain = words.every(w => w !== null && w !== '' && w === w.trim());
    return plain ? { mode: 'anyOf', words } : advanced;
  }

  const starts = pattern.startsWith('^');
  const body = starts ? pattern.slice(1) : pattern;
  const ends = endsWithAnchor(body);
  const text = decode(ends ? body.slice(0, -1) : body);
  if (!text) return advanced;
  const mode = starts ? (ends ? 'equals' : 'starts') : ends ? 'ends' : 'contains';
  return { mode, text };
}

const BETWEEN = '\\s*(.+?)\\s*';

/**
 * A payee pattern in words: `{mode: 'between', before, after}` ("text between X and Y") or
 * `{mode: 'after', before}` ("text after X"). Group 1 is the text to keep. '' when incomplete.
 */
export function buildCapture({ mode, before = '', after = '' }) {
  if (before === '' || (mode === 'between' && after === '')) return '';
  return `${escapeRegex(before)}${BETWEEN}${mode === 'after' ? '$' : escapeRegex(after)}`;
}

/** Read a stored payee pattern back into `buildCapture` words, else advanced. */
export function parseCapture(pattern) {
  if (pattern === '') return { mode: 'between', before: '', after: '' };
  const advanced = { mode: 'advanced', text: pattern };
  const at = pattern.indexOf(BETWEEN);
  if (at < 0) return advanced;
  const before = decode(pattern.slice(0, at));
  const rest = pattern.slice(at + BETWEEN.length);
  if (!before) return advanced;
  if (rest === '$') return { mode: 'after', before };
  const after = decode(rest);
  return after ? { mode: 'between', before, after } : advanced;
}

const EXPLANATIONS = [
  [
    /unterminated group|unterminated parenthetical|missing \)/,
    'A bracket ( is opened but never closed. Close it with ), or write \\( to search for the bracket itself.',
  ],
  [
    /unmatched|unbalanced/,
    'A closing bracket ) has no matching opening bracket. Remove it, or write \\) to search for it.',
  ],
  [
    /unterminated character class|missing \]/,
    'A [ is opened but never closed. Close it with ], or write \\[ to search for it.',
  ],
  [
    /nothing to repeat|incomplete quantifier|lone quantifier/,
    'A * + ? or { } needs something before it to repeat. Write \\* (and so on) to search for the sign itself.',
  ],
  [/\\ at end/, 'A backslash \\ at the end needs a character after it.'],
  [/range out of order/, 'A range such as z-a is in the wrong order; write it as a-z.'],
];

/** The engine's error for a bad regular expression, as a plain-language sentence. */
export function plainRegexError(error) {
  const message = String(error?.message ?? error).toLowerCase();
  return (
    EXPLANATIONS.find(([test]) => test.test(message))?.[1] ??
    'This is not a valid pattern. Check the brackets and special characters, or use a simpler mode.'
  );
}

/** A plain-language message for a pattern that cannot be used, or null when it is fine. */
export function explainPatternError(pattern, { capture = false } = {}) {
  if (typeof pattern !== 'string' || pattern === '') return 'Enter something to look for.';
  try {
    new RegExp(pattern, 'i');
  } catch (error) {
    return plainRegexError(error);
  }
  if (capture && new RegExp(`${pattern}|`, 'i').exec('').length < 2) {
    return 'Put the part you want to keep in a group of brackets, for example (.+).';
  }
  return null;
}

/**
 * Try a pattern on descriptions. Returns `{error, total, count, matches, misses}`: `count` is the
 * number of texts that match, `matches` up to `examples` of them with the matched `ranges`
 * (`[start, end]`, for highlighting), `misses` up to `examples` that do not. With `capture`, a text
 * matches when group 1 is not blank; the range and `capture` are the group.
 */
export function testPattern(pattern, texts, { capture = false, examples = 3 } = {}) {
  const result = { error: null, total: texts.length, count: 0, matches: [], misses: [] };
  if (pattern === '') return result;
  result.error = explainPatternError(pattern, { capture });
  if (result.error) return result;

  const first = new RegExp(pattern, capture ? 'id' : 'i');
  const every = new RegExp(pattern, 'gi');
  for (const text of texts) {
    let entry = null;
    const found = first.exec(text);
    if (capture) {
      if (found?.[1]?.trim()) {
        entry = { text, ranges: [found.indices[1]], capture: found[1] };
      }
    } else if (found) {
      const ranges = [...text.matchAll(every)]
        .filter(m => m[0] !== '')
        .map(m => [m.index, m.index + m[0].length]);
      entry = { text, ranges };
    }
    if (entry) {
      result.count += 1;
      if (result.matches.length < examples) result.matches.push(entry);
    } else if (result.misses.length < examples) result.misses.push(text);
  }
  return result;
}
