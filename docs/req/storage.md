# Requirements: storage

How they are met: [spec/storage.md](../spec/storage.md).

| ID     | Requirement                                                                                   | Status  |
| ------ | --------------------------------------------------------------------------------------------- | ------- |
| STOR-1 | Planner state, imported files and configuration persist in the browser, with a schema version | done    |
| STOR-2 | Upgrades migrate stored data without losing it; a failed migration leaves the original intact | done    |
| STOR-3 | The user can clear all stored data, after a confirmation                                      | done    |
| STOR-4 | The whole app state can be backed up to a file and restored from it                           | done    |
| STOR-5 | Not applicable: the app starts with no data from earlier versions                             | dropped |
| STOR-6 | The import page hands cards to the planner through a versioned payload, without a server      | done    |
