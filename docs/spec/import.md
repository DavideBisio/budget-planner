# Specification: import page

Requirements: [req/import.md](../req/import.md).

## IMP-1 and IMP-2 Guided sequence

- One ordered list of seven step sections; DOM order equals the order in the requirement. A step header shows number, title, one-line purpose and a status badge: To do, Ready, Needs attention, or Waiting. Status is derived, never stored: `stepStatuses` in `src/core/steps.js` (unit tested) from the configuration validation and the imported files.
- Step 2 waits for step 1; steps 3 to 7 are disabled with an explanation of what they wait for until steps 1 and 2 are valid. Each step is a button that collapses and expands its body; a progress bar (sticky on phones) counts the ready steps. Step bodies are mounted by their own issues (#23 onwards). On large screens the settings are in the left column and the live result in the right column; on phones steps collapse and expand.
- Issue: #22. Verified by: unit tests on the statuses; e2e on the DOM order, badges, disabled steps, collapse, sticky progress and layout (`tests/e2e/stepper.spec.js`). E2E of status changes on user input arrives with the first editable step (#23, #24).

## IMP-3 Parsing step

- Fields: delimiter, decimal, date format, column names, balance patterns. Suggestions are computed by sniffing a chosen file and offered, never applied silently.
- `sniffParse` in `src/core/sniff.js` (unit tested) suggests delimiter, decimal, date format and column names from a chosen sample file; a date format is left out when the dates are ambiguous. The UI lists the suggestions and applies them only on "Apply suggestions".
- Live preview in the right column: first rows as parsed, balances found, skipped rows, errors in plain language; it asks for a fix while the settings do not validate. The preview uses the chosen sample file (files imported in step 2 join it in #24).
- Issue: #23. Verified by: unit tests on sniffing; e2e in `tests/e2e/parsing.spec.js` with a fictional fixture and the sample.

## IMP-4 Import step and summary

- File picker is the main path; drag and drop is an extra on desktop. Summary text: N transactions over M months, total income, total outcome, balance reconciles (per file and across files).
- `summarizeImport` in `src/core/summary.js` (unit tested) builds the totals and the balance check from the parsed files. The raw text of every file stays in the page state and is re-parsed whenever the parsing settings change; files with the same name get a numbered suffix. Nothing is sent anywhere.
- Issue: #24. Verified by: unit tests; e2e in `tests/e2e/import-files.spec.js` (totals, removal, mismatch, re-parse, drop, no external request).

## IMP-5 Friendly pattern input

- One component used by every pattern field. Modes: contains, starts with, ends with, equals, any of (words as chips), advanced regular expression. Input is escaped automatically; case-insensitive by default.
- Feedback: match count against the imported descriptions, highlighted matches, a few matching and non-matching examples, plain-language errors, a read-only preview of the generated regex.
- Payee helpers: "text between X and Y", "text after X".
- The stored value stays a regex string (ENG-1). Reading a stored regex picks the closest mode, else advanced.
- Logic lives in `src/core/pattern.js` (unit tested: `buildPattern`, `parsePattern`, `buildCapture`, `parseCapture`, `explainPatternError`, `testPattern`); the DOM component is `src/ui/pattern-input.js`. Explanations of invalid expressions map the engine message to plain language and never show it raw. The step list stays the same size: the balance row fields of step 1 already use the component.
- Decision: there is no case-sensitive toggle. The configuration stores only the expression and the engine always ignores case (ENG-1), so a toggle would have nothing to store. Revisit with a config change if it is ever needed.
- Issue: #25. Verified by: unit tests for build, parse back, escape, errors, matching; e2e in `tests/e2e/pattern-input.spec.js`.

## IMP-6 to IMP-9 Rule editors

- Shared pattern (`src/ui/pattern-list.js`): ordered list, move up and down buttons (drag as extra on desktop), per-item delete, count of affected rows, test against a chosen transaction.
- Filtering: #26 (`src/ui/import/filtering.js`; date inputs, a switch for own-account transfers, two pattern lists, and a result card with the count and three examples per reason; each pattern shows how many rows it removes). Payee extraction: #27 (`src/ui/import/payees.js`; ordered capture patterns with move buttons, a test panel for one transaction, and a result card counting how many payees came from a pattern, the Type column or the first words). `extractPayee` reports the index of the pattern that matched so each rule can show how many transactions it serves. Matching rules with hit counts and unmatched list, cards instead of a wide table on phones: #28 (`src/ui/import/rules.js`; each rule is a card with the friendly pattern, category and kind selectors and a match count; reorder by buttons; the result card lists unmatched transactions). Drag and drop reordering is not built: buttons are the only way, which already works on every device. Categories with rename propagation: #29 (`src/core/categories.js`, unit tested: add, rename, delete, usage; UI in `src/ui/import/categories.js`). Rename follows into the rules. Deleting a category that rules use is allowed only after choosing another category to move them to, with a confirmation panel; an unused one is deleted at once. `Other income` and `Other expenses` are what unmatched transactions become, so they cannot be renamed or deleted. Names that differ only by case count as duplicates.

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
