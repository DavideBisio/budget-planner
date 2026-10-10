# Contributing

## Workflow

1. Pick an issue from the current milestone ([roadmap](docs/ROADMAP.md)).
2. Branch from `main`: `feat/<issue>-short-name`, `fix/...`, `chore/...`.
3. Write the test first for logic in `src/core`, then the code.
4. `git commit`: the pre-commit hook runs the privacy guard, lint-staged (ESLint + Prettier on staged files),
   a full lint, a Prettier check and the unit tests. If it fails, fix the cause; do not use `--no-verify`.
5. Open a PR using the template; CI must be green (privacy, lint, format, tests with coverage, build, e2e).

## Quality gates

| Gate                               | Where                                                  |
| ---------------------------------- | ------------------------------------------------------ |
| Privacy (no private files tracked) | pre-commit, CI                                         |
| ESLint, Prettier                   | pre-commit, CI                                         |
| Unit tests (vitest)                | pre-commit, CI                                         |
| E2E mobile + desktop (Playwright)  | CI (`npm run e2e` locally after `npm run e2e:install`) |

## Requirements and specifications

Requirements are in `docs/req/`, specifications in `docs/spec/`, one file per scope (see `docs/README.md`).
Name the requirement IDs in your PR and keep the docs in step with the code.

## Privacy model

- `data/` holds your real files and is git-ignored, except `README.md` and the two `sample-*` files.
- `*.csv` is ignored everywhere, except `tests/fixtures/` and the sample.
- `scripts/privacy-guard.mjs` is used three ways: as a Claude Code PreToolUse hook (blocks tools and shell
  commands naming private files), in pre-commit (`--staged`) and in CI (`--tracked`).
- The Claude hook is best effort for shell commands (it reads the words of the command, not paths built at
  runtime) and only applies to sessions started in this repository. Keep real files out of the repo
  tree if you want a stronger guarantee.
