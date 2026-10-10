# Budget Planner: instructions for Claude

Personal, offline, privacy-first budget planner. Vanilla JS (ES modules) + Vite, no backend, data stays in the browser.
The previous prototype (`budget.html`, `import.html`) lives outside this repo and is reference only.

## Privacy (hard rules)

- This repository is **public**. Never write real bank data, names, IBANs or amounts from real statements into code, tests, fixtures, docs, issues or commit messages.
- Real files live in `data/` (git-ignored). Do not read, list, grep, copy or summarise anything in `data/` except `README.md`, `sample-config.json`, `sample-bank-report.csv`. A PreToolUse hook (`scripts/privacy-guard.mjs`) enforces this; do not try to work around it.
- Do not read any `*.csv` outside `tests/fixtures/` and the sample. Test fixtures must be invented.
- If you need realistic data, extend the samples or the fixtures with fictional rows.

## Requirements and specifications

- Requirements: `docs/req/<scope>.md` (what must be true). Specifications: `docs/spec/<scope>.md` (how). Process: `docs/README.md`.
- Before working on a feature, read the requirements and spec of its scope plus `docs/req/general.md`; all requirements are equal.
- Name the requirement IDs (for example `IMP-5`) in PRs. If behaviour changes, update the requirement or spec in the same PR.

## Layout

```
src/core/     pure logic (parse, filter, match, detect, cards); no DOM, fully unit tested
src/ui/       DOM code and components
tests/unit/   vitest; tests/e2e/ playwright (mobile + desktop projects); tests/fixtures/ fictional data
scripts/      repo tooling (privacy guard)
docs/         req/ (requirements), spec/ (specifications), roadmap
```

## Commands

`npm run check` (privacy, lint, format, tests), `npm test`, `npm run e2e`, `npm run dev`, `npm run build`.
The pre-commit hook runs privacy, lint-staged, lint, format check and tests. Do not bypass it (`--no-verify`).

## Conventions

- Logic goes in `src/core` with tests first; the UI only wires it.
- Money is rounded to cents at the edges; recurring detection never averages amounts.
- Work from GitHub issues and milestones (see `docs/ROADMAP.md`); one issue per PR, reference it with `Closes #n`.
