# budget-planner

Personal budget planning app. Offline and privacy-first: import a bank CSV, set parsing, filtering and matching
rules, turn the result into recurring and one-time cards, and plan the months ahead. Everything stays in your browser.

> Status: rebuild in progress. See the [roadmap](docs/ROADMAP.md) and the
> [milestones](https://github.com/DavideBisio/budget-planner/milestones).

## Quick start

```bash
nvm use            # Node 24 (see .nvmrc)
npm install        # also installs the git hooks
npm run check      # privacy + lint + format + tests
npm run dev
```

## Your data stays private

- Put real exports and configuration in `data/` (git-ignored). Only `data/sample-config.json` and
  `data/sample-bank-report.csv` (fictional) are tracked.
- A commit hook and CI refuse any private file; a Claude Code hook stops AI sessions from reading `data/`.
  Details in [CONTRIBUTING.md](CONTRIBUTING.md).

## Scripts

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `npm run dev`    | Vite dev server                               |
| `npm run build`  | production build                              |
| `npm test`       | unit tests (vitest)                           |
| `npm run e2e`    | Playwright, mobile and desktop projects       |
| `npm run lint`   | ESLint                                        |
| `npm run format` | Prettier (write); `format:check` only checks  |
| `npm run check`  | everything the pre-commit hook and CI enforce |

## License

GPL-3.0, see [LICENSE](LICENSE).
