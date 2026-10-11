# Specification: storage

Requirements: [req/storage.md](../req/storage.md).

## STOR-1 to STOR-3 Persistence

- One module, `src/ui/storage.js`, owns `localStorage`: namespaced keys (`budget-planner:<name>`), each value wrapped as `{version, data}`. `load(name)` reads and migrates with the schema registered in `src/core/schemas.js` (current version plus the migrations from n to n + 1; a unit test fails when a version is raised without its migration). `save`, `saveEnvelope`, `storedKeys` and `clearAll` are the other entry points. Nothing throws: callers get a status or `false`.
- Keys: `config`, `overrides`, `files` (raw text and names of imported files, ENG-10), `planner`, `handoff`, and `backup:<name>`.
- Migrations are applied in order on load. Before migrating, the original value is copied to `backup:<name>` and the stored original is not changed; a failing migration leaves the original in use (status `failed`). A value from a newer version is never overwritten.
- Problems are broadcast with `onStorageProblem`: `full` (quota), `unavailable` (access refused, for example a private window) and `newer`. `shell.js` shows them as a message at the top of every page; the page keeps working in memory.
- "Clear all data" is a button in the footer of every page. After a confirmation it removes every `budget-planner:` key, backups included, and nothing else, then reloads.
- Issue: #39. Verified by: `tests/unit/storage.test.js`, `tests/unit/schemas.test.js`, `tests/e2e/storage.spec.js`, `tests/e2e/storage-files.spec.js`.

## STOR-4 Backup and restore

- One versioned JSON with planner state and configuration; raw bank files only if the user opts in. Restore validates first, then replaces.
- Issue: #41.

## STOR-5 Dropped

- No import of data from earlier versions; the app starts empty.

## STOR-6 Handoff

- The import page writes a versioned payload (cards plus mode replace or merge) under a dedicated key; the planner reads it on load, applies it, and clears it. The payload schema is documented in `docs/ARCHITECTURE.md`.
- Issues: #40, #6.
