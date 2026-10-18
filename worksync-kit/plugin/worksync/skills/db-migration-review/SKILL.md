---
name: db-migration-review
description: Review a PostgreSQL migration for WorkSync before it merges: safety, locking, rollback, data integrity.
---
1. One concern per migration; versioned; never edit a migration that has been applied anywhere.
2. Is it reversible? Provide a down step or a documented forward-fix plan. Destructive steps (drop column/table, type change) wait one release after the code stops using them.
3. Locking: adding a NOT NULL column with default, adding an index, or adding a constraint on a large table (`items`, `cell_values`, `events`) uses the safe pattern (`CREATE INDEX CONCURRENTLY`, add constraint `NOT VALID` then validate). State the expected lock time.
4. Backfills run in batches outside the migration transaction, are resumable, and have a progress log.
5. Integrity: foreign keys, unique constraints (e.g. `check_ins(user_id, for_date)`, `client_ops(op_id)`), and checks that keep an item and its parent on the same board. Constraints back up the authorization logic.
6. Defaults and enums: prefer lookup tables or text with check constraints for values that will grow; status categories are a fixed enum.
7. Indexes match the real queries: items by (board_id, group_id, position), JSONB cell filters, events by (board_id, id), notifications by (user_id, read_at). Show EXPLAIN for anything new on a big table.
8. Personal data: new columns holding employee data need a purpose, retention rule, and a purge path (see `worker-privacy-review`). Audit table keeps INSERT-only grants.
9. Test on a copy with realistic volume (100k items, 2M cell values, 5M events). Record timings.
10. Update shared-types, OpenAPI, seeds, fixtures, and docs in the same PR.

Output: blockers, risks with a mitigation, and the measured timings you actually ran.
