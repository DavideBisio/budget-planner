# Requirements: engine

Pure logic with no DOM. How they are met: [spec/engine.md](../spec/engine.md).

| ID     | Requirement                                                                                                                                                                                      | Status  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| ENG-1  | One versioned configuration holds parsing, filtering, payee extraction, matching rules and categories; it is validated with field-level errors; defaults are sample placeholders                 | done    |
| ENG-2  | Bank CSV files parse according to the settings: delimiter, decimal separator, date format, column names, debit/credit columns or one signed amount, quoting, BOM, line endings                   | done    |
| ENG-3  | Statement balances reconcile (opening + movements = closing) per file, and consecutive files chain; gaps and overlaps are reported                                                               | done    |
| ENG-4  | Transactions can be filtered by date range, exclusion patterns and own-account transfer patterns, with counts of what was removed                                                                | done    |
| ENG-5  | A payee is extracted from the description by an ordered list of patterns, with a fallback                                                                                                        | planned |
| ENG-6  | Matching rules are ordered, first match wins, and assign a category and kind; each result records which rule matched and the raw input row                                                       | planned |
| ENG-7  | An entry is recurring only if the same amount occurs the same number of times in every month of the full data span; there is no averaging; everything else is a one-time entry in its real month | planned |
| ENG-8  | Manual overrides by transaction or payee take precedence over rules and survive re-parsing                                                                                                       | planned |
| ENG-9  | Planner cards are built from the classified transactions; savings are signed (money out adds to savings, money in is a withdrawal)                                                               | planned |
| ENG-10 | Imported files are stored as raw text and re-parsed whenever the settings change                                                                                                                 | planned |
