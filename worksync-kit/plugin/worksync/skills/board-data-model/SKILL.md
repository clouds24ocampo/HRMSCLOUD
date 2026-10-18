---
name: board-data-model
description: Design or review changes to boards, groups, items, columns, cell values, status categories, or ordering in WorkSync.
---
Source of truth: MASTER_GUIDE section 4. Review every schema or column change against this list.

1. Hierarchy is Workspace > Board > Group > Item > Subitem. An item belongs to exactly one board; `parent_item_id` must stay inside the same board (constraint or check, not just code).
2. Cell values live in `cell_values(item_id, column_id)` as JSONB. A value is validated on write against the column type and settings (required, options, min/max). Never trust the client's shape.
3. Every status label maps to one category: `todo`, `doing`, `blocked`, `done`. Rollups, dashboards, digests, and automations read categories, never label text. Deleting a label requires choosing a replacement for items using it.
4. Positions use fractional indexing (string keys). Inserting between two neighbours changes one row. Plan a rebalance job for runaway key length, and test two clients inserting in the same gap.
5. Each item and each cell has a `version` that increments on write; writes carry the base version (see `offline-sync-review`).
6. Deleting is soft (`archived_at`) with a restore path; purge runs by retention policy and is audited.
7. New column type checklist: validation, default, rendering, filter/sort semantics, CSV import/export, automation conditions, permission behaviour, accessibility, migration of existing boards.
8. Formula columns use a safe expression parser. `eval`, `Function`, or user-supplied SQL is a blocker.
9. Index for the real queries: items by (board_id, group_id, position), cell filters by JSONB path, My Work by assignee and due date. Show the query plan for anything over 10k rows.
10. Migrations follow `db-migration-review`.

Output: findings by severity with file:line; list any rule above that is unmet or untested.
