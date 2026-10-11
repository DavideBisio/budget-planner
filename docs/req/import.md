# Requirements: import page

How they are met: [spec/import.md](../spec/import.md). Logic requirements are in [engine](engine.md).

| ID     | Requirement                                                                                                                                                                                       | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| IMP-1  | The page is a guided sequence, top to bottom: 1 parsing, 2 import, 3 filtering, 4 payee extraction, 5 matching rules, 6 categories, 7 output                                                      | done   |
| IMP-2  | Each step shows its status; a step that depends on an earlier one explains what it waits for                                                                                                      | done   |
| IMP-3  | Parsing settings are edited before importing, with a live preview of how the first rows are read                                                                                                  | done   |
| IMP-4  | Several CSV files can be selected; a summary shows the number of transactions, the number of months, total income, total outcome and whether the balance reconciles                               | done   |
| IMP-5  | Every pattern field uses a user-friendly input: plain words, lists of words, starts/ends/contains/equals, with live match feedback; real regular expressions remain available as an advanced mode | done   |
| IMP-6  | Filtering rules (date range, own transfers, exclusions) are editable and show how many rows each removes                                                                                          | done   |
| IMP-7  | Payee extraction rules are editable, orderable and testable against a transaction                                                                                                                 | done   |
| IMP-8  | Matching rules are editable and orderable, with category and kind, and show hit counts and unmatched transactions                                                                                 | done   |
| IMP-9  | Categories can be added, renamed and deleted; rules follow a rename                                                                                                                               | done   |
| IMP-10 | A result list separates recurring and one-time entries; showing an entry (hover or tap) reveals its input rows, extracted payee, matched rule, category and kind, to debug the configuration      | done   |
| IMP-11 | A category or kind can be overridden manually per transaction or payee                                                                                                                            | done   |
| IMP-12 | The output is previewed as planner cards; it can be sent to the planner (replace or merge) or downloaded                                                                                          | done   |
| IMP-13 | The configuration can be exported to and imported from a file; it never contains transactions                                                                                                     | done   |
| IMP-14 | Settings persist between visits                                                                                                                                                                   | done   |
| IMP-15 | The page links to the planner with a "Budget Planner" button                                                                                                                                      | done   |
