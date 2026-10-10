# data/

Your private working data. **Everything in this folder except the three files below is git-ignored** and
is blocked from Claude Code sessions by the privacy guard (`scripts/privacy-guard.mjs`).

| File                    | Tracked | Purpose                                              |
| ----------------------- | ------- | ---------------------------------------------------- |
| `README.md`             | yes     | this file                                            |
| `sample-config.json`    | yes     | made-up configuration (parsing, rules, categories)   |
| `sample-bank-report.csv`| yes     | made-up bank statement that reconciles (2000 → 6079.53) |

Put your real files next to them, for example `data/config.json` and `data/my-bank-2026.csv`.
Never put real bank data anywhere else in the repository (tests use `tests/fixtures/`, which must stay fictional).
