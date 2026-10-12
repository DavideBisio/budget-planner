# Specification: import page

Requirements: [req/import.md](../req/import.md).

## IMP-1 and IMP-2 Guided sequence

- A row of six numbered tabs (`role="tablist"`), one panel per step with the purpose line, a settings column (left) and a result column (right), and a Next button. Order: import, parsing, categories (with the matching rules), filtering, payees, output. A tab shows number, title and a status badge: To do, Ready, Needs attention, or Waiting. Status is derived, never stored: `stepStatuses` in `src/core/steps.js` (unit tested) from the configuration validation and the imported files.
- Parsing waits for a file; categories, filtering, payees and output wait until a file is imported and parsing is valid. A waiting tab is disabled and its reason is shown under the tab row. Arrow keys, Home and End move between enabled tabs.
- The progress bar counts the steps that are ready and that the person has opened, so it starts at zero. It is sticky on phones. Cards that a step produces are mounted into the right column of the step (`createResults` in `src/ui/import/results.js`); cards of other steps live there too (the matching summary in categories, the result list in output).
- Issues: #22, #89. Verified by: unit tests on the statuses; e2e on the tab order, badges, disabled tabs, keyboard, progress and layout (`tests/e2e/stepper.spec.js`).

## IMP-3 Parsing step

- Fields: delimiter, decimal, date format, column names, balance patterns. Suggestions are computed by sniffing a chosen file and offered, never applied silently.
- `sniffParse` in `src/core/sniff.js` (unit tested) suggests delimiter, decimal, date format and column names from a chosen sample file; a date format is left out when the dates are ambiguous. The UI lists the suggestions and applies them only on "Apply suggestions".
- Live preview in the right column: first rows as parsed, balances found, skipped rows, errors in plain language; it asks for a fix while the settings do not validate. It uses the first imported file, which is also where suggestions come from (there is no separate sample input).
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

- Shared pattern (`src/ui/pattern-list.js`): a compact list; each item is one line with a plain-words summary of the pattern (`summarizePattern` in `src/core/pattern.js`, unit tested), a note such as the count of affected rows, move up and down buttons when order matters and a red cross to remove. The line opens the full card (the pattern input and extra controls) and closes it again, Escape closes it too; a new item starts open. Categories use the same idea: name, rule count and red cross; clicking the name edits it and the cross becomes Save.
- Filtering: #26 (`src/ui/import/filtering.js`; date inputs, a switch for own-account transfers, two pattern lists, and a result card with the count and three examples per reason; each pattern shows how many rows it removes). Payee extraction: #27 (`src/ui/import/payees.js`; ordered capture patterns with move buttons, a test panel for one transaction, and a result card counting how many payees came from a pattern, the Type column or the first words). `extractPayee` reports the index of the pattern that matched so each rule can show how many transactions it serves. Matching rules with hit counts and unmatched list, cards instead of a wide table on phones: #28 (`src/ui/import/rules.js`; each rule is a card with the friendly pattern, category and kind selectors and a match count; reorder by buttons; the result card lists unmatched transactions). Drag and drop reordering is not built: buttons are the only way, which already works on every device. Categories with rename propagation: #29 (`src/core/categories.js`, unit tested: add, rename, delete, usage; UI in `src/ui/import/categories.js`). Rename follows into the rules. Deleting a category that rules use is allowed only after choosing another category to move them to, with a confirmation panel; an unused one is deleted at once. `Other income` and `Other expenses` are what unmatched transactions become, so they cannot be renamed or deleted. Names that differ only by case count as duplicates.

## IMP-10 and IMP-11 Result list and debugging

- Tabs: recurring, one-time, ignored. Hover on desktop, tap on phones and keyboard focus open a popover with at most five transactions: date, amount, raw row, payee, matched rule (number and pattern), category and kind, then "+N more".
- Overrides per transaction or payee are set from the same list: a Change panel per entry with category, kind, apply-to (this transaction or all of the payee; recurring entries always apply to the payee), Ignore and Reset. Ignored entries have a Restore button. `buildResult` in `src/core/result.js` (unit tested) applies overrides, sets ignored transactions aside, detects recurring entries and builds the cards; `src/ui/import/result.js` renders it. Overrides live in the page state for now; persisting them is #39.
- Issue: #30. Verified by: unit tests on `buildResult`; e2e in `tests/e2e/result.spec.js`.

## IMP-12 Output

- Preview of the cards with totals for the whole period; mode replace or merge, with one sentence saying what will change (`describeHandoff`); Send to planner writes the handoff payload (STOR-6) and links to the planner; Download JSON saves the same payload as `planner-cards.json`. `buildHandoff` and `cardId` live in `src/core/handoff.js` (unit tested). Card ids in the payload are hashes of the internal ids, because those are made from transaction text and the payload must not carry bank descriptions.
- For now `src/ui/handoff.js` writes the browser key directly; #39 moves that into the storage module and #40 adds the planner side (read, validate, apply, clear).
- Issues: #31, #40. Verified by: unit tests; e2e in `tests/e2e/output.spec.js`.

## IMP-13 and IMP-14 Configuration file and persistence

- One file does both jobs. The output step downloads the backup of STOR-4 (configuration, manual changes, planner; the imported bank files only when "Include the imported bank files" is ticked, so transactions stay out by default). The settings card in the import step loads it back, and also still accepts a settings-only file (sections `parse`, `filter`, `payees`, `rules`, `cats`), which is how the sample configuration loads. A backup is told apart by its `app` field; it is validated as a whole, asked about, and restored with a reload. A settings file is validated (ENG-1), upgraded from older versions, and its problems are listed by field path with the same plain-language messages as the pattern input; nothing changes when there are problems. "Clear all data" (STOR-3) is in the same card. Logic: `src/core/config-file.js` and `src/core/backup.js` (unit tested); UI: `src/ui/import/settings.js`, `src/ui/import/output.js`, `src/ui/backup.js`.
- The configuration and the manual changes are saved in the browser after every edit (keys `config` and `overrides`, each wrapped as `{version, data}`) and loaded on the next visit. `src/core/envelope.js` (unit tested) reads an envelope and applies migrations in order; `src/ui/storage.js` is the only code that touches `localStorage` (the handoff goes through it too). A value from a newer version is left untouched and the user is told that changes will not be saved; an unreadable value falls back to the defaults with a notice; a migrated value is first copied to a backup key.
- The notice for full or unavailable storage, clear-all, the imported files and the planner state were added in #39 (see spec/storage.md).
- Issues: #32, #39. Verified by: unit tests; e2e in `tests/e2e/settings.spec.js`.

## IMP-15 Navigation

- A "Budget Planner" button beside the page title opens the planner (the navigation bar links there too); after sending cards, the output step links to it as well. Issue: #7. Verified by: `tests/e2e/import-nav.spec.js`.
