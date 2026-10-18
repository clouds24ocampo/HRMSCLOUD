# AGENTS.md — WorkSync

Full detail: `docs/architecture/MASTER_GUIDE.md`. If this file and the guide disagree, fix the guide by PR; do not silently pick one.

## Mission
Build WorkSync, a private work-management and progress-reporting system for field, office, remote, programmer, and marketing staff. Work one milestone at a time and explain decisions. It is an original product: never copy monday.com, Trello, or any vendor's code, UI assets, names, or text.

## Before changing code
1. Read this file, your role file in `.agents/agents/`, relevant ADRs and docs.
2. Inspect the existing implementation, scripts, tests, and git diff.
3. For cross-component, security-, privacy-, or sync-sensitive work, present a plan and wait for approval.
4. Do not assume a dependency, script, directory, or service exists. Check.

## Invariants
- Deny by default; authorize every request and WebSocket event on the server (Z-1). Every object lookup checks board membership.
- No covert monitoring: no screenshots, keystroke/app logging, background location, or activity scoring. Location and time are captured only by an explicit employee action with a visible purpose (P-1).
- Collect the minimum; define retention before launch (D-1).
- Offline writes are idempotent (`op_id`) and never silently overwrite another person's change (O-1).
- No secrets in source control, logs, prompts, or fixtures (S-1). Validate all untrusted input with whitelisted DTOs.
- Security and privacy relevant actions write an audit event (A-1).
- Automations run as a bounded system actor with loop guards, rate limits, and a run log.
- Never weaken a control to make a test pass.

## Engineering rules
- Strict TypeScript, no `any` without a documented exception. Smallest working increment (M-1). Reproduce before fixing.
- Versioned migrations only. Update shared-types, OpenAPI, tests, and ADRs in the same PR.
- Tests for success, denial, invalid input, and failure paths; sync and automation changes need replay and loop tests.
- Never claim a check passed unless you ran it and it passed (V-1).
- Do not install dependencies, run destructive commands, change infrastructure, or deploy without explicit approval.

## Workflow
Inspect -> plan -> threat/privacy check -> implement -> test -> independent review -> document -> report.
Authors do not self-certify authorization, privacy, or sync code.

## Skills (`.agents/skills/`)
board-data-model, permission-model-review, authz-test-matrix, automation-engine-design, offline-sync-review, realtime-sync-review, progress-reporting-design, worker-privacy-review, integration-webhook-review, board-template-design, threat-modeling, audit-event-design, db-migration-review, pr-checklist, adr-writer.

## Final report must list
Changed files, design choices, checks actually run with results, security/privacy implications, known limits, next step.
