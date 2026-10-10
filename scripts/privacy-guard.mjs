#!/usr/bin/env node
/**
 * Privacy guard: keeps real bank data away from Claude Code sessions and out of git.
 *
 *   --hook      Claude Code PreToolUse hook. Reads the tool call as JSON on stdin and exits 2
 *               (block) if it touches protected files.
 *   --staged    pre-commit: fail if a protected file is staged (even with `git add -f`).
 *   --tracked   CI: fail if a protected file is tracked anywhere in the repository.
 *
 * Protected: everything under data/ except the README and the two samples, any *.csv outside
 * tests/fixtures/ (and the sample), and .env files. Best effort for shell commands: it inspects
 * the words of the command line, it cannot see paths a script builds at runtime.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ALLOWED = [
  /(^|\/)data\/(README\.md|sample-config\.json|sample-bank-report\.csv)$/i,
  /(^|\/)tests\/fixtures\//i,
];
const PROTECTED = [/(^|\/)data(\/|$)/i, /\.csv$/i, /(^|\/)\.env(\..+)?$/i];

export function isProtected(path) {
  const p = String(path).replaceAll('\\', '/').trim();
  if (!p || ALLOWED.some(re => re.test(p))) return false;
  return PROTECTED.some(re => re.test(p));
}

const WORD_SPLIT = /[\s"'`=;|&,()<>]+/;

/** Protected paths mentioned anywhere in a tool call's input. */
export function protectedPathsIn(toolName, input) {
  const hits = new Set();
  const visit = value => {
    if (typeof value === 'string') {
      const shell = toolName === 'Bash' || toolName === 'PowerShell';
      // a bare "data" word in a shell command is usually prose; file tools pass real paths (which
      // may contain spaces), so they are checked whole
      const words = value.split(WORD_SPLIT).filter(w => !shell || w.toLowerCase() !== 'data');
      if (!shell) words.push(value);
      for (const w of words) if (isProtected(w)) hits.add(w);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(input);
  return [...hits];
}

const gitFiles = args =>
  execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);

function main(mode) {
  if (mode === '--hook') {
    let call;
    try {
      call = JSON.parse(readFileSync(0, 'utf8'));
    } catch {
      console.error('Privacy guard: could not parse the tool call, blocking to be safe.');
      return 2;
    }
    const hits = protectedPathsIn(call.tool_name, call.tool_input);
    if (hits.length) {
      console.error(
        `Blocked by the privacy guard: ${hits.join(', ')}. ` +
          'Private bank data must not be read by Claude. Use data/sample-* or tests/fixtures/ instead.',
      );
      return 2;
    }
    return 0;
  }
  const files =
    mode === '--staged'
      ? gitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
      : mode === '--tracked'
        ? gitFiles(['ls-files'])
        : null;
  if (!files) {
    console.error('usage: privacy-guard.mjs --hook | --staged | --tracked');
    return 64;
  }
  const bad = files.filter(isProtected);
  if (bad.length) {
    console.error(`Private files must not be committed:\n  ${bad.join('\n  ')}`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = main(process.argv[2]);
}
