# Requirements: storage

How they are met: [spec/storage.md](../spec/storage.md).

| ID     | Requirement                                                                                   | Status  |
| ------ | --------------------------------------------------------------------------------------------- | ------- |
| STOR-1 | Planner state, imported files and configuration persist in the browser, with a schema version | planned |
| STOR-2 | Upgrades migrate stored data without losing it; a failed migration leaves the original intact | planned |
| STOR-3 | The user can clear all stored data, after a confirmation                                      | planned |
| STOR-4 | The whole app state can be backed up to a file and restored from it                           | planned |
| STOR-5 | Data from the earlier prototype (stored state and configuration file) can be imported         | planned |
| STOR-6 | The import page hands cards to the planner through a versioned payload, without a server      | planned |
