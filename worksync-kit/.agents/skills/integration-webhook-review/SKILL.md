---
name: integration-webhook-review
description: Review WorkSync integrations and webhooks: GitHub, Slack/Teams, email in/out, importers, outgoing automation calls.
---
Inbound (GitHub, chat, email-in, form posts):
1. Verify the signature or secret on every webhook before parsing; reject on mismatch; constant-time compare; replay protection with timestamp and delivery id.
2. Map the external identity to a WorkSync user explicitly. Unmapped senders create nothing (or go to a quarantine list for an admin).
3. Treat all content as untrusted: sanitize HTML, limit size, strip active content, never render raw email HTML.
4. Rate-limit by source; return quickly and process in a queue.

Outbound (automation webhooks, notifications):
5. HTTPS only. Allow-list hosts. Resolve DNS, then block private, loopback, link-local, and cloud metadata addresses (SSRF), and re-check after redirects (or disable redirects).
6. Timeouts, retries with backoff, response size cap, no response body stored raw.
7. Signed payloads so receivers can verify; no secrets in URLs or logs.

Credentials and scope:
8. Least-privilege tokens (read-only where enough); store encrypted; show only the last 4 characters; rotation and revoke path; revoke on user offboarding.
9. Connecting or changing an integration is owner/admin only and writes an audit event.

Importers (Trello JSON, CSV):
10. Parse in a sandboxed worker with size and row limits; validate each field with the same rules as the API; map unknown statuses to a category with a review step; never execute formulas from a CSV (strip leading `=`, `+`, `-`, `@`).
11. Imported items are created as the importing user, honouring their permissions; the import is one audited, reversible batch.

Tests: bad signature; replayed delivery; SSRF to 127.0.0.1, 169.254.169.254 and a hostname resolving to private space; redirect to a private IP; oversized payload; CSV with formula injection; revoked token.
Output findings by severity with file:line.
