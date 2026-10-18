## What and why
<!-- Link the plan/ADR. One paragraph. -->

## Checks actually run (paste real results)
- [ ] typecheck · lint · tests
- [ ] `node scripts/authz-guard.mjs` (once `apps/api` exists)
- [ ] secret scan · dependency audit

## Definition of Done (see `pr-checklist`)
- [ ] Server-side authorization on every new route/event; object lookups check board membership
- [ ] Input validated with whitelisted DTOs
- [ ] Audit event added where required; no new employee data without purpose, retention, and a privacy note
- [ ] Negative/failure tests added (sync: replay + conflict; automation: loop + rate limit)
- [ ] Migrations, shared-types, OpenAPI, ADRs, docs updated
- [ ] No secrets or unrelated changes

## Risks and known limits

## Reviewer
<!-- Someone other than the author. Security/privacy review for authz, sync, automation, location, import changes. -->
