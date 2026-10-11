# Requirements: privacy

How they are met: [spec/privacy.md](../spec/privacy.md).

| ID     | Requirement                                                                                           | Status  |
| ------ | ----------------------------------------------------------------------------------------------------- | ------- |
| PRIV-1 | Real bank data and personal configuration are never committed, pushed, or written into issues and PRs | done    |
| PRIV-2 | `data/` tracks only a README, a sample configuration and a sample bank report, all fictional          | done    |
| PRIV-3 | Claude Code sessions cannot read private files in `data/`, other CSV files or `.env` files            | done    |
| PRIV-4 | Test fixtures are fictional                                                                           | done    |
| PRIV-5 | User data never leaves the browser (no upload, no telemetry, no third-party requests)                 | planned |
