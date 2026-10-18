---
name: automation-engine-design
description: Design or review WorkSync automations: triggers, conditions, actions, buttons, schedules, loop guards, and webhooks.
---
Grammar: WHEN trigger [IF conditions] THEN actions (MASTER_GUIDE section 7). Shapes to support: event rules, item/board buttons, scheduled commands, due-date commands.

Design checklist:
1. Triggers come from the append-only `events` table, not from ad-hoc calls in controllers, so every change (UI, API, offline sync, form, importer) fires the same triggers.
2. Matching and execution run in a worker queue, never inside the request. A request must not wait on automations.
3. Idempotency: key `(event_id, automation_id)`. A retried job cannot act twice.
4. Loop guard: each event records `caused_by`; actions carry depth+1; stop at depth 3 and log "loop stopped". Add a per-automation rate limit and a board-wide burst limit.
5. Actor: a system actor bound to the automation's board. It may not exceed what its creator could do (re-check the creator's role when the automation runs; disable it if the creator lost the right).
6. Every run writes `automation_runs` with status and error. Failures notify the owner; repeated failures disable the rule.
7. Dry-run/test mode shows what would change on a chosen item, without writing.
8. Date and schedule triggers use the board's or user's time zone; test daylight-saving and month-end.
9. Outgoing webhooks: HTTPS only, host allow-list, block private/link-local/metadata IPs after DNS resolution, timeouts, signed payloads, no secrets in URLs, response bodies never stored raw. See `integration-webhook-review`.
10. Notify actions respect board visibility and user notification settings; no mass-notify without owner role.
11. Editing or enabling an automation with webhook or mass-notify writes an audit event.
12. Versioning: an edit creates a new version; in-flight runs finish on the old one.

Required tests: A triggers B triggers A; burst of 1000 events; failing action; creator demoted; webhook to 127.0.0.1 and 169.254.169.254; DST boundary; retry after worker crash.
