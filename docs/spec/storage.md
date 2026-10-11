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

- The footer of every page has "Download backup", a checkbox "Include the imported bank files" (off by default, so raw bank text stays out of the file) and "Restore from a backup file".
- `buildBackup` (`src/core/backup.js`) writes one JSON document: `{app: "budget-planner", version: 1, versions: {<section>: n}, data: {config, overrides, planner, files?}}`. Only sections that exist are written. `versions` is the schema version of each section, so an older backup is migrated on restore.
- `parseBackup` checks the whole file before anything is written: it must be JSON, from this app and not from a newer backup version; every section is migrated with `unwrap`, then validated (configuration with `validateConfig`, the plan with `validatePlanner`, manual changes and files by shape). Any problem refuses the whole file and lists each one by path. Unknown sections are ignored.
- Restoring asks first ("replace your current ..."), then `saveAll` writes the sections as one: if any cannot be written, every section goes back to what it held. Sections absent from the file (for example the files) are left as they are. The page reloads afterwards.
- Issue: #41. Verified by: `tests/unit/backup.test.js`, `tests/unit/storage.test.js`, `tests/e2e/backup.spec.js`.

## STOR-5 Dropped

- No import of data from earlier versions; the app starts empty.

## STOR-6 Handoff

- The import page writes a versioned payload (cards plus mode replace or merge) under the key `handoff` (`sendToPlanner`, through the storage module); the planner reads it on load (`src/ui/planner/handoff.js`), applies it, and removes it. It works across pages of the same browser without a server. The payload schema is documented in `docs/ARCHITECTURE.md`.
- `validateHandoff` (`src/core/handoff-apply.js`) lists problems by path. An invalid payload is removed with a message and nothing changes; a payload from a newer version is left in place and explained; a payload that is read once is gone, so reloading does not apply it again.
- `applyHandoff` maps each payload card to an entry with id `imp-<card id>` and source `imported`: recurring cards go on one recurring card "Imported recurring", one-time cards on a card per month ("Imported · Mar 26").
  - **Replace** drops every current card, keeps the salary, starts the plan at the first imported month and shows at least all imported months.
  - **Merge** keeps the cards, the start and the salary, and adds only entries whose id is not in the plan yet (wherever the person moved them), so applying the same payload twice changes nothing the second time. An imported entry the person deleted comes back on the next merge.
- Issues: #40, #6. Verified by: `tests/unit/handoff-apply.test.js`, `tests/unit/handoff.test.js`, `tests/e2e/handoff.spec.js`.
