# Specification: privacy

Requirements: [req/privacy.md](../req/privacy.md).

## PRIV-1 and PRIV-2 Nothing private in the repository

- `.gitignore`: `data/*` is ignored except `README.md`, `sample-config.json`, `sample-bank-report.csv`; `*.csv` is ignored everywhere except the sample and `tests/fixtures/`; `.env*` is ignored.
- Pre-commit runs `scripts/privacy-guard.mjs --staged`, which also catches `git add -f`. CI runs `--tracked`.
- The PR template asks to confirm no real data in code, tests, screenshots or description. Issue templates repeat it.
- Verified by: `tests/unit/privacy-guard.test.js`, `tests/unit/samples.test.js`.

## PRIV-3 Claude cannot read private files

- `.claude/settings.json` registers a PreToolUse hook for Read, Grep, Glob, Edit, Write, NotebookEdit, Bash and PowerShell. The hook runs `privacy-guard.mjs --hook`, which exits with code 2 when the tool input names a protected path. Unparseable input is blocked too.
- Protected: anything under `data/` except the three tracked files, any `.csv` outside `tests/fixtures/`, `.env` files. `.env` reads are also denied by a permission rule.
- Limits: shell commands are checked by their words, not by what they compute at runtime; the hook only applies to sessions started in this repository.
- Issue: #10 (live verification, tests for more path forms, optional data directory outside the repository tree).
- Verified by: unit tests of the guard; manual check in a live session (open).

## PRIV-4 Fictional fixtures

- Fixtures live in `tests/fixtures/`. A test scans them for IBAN-like and long digit patterns.
- Issue: #9.

## PRIV-5 Data stays in the browser

- No upload code and no third-party scripts; the CSP of GEN-3 blocks connections.
- Verified by: the offline e2e check of GEN-3.
