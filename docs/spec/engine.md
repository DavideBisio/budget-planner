# Specification: engine

Requirements: [req/engine.md](../req/engine.md). All code in `src/core`, no DOM, test first.

Pipeline: parse, de-duplicate, filter, extract payee, match rules, detect recurring, apply overrides, build cards.

## ENG-1 Configuration

- Shape (version 1), shown in `data/sample-config.json`: `parse` (delimiter, decimal, date format, column names, opening/closing patterns), `filter` (from, to, own-transfer toggle, own patterns, exclusions), `payees` (list), `rules` (list of pattern, category, kind), `cats` (list).
- Patterns are stored as regular expression strings so the file stays portable; the friendly input (IMP-5) generates and reads them.
- Validation returns a list of `{path, message}`; an invalid pattern is reported, never thrown into the UI.
- `src/core/config.js` exports `defaultConfig`, `validateConfig`, `migrateConfig`, `patternError` and `compilePattern`. Patterns are case-insensitive; payee patterns need a capture group; a rule's category must exist in `cats`; kinds are `income`, `saving`, `expense` or empty. A version other than 1 is reported, and `migrateConfig` upgrades older versions step by step (no steps exist yet).
- Issue: #13. Verified by: `tests/unit/config.test.js`, including `data/sample-config.json`.

## ENG-2 Parsing

- Own CSV reader (quotes, embedded delimiters and newlines, BOM, CRLF). Columns are found by header name prefix, case-insensitive.
- Amount = credit + debit columns, or one signed column. Dates normalised to `YYYY-MM-DD`.
- Rows whose description matches the opening or closing pattern carry the balance in the amount columns and are not transactions. The header is the best-matching row among the first 30, so lines before it are ignored. Rows with an unreadable date or amount are skipped and listed as warnings (file, row, reason); a missing required column is an error that names the file and the column, and nothing is parsed.
- Amounts are integer cents (money in positive, out negative); debit is always read as money out. Each transaction id is `date|amount|description#n` with `n` counting identical rows within the file, so identical rows stay distinct and re-imports are stable. Each keeps its raw row for the debug view.
- API: `parseStatement(text, parse, file)` returns `{file, transactions, opening, closing, warnings, errors}`; `parseCsv`, `parseAmount` and `parseDate` are exported helpers.
- Issue: #14. Verified by: `tests/unit/csv.test.js`, `tests/unit/parser.test.js` (every fixture and the sample statement).

## ENG-3 Reconciliation

- Per file: `opening + sum(movements) = closing` within 0.01. Across files sorted by first date: closing of one equals opening of the next; report gap or overlap.
- Issue: #15.

## ENG-4 Filtering

- Date range is inclusive. Exclusion and own-transfer patterns test the description, case-insensitive. Output: kept rows plus removed rows with the reason.
- Issue: #16.

## ENG-5 Payee extraction

- Patterns tried in order, group 1 is the payee. Fallback: Type column, then the first words of the description. A normalised key (uppercase, punctuation removed, first three words) is used for grouping.
- Issue: #17.

## ENG-6 Matching

- First matching rule wins. Kind: `income`, `saving`, or empty (expense by direction). Result stores rule index, pattern and raw row. Unmatched: "Other income" or "Other expenses".
- Issue: #18.

## ENG-7 Recurring detection

- Group by direction, counterparty key and amount in cents. Recurring if the group has the same count in every month of the data span and the span has at least two months. Card amount = amount x count per month. No averaging, no tolerance.
- Everything else is one-time with its real month.
- Issue: #19. Verified by: varying salary stays one-time; a missing month breaks recurrence; two equal payments per month give double amount.

## ENG-8 Overrides

- Precedence: transaction override, then payee override, then rules. Overrides are keyed by transaction id and payee key, so they survive re-parsing.
- Issue: #20.

## ENG-9 Cards and signed savings

- Output: recurring cards and one-time cards by month and category. Saving kind: money out is positive, money in is negative.
- Issue: #21.

## ENG-10 Raw storage and re-parse

- Only raw text is persisted for imported files; everything else is derived on every settings change.
- Issues: #24, #39.
