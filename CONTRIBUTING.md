# Contributing

## Workflow

1. Pick an issue from the current milestone ([roadmap](docs/ROADMAP.md)).
2. Branch from `main`: `feat/<issue>-short-name`, `fix/...`, `chore/...`.
3. Write the test first for logic in `src/core`, then the code.
4. `git commit`: the pre-commit hook runs the privacy guard, lint-staged (ESLint + Prettier on staged files),
   a full lint, a Prettier check and the unit tests. If it fails, fix the cause; do not use `--no-verify`.
5. Open a PR using the template; CI must be green (privacy, lint, format, tests with coverage, build, e2e).

## Quality gates

| Gate                                       | Where                                                  |
| ------------------------------------------ | ------------------------------------------------------ |
| Privacy (no private files tracked)         | pre-commit, CI                                         |
| ESLint, html-validate, stylelint, Prettier | pre-commit, CI                                         |
| Unit tests (vitest)                        | pre-commit, CI                                         |
| E2E mobile + desktop (Playwright)          | CI (`npm run e2e` locally after `npm run e2e:install`) |

## Tests

| Kind | Where                         | Name                                                        |
| ---- | ----------------------------- | ----------------------------------------------------------- |
| Unit | `tests/unit/<module>.test.js` | mirrors `src/core/<module>.js`; one `describe` per function |
| E2E  | `tests/e2e/<feature>.spec.js` | one spec per page or feature; both projects run it          |

- Test first for anything in `src/core`. Name tests by behaviour ("keeps duplicate rows distinct"), and name the requirement ID in the `describe` when one applies.
- Core tests need no mocks: functions take their inputs (configuration, dates) as arguments. No network, no clock, no randomness.
- `src/core` must stay at 90% line coverage or more. `npm run test:coverage` fails below it, locally and in CI.
- `src/core` is free of browser APIs; ESLint reports `window`, `document`, `localStorage`, `fetch` and imports from `src/ui`.
- E2E layout checks use the helpers in `tests/e2e/helpers.js`. A new page must be added to `PAGES` there.

### Fixtures

- Fixtures live in `tests/fixtures/` and are **invented**: fictional names, round amounts, no IBAN-like strings, no long digit runs. A unit test scans every fixture and fails on both.
- Keep each fixture small and aimed at one case. The set covers: comma and semicolon delimiters, decimal point and decimal comma, split debit/credit and a single signed amount, BOM and CRLF, duplicate rows, missing balance rows.
- `bom-crlf` is marked `-text` in `.gitattributes` so Git keeps its BOM and CRLF bytes.
- Never copy a real statement into a fixture, not even edited. Extend the invented ones instead.

## Requirements and specifications

Requirements are in `docs/req/`, specifications in `docs/spec/`, one file per scope (see `docs/README.md`).
Name the requirement IDs in your PR and keep the docs in step with the code.

## Privacy model

- `data/` holds your real files and is git-ignored, except `README.md` and the two `sample-*` files.
- `*.csv` is ignored everywhere, except `tests/fixtures/` and the sample.
- `scripts/privacy-guard.mjs` is used three ways: as a Claude Code PreToolUse hook (blocks tools and shell
  commands naming private files), in pre-commit (`--staged`) and in CI (`--tracked`).
- The Claude hook checks the path fields of each tool call, not the text being written. It is best effort for
  shell commands (it reads the words of the command, not paths built at runtime) and only applies to sessions
  started in this repository. Details and limits: `docs/spec/privacy.md`. Keep real files out of the repo
  tree if you want a stronger guarantee.
