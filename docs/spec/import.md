# Specification: import page

Requirements: [req/import.md](../req/import.md).

## IMP-1 and IMP-2 Guided sequence

- One ordered list of seven step sections; DOM order equals the order in the requirement. A step header shows number, title, one-line purpose and a status badge (todo, valid, needs attention).
- Steps 3 to 7 are disabled with an explanation until steps 1 and 2 are valid. On large screens the settings are in the left column and the live result in the right column; on phones steps collapse and expand.
- Issue: #22. Verified by: e2e on the DOM order and the status changes.

## IMP-3 Parsing step

- Fields: delimiter, decimal, date format, column names, balance patterns. Suggestions are computed by sniffing a chosen file and offered, never applied silently.
- Live preview: first rows as parsed, errors in plain language.
- Issue: #23.

## IMP-4 Import step and summary

- File picker is the main path; drag and drop is an extra on desktop. Summary text: N transactions over M months, total income, total outcome, balance reconciles (per file and across files).
- Issue: #24.

## IMP-5 Friendly pattern input

- One component used by every pattern field. Modes: contains, starts with, ends with, equals, any of (words as chips), advanced regular expression. Input is escaped automatically; case-insensitive by default.
- Feedback: match count against the imported descriptions, highlighted matches, a few matching and non-matching examples, plain-language errors, a read-only preview of the generated regex.
- Payee helpers: "text between X and Y", "text after X".
- The stored value stays a regex string (ENG-1). Reading a stored regex picks the closest mode, else advanced.
- Issue: #25. Verified by: unit tests for build, parse back, escape, errors; e2e for the feedback.

## IMP-6 to IMP-9 Rule editors

- Shared pattern: ordered list, move up and down buttons (drag as extra on desktop), per-item delete, count of affected rows, test against a chosen transaction.
- Filtering: #26. Payee extraction: #27. Matching rules with hit counts and unmatched list, cards instead of a wide table on phones: #28. Categories with rename propagation: #29.

## IMP-10 and IMP-11 Result list and debugging

- Tabs: recurring, one-time, ignored. Hover on desktop, tap on phones and keyboard focus open a popover with at most five transactions: date, amount, raw row, payee, matched rule (number and pattern), category and kind, then "+N more".
- Overrides per transaction or payee are set from the same list.
- Issue: #30.

## IMP-12 Output

- Preview of the cards with totals; mode replace or merge; send writes the handoff payload (STOR-6); download saves it as JSON.
- Issues: #31, #40.

## IMP-13 and IMP-14 Configuration file and persistence

- Export writes the versioned configuration only, never transactions. Import validates (ENG-1) and reports errors by field path. The active configuration is stored in the browser.
- Issues: #32, #39.

## IMP-15 Navigation

- A "Budget Planner" button in the page header. Issue: #7.
