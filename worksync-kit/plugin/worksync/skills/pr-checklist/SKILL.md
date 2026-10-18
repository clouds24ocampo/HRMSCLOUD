---
name: pr-checklist
description: Enforce the WorkSync Definition of Done on a pull request before review or merge.
---
Go through the diff and mark each item with evidence (file, test name, or command output you actually saw). No evidence means not done.

1. Matches the approved plan, architecture, and ADRs; no unrelated changes.
2. Server-side authn/authz on every new route and WebSocket event; object lookups check board membership; `@Public()` only with an allow-list entry and ADR.
3. Input validated with whitelisted DTOs; errors, timeouts, retries, and cleanup handled.
4. Audit event added where A-1 applies. No new personal data without purpose, retention, and a privacy note (`worker-privacy-review`).
5. Tests: positive, negative, and failure paths. Sync changes include replay and conflict tests; automation changes include loop and rate-limit tests; reporting changes include fixtures with known answers.
6. Commands run and their real results: typecheck, lint, tests, authz lint (`node scripts/authz-guard.mjs --require-root` once `apps/api` exists), secret scan, dependency audit.
7. Migrations, shared-types, OpenAPI, ADRs, and docs updated in the same PR.
8. No secrets, tokens, or real data in code, fixtures, logs, or screenshots.
9. Accessible: keyboard use, focus, labels, contrast on any UI change; checked on a phone-size viewport for field flows.
10. A reviewer who is not the author read the actual diff; security/privacy review for authorization, sync, automation, location, or import changes.

Report: PASS or BLOCKED, with the list of unmet items and what is needed to clear each.
