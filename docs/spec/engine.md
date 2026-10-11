# Specification: engine

Requirements: [req/engine.md](../req/engine.md). All code in `src/core`, no DOM, test first.

Pipeline: parse, de-duplicate, filter, extract payee, match rules, apply overrides, drop ignored, detect recurring, build cards. Overrides come before recurring detection so that an ignored transaction does not shape the data span or a group (ignoring one payment of a recurring series therefore makes the rest one-time, as the user asked).

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
- `src/core/reconcile.js`: `reconcileFile(statement)` gives `status` `ok`, `mismatch` or `unknown` (a balance row is missing) with the difference in cents; `checkChain(statements)` returns `{files, links, ok, problems}`. A link is `ok` when the next opening equals the previous closing within one cent; otherwise `overlap` when the date ranges intersect (with the number of shared transaction ids), else `gap`; `unknown` when a balance is missing and the dates do not overlap. Files without transactions sort last.
- Issue: #15. Verified by: `tests/unit/reconcile.test.js` (broken chain, overlap, fixture).

## ENG-4 Filtering

- Date range is inclusive. Exclusion and own-transfer patterns test the description, case-insensitive. Output: kept rows plus removed rows with the reason.
- `filterTransactions(transactions, filter)` in `src/core/filter.js` returns `{kept, removed, counts, examples}`. Checks run in the order range, exclusion, own transfer; a transaction is counted once, under the first reason. `removed` entries are `{tx, reason, pattern?}`, `counts` has `range`, `exclude`, `own` and `total`, `examples` holds up to three removed transactions per reason. Invalid patterns are skipped (validation reports them).
- Issue: #16. Verified by: `tests/unit/filter.test.js`.

## ENG-5 Payee extraction

- Patterns tried in order, group 1 is the payee. Fallback: Type column, then the first words of the description. A normalised key (uppercase, accents and punctuation removed, first three words, sorted so word order does not matter) is used for grouping.
- `src/core/payee.js`: `extractPayee(tx, patterns)` returns `{name, key, source}` (`pattern`, `type` or `description`); a pattern whose group 1 is empty is skipped; `assignPayees` adds `payee` and `payeeKey` to copies of the transactions; `payeeKey(name)` is exported.
- Issue: #17. Verified by: `tests/unit/payee.test.js` (including the sample statement).

## ENG-6 Matching

- First matching rule wins; the pattern is tested against the description, case-insensitively. Kind: `income`, `saving`, `expense` or empty; an empty kind is resolved from the direction of the money (in is `income`, out is `expense`), so a classified transaction always has a kind. Result stores the rule (`{index, pattern}`, or `null`) and the transaction keeps its raw row. Unmatched: "Other income" or "Other expenses".
- `src/core/match.js`: `classify(tx, rules)` and `classifyTransactions(transactions, rules)` (copies with `category`, `kind`, `rule`).
- Issue: #18. Verified by: `tests/unit/match.test.js` (ordering, overlap, fallback, sample statement).

## ENG-7 Recurring detection

- Group by direction, counterparty key and amount in cents. Recurring if the group has the same count in every month of the data span and the span has at least two months. Card amount = amount x count per month. No averaging, no tolerance.
- Everything else is one-time with its real month.
- The data span runs from the month of the earliest to the month of the latest transaction, including months with no transactions, so an empty month breaks every group. `detectRecurring(transactions)` in `src/core/recurring.js` takes classified transactions with `payeeKey` and returns `{months, recurring, oneTime}`; a recurring entry has `amount`, `perMonth`, `monthly`, `direction`, `payee`, `category`, `kind` and its `transactions`. `monthsBetween` is exported.
- Issue: #19. Verified by: varying salary stays one-time; a missing month breaks recurrence; two equal payments per month give double amount. Tests: `tests/unit/recurring.test.js`.

## ENG-8 Overrides

- Precedence: transaction override, then payee override, then rules, resolved field by field (`category`, `kind`, `ignore`); `ignore: false` on a transaction opts it back in. Overrides are keyed by transaction id and payee key, so they survive re-parsing.
- `src/core/overrides.js`: `applyOverrides(transactions, overrides)` adds `ignored` and `override` (`transaction`, `payee` or `null`); `withOverride(overrides, scope, key, patch)` returns an updated copy; `emptyOverrides()`. Shape: `{transactions: {[id]: patch}, payees: {[payeeKey]: patch}}`.
- Issue: #20. Verified by: `tests/unit/overrides.test.js` (precedence, ignore, re-parse).

## ENG-9 Cards and signed savings

- Output: recurring cards and one-time cards by month and category. Saving kind: money out is positive, money in is negative.
- `buildCards(detected)` in `src/core/cards.js` takes the output of `detectRecurring` (after overrides) and returns `{recurring, oneTime, totals}`. Each card has `flow` (signed cash movement, in positive) and `amount` (shown figure: income keeps the sign of its flow; expense and saving reverse it, so a saving deposit is positive and a withdrawal negative). Recurring cards have `month: null` and `perMonth`; one-time cards have `month` and `date`. Both list `transactionIds`.
- `totals`: `byKind` (`income`, `expense`, `saving` as summed amounts, a recurring card counted once per month of the span), `byCategory` (category and kind pairs) and `net` (sum of flows, equal to the statement movements).
- Issue: #21. Verified by: `tests/unit/cards.test.js` (including a withdrawal and the sample statement).

## ENG-10 Raw storage and re-parse

- Only raw text is persisted for imported files (key `files`: a list of `{name, text}`, written by `src/ui/import/files-store.js` whenever the list changes and read on the next visit); everything else is derived on every settings change.
- Issues: #24, #39. Verified by: `tests/e2e/storage-files.spec.js`.
