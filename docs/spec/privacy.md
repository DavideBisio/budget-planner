# Specification: privacy

Requirements: [req/privacy.md](../req/privacy.md).

## PRIV-1 and PRIV-2 Nothing private in the repository

- `.gitignore`: `data/*` is ignored except `README.md`, `sample-config.json`, `sample-bank-report.csv`; `*.csv` is ignored everywhere except the sample and `tests/fixtures/`; `.env*` is ignored.
- Pre-commit runs `scripts/privacy-guard.mjs --staged`, which also catches `git add -f`. CI runs `--tracked`.
- The PR template asks to confirm no real data in code, tests, screenshots or description. Issue templates repeat it.
- Verified by: `tests/unit/privacy-guard.test.js`, `tests/unit/privacy-guard-cli.test.js` (including `git add -f`), `tests/unit/samples.test.js`.

## PRIV-3 Claude cannot read private files

- `.claude/settings.json` registers a PreToolUse hook for Read, Grep, Glob, Edit, Write, NotebookEdit, Bash and PowerShell. The hook runs `privacy-guard.mjs --hook`, which exits with code 2 when the tool input names a protected path. Unparseable input is blocked too.
- Protected: any file or folder named `data` (at any depth) except the three tracked files, any `.csv` outside `tests/fixtures/`, `.env` files. `.env` reads are also denied by a permission rule. Use another name for code folders such as `src/data/`.
- Only the fields that say where a tool reads from are checked: `file_path`, `notebook_path`, `path`, `glob`, the pattern of Glob and the command of shell tools. Text a tool writes (file content, replacement strings, descriptions) and the search expression of Grep are not checked: they cannot expose a private file, and checking them blocked harmless edits and tests. A tool the guard does not know is checked on every field.
- Path forms covered by tests: POSIX and Windows separators, drive letters, UNC paths, WSL mount paths, `./` and `../` prefixes, upper case.
- Limits:
  - Shell commands are checked by their words, not by what they compute at runtime (variables, command substitution, scripts that build a path). A command can still read a private file through such an indirection.
  - A bare `data` word in a shell command is treated as prose, so `cd data` alone is not blocked while `cat data/x` is.
  - The hook only applies to sessions started in this repository with this settings file. Another tool, or a session started in a parent folder, is not covered.
- Live check (session of #10): Read, Write and Bash on a private path were blocked. Grep, Glob and PowerShell were not available in that session, so they are covered by unit tests only.
- Optional data directory outside the repository (`BUDGET_DATA_DIR`), evaluated and not adopted for now: it would let the guard protect a second location, but the real protection is keeping private files out of the repository tree and out of sessions started there. If it is added later, the guard must read the variable from the hook environment and treat every path under it as protected.
- Issue: #10.
- Verified by: `tests/unit/privacy-guard.test.js` and `tests/unit/privacy-guard-cli.test.js` (path forms, hook exit codes, `git add -f` in a temporary repository).
- Verified by: unit tests of the guard; manual check in a live session (open).

## PRIV-4 Fictional fixtures

- Fixtures live in `tests/fixtures/`. A test scans them for IBAN-like and long digit patterns.
- Issue: #9. Verified by: `tests/unit/fixtures.test.js`.

## PRIV-5 Data stays in the browser

- No upload code and no third-party scripts; the CSP of GEN-3 blocks connections.
- Verified by: the offline e2e check of GEN-3.
