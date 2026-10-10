# Documentation

How a piece of work is described, from the idea to the check:

| Layer             | Where                  | Answers                    | Changes via         |
| ----------------- | ---------------------- | -------------------------- | ------------------- |
| Requirement (req) | `docs/req/<scope>.md`  | What must be true, and why | PR editing the file |
| Specification     | `docs/spec/<scope>.md` | How it is done             | PR editing the file |
| Issue             | GitHub                 | The work to get there      | issue tracker       |
| Test              | `tests/`               | Proof that it holds        | PR with the code    |

Rules:

- Every requirement has a stable ID (`<SCOPE>-<n>`, for example `IMP-5`). IDs are never reused; a dropped
  requirement is marked `dropped`, not deleted.
- Every requirement has a specification entry with the same ID, listing the issues that build it and the tests that verify it.
- A PR names the IDs it touches. If behaviour changes, the requirement or the spec changes in the same PR.
- All requirements are equal. Cross-cutting ones live in the `general` scope and apply to every page.

## Scopes

| Scope   | Prefix | Covers                                                      |
| ------- | ------ | ----------------------------------------------------------- |
| general | GEN    | layout, devices, offline, accessibility, quality gates      |
| privacy | PRIV   | real data never leaves the user or enters the repository    |
| engine  | ENG    | pure logic: config, parsing, filtering, matching, detection |
| import  | IMP    | the import page                                             |
| planner | PLAN   | the planner page                                            |
| storage | STOR   | persistence, migration, backup, handoff between pages       |

Status values: `planned`, `in progress`, `done`, `dropped`. Roadmap and milestones: [ROADMAP.md](ROADMAP.md).
