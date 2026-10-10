# Specification: storage

Requirements: [req/storage.md](../req/storage.md).

## STOR-1 to STOR-3 Persistence

- One module owns `localStorage`: namespaced keys, each value wrapped as `{version, data}`. Access is wrapped in try/catch so a disabled or full storage degrades to in-memory state with a visible notice.
- Migrations are pure functions from version n to n+1, applied in order on load. Before migrating, the original value is copied to a backup key; on failure the original stays in use.
- "Clear all data" removes every namespaced key after a confirmation.
- Issue: #39.

## STOR-4 Backup and restore

- One versioned JSON with planner state and configuration; raw bank files only if the user opts in. Restore validates first, then replaces.
- Issue: #41.

## STOR-5 Legacy migration

- Reads the old prototype's storage keys when present and converts the old configuration format to schema version 1. Offered once; the old data is never deleted.
- Issue: #42.

## STOR-6 Handoff

- The import page writes a versioned payload (cards plus mode replace or merge) under a dedicated key; the planner reads it on load, applies it, and clears it. The payload schema is documented in `docs/ARCHITECTURE.md`.
- Issues: #40, #6.
