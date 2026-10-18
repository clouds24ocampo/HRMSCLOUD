---
name: audit-event-design
description: Design or review WorkSync audit events (rule A-1): what is logged, schema, redaction, access, and tamper resistance.
---
Audit events are for security and privacy accountability. The activity feed (`events`) is a different table for product behaviour.

Always audit: login success/failure · role and membership changes · board visibility changes · bulk export or download · automation create/edit/enable when it has a webhook or mass-notify · integration token create/change/revoke · form publish · admin takeover of a board · reads of the audit log · manager views of place check-ins · retention purges · importer runs.

Schema: `id, ts (UTC), actor_id, action (verb.noun, e.g. board.visibility.changed), target_type, target_id, result (success|denied|error), ip, correlation_id, detail jsonb`.

Rules:
1. `detail` holds ids and before/after of non-sensitive fields only. Never passwords, tokens, URLs with secrets, update/comment text, file contents, or raw coordinates.
2. Denied attempts are audited too (they are the signal).
3. The application role can INSERT but not UPDATE or DELETE; reads are admin-only and are themselves audited. Consider a hash chain or periodic signed export for tamper evidence.
4. One helper writes events so naming and redaction are consistent; a lint or test fails on direct inserts elsewhere.
5. Retention for audit logs is set by policy (owner decides) and enforced by a job.
6. Alerts: repeated denied access, mass export, new webhook to an unknown host, role escalation outside business hours.
7. Tests: each listed action produces exactly one event; redaction test with a token in the payload; application role cannot modify rows.

Output: events missing, fields that leak, and the test for each.
