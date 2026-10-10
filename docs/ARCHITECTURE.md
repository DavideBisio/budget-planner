# Architecture

Status: accepted. Issue: #6. Requirements: GEN-3, STOR-1 to STOR-6, ENG-1, ENG-10. Change this file in the same PR as any change to the boundaries or contracts below.

## Overview

A static, offline web app with two pages built from plain HTML, ES modules and CSS. There is no backend and no network access; everything the user owns stays in the browser.

| Page    | Entry         | Purpose                                                         |
| ------- | ------------- | --------------------------------------------------------------- |
| Planner | `index.html`  | Plan the budget as cards, chart the cumulative balance, savings |
| Import  | `import.html` | Turn bank CSV files into cards with guided rules                |

## Decision: no framework

The UI is a handful of forms, lists and one chart. Vanilla JS keeps the bundle tiny, makes the single-file offline build trivial and removes a dependency to keep updated. Revisit only if the number of stateful components makes manual DOM updates unmanageable; any change needs a new record here.

## Module boundary

```
src/core/   pure logic: input values in, output values out. No DOM, no storage, no clock, no randomness.
src/ui/     DOM, events and rendering. Calls core; owns the only side effects (storage, files, navigation).
```

Rules:

- `src/core` never imports from `src/ui`, never touches `document`, `window`, `localStorage` or `fetch`. ESLint enforces this by restricting the browser globals in that folder (added with #9).
- `src/ui` contains no business rules. If a decision affects money or classification, it belongs in core with a unit test.
- Core functions take their configuration and the current date as arguments, so tests need no mocks.
- Logic is written test first (`tests/unit/`); the UI is checked by Playwright (`tests/e2e/`).

## Data flow

```
file text ─▶ parse ─▶ de-duplicate ─▶ filter ─▶ payee ─▶ match rules ─▶ detect recurring ─▶ overrides ─▶ cards
 (ui reads)   ENG-2                    ENG-4     ENG-5     ENG-6          ENG-7              ENG-8       ENG-9
                                                                                                         │
                                           handoff payload (STOR-6) ◀──────────────────────────────────┘
                                                     │
                                                     ▼
                                       planner state ─▶ cumulative chart, totals
```

- Only the raw text of imported files is persisted (ENG-10). Every later stage is derived and recomputed when settings change, so a rule change never leaves stale results.
- Stages are separate functions with plain-object inputs and outputs, so each can be tested alone and the import page can show the intermediate result of any step.

## Configuration ownership

- The configuration schema (version 1) is owned by `src/core/config.js` (#13): defaults, validation and migration live there. `data/sample-config.json` is the reference example and must always validate.
- Sections: `parse`, `filter`, `payees`, `rules`, `cats`. Patterns are stored as regular expression strings.
- Validation returns a list of `{path, message}` and never throws into the UI.
- The UI edits a copy and saves through the storage module; it never mutates the stored object in place.

## Storage contract

One module, `src/ui/storage.js` (#39), owns `localStorage`. Nothing else reads or writes it.

| Key                        | Content                                          | Owner   |
| -------------------------- | ------------------------------------------------ | ------- |
| `budget-planner:config`    | configuration (ENG-1)                            | import  |
| `budget-planner:files`     | raw text of imported files with names and sizes  | import  |
| `budget-planner:overrides` | transaction and payee overrides (ENG-8)          | import  |
| `budget-planner:planner`   | planner state: salary, cards, savings            | planner |
| `budget-planner:handoff`   | one-shot payload from import to planner (STOR-6) | import  |
| `budget-planner:backup:*`  | pre-migration copies of a value                  | storage |

- Every value is stored as `{ "version": <integer>, "data": <value> }`.
- Access is wrapped in try/catch. If storage is unavailable or full, the app keeps working in memory and shows a visible notice.
- "Clear all data" removes every key with the `budget-planner:` prefix after confirmation (STOR-3).

### Versioning and migration

- Each key has its own version, starting at 1.
- A migration is a pure function from version n to n+1, living in `src/core/migrations/`. On load, the module applies them in order.
- Before migrating, the original value is copied to `budget-planner:backup:<key>`. If a migration throws, the original stays in use and the user is told.
- A value with a version newer than the app understands is left untouched and treated as read-only (the user may have opened an older build).
- The app starts empty: there is no import of data from earlier versions (STOR-5 is dropped).

### Handoff payload (STOR-6)

Written by the import page, read, applied and removed by the planner.

```json
{
  "version": 1,
  "data": {
    "mode": "replace",
    "cards": [
      {
        "id": "string, stable",
        "kind": "recurring | one-time",
        "direction": "in | out",
        "category": "string",
        "label": "string",
        "amountCents": 12345,
        "month": "YYYY-MM"
      }
    ]
  }
}
```

- `mode` is `replace` or `merge`. Amounts are integer cents; `saving` cards use a signed amount (money out positive, money in negative) per ENG-9.
- `month` is present for one-time cards only. Recurring cards apply to every month.
- The planner validates the payload before applying it; an invalid payload is discarded with a message and never partially applied.

## Build and offline

- `npm run build` produces a multi-page static site in `dist/` with relative asset URLs, so it works from any static host or sub-path.
- A single-file build (#45) inlines scripts and styles for use from `file://`. It is a post-build step, not a different code path.
- No CDN, web font or remote script is allowed. A Content-Security-Policy meta tag sets `connect-src 'none'` (GEN-3), and e2e fails on any request outside the local origin.

## Testing layers

| Layer | Tool       | Scope                                                             |
| ----- | ---------- | ----------------------------------------------------------------- |
| Unit  | Vitest     | Everything in `src/core`, fictional fixtures only                 |
| E2E   | Playwright | Both pages on the mobile (Pixel 7) and desktop (1440 px) projects |
| Guard | Node       | Privacy guard: hook, pre-commit, CI                               |
