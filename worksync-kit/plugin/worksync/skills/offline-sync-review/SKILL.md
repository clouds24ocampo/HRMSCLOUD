---
name: offline-sync-review
description: Review offline-first mobile/PWA capture and sync for field staff: outbox, idempotency, conflicts, photo upload.
---
Rule O-1: offline writes are idempotent and never silently overwrite someone else's change. See MASTER_GUIDE section 8.3.

Client:
1. Each operation is stored in an IndexedDB outbox with `op_id` (UUID), entity ids, `base_version`, new value, `captured_at` (device time, informational only).
2. Ops are small and per-cell so different columns never conflict. Order within an item is preserved.
3. The UI shows pending, failed, and conflicted ops, with retry and discard. Nothing disappears silently. Storage-full and logged-out cases are handled (queue survives re-login for the same user; a different user cannot see or send it).
4. Photos: resumable or chunked upload, retried with backoff, attached to the item only when complete; compress on device; show progress.

Server:
5. `client_ops(op_id)` makes replays return the stored result. Test replay of the same op 5 times.
6. Version check per cell. Same cell, stale base, different value: return conflict with the current value; the app lets the user choose. No silent last-writer-wins for Status, People, or Date. Long text keeps both versions in the thread.
7. Server time orders events; device clocks can be wrong by days. A far-future `captured_at` must not break sorting or due-date logic.
8. Deleted or moved entities: ops against tombstones fail with a clear reason and keep the user's input available.
9. Permission is checked at sync time, not capture time. If the user lost access while offline, the op is rejected and the data is not applied.
10. Batch size and rate limits apply; a huge queue after a week offline must not overload the API.

Tests: airplane mode for a full report; kill the app mid-upload; two devices one user; duplicate delivery; reordered delivery; clock skew; access revoked offline; very large queue.
Output findings by severity with file:line; any path that can lose or duplicate data is a blocker.
