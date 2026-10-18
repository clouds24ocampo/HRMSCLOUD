---
description: Draft a new Architecture Decision Record from the template
argument-hint: <short decision title>
---
Draft an ADR for: **$ARGUMENTS**. If no title was given, ask for one.

1. Use the `adr-writer` skill. Find the next number by listing `docs/adr/` (ADR-001 to ADR-006 are reserved: stack, realtime transport, offline-sync model, permission model, automation engine, privacy and location policy; do not reuse a number). Start from `docs/adr/ADR-000-template.md`.
2. Fill in context, options (at least two, including "use the existing tool" where relevant), the decision, consequences, security and privacy implications, and how it will be verified.
3. Set **Status: Proposed**. If the evidence is not enough to decide, list it under "Open questions" and name who must decide. Do not invent facts, benchmarks, or approvals.
4. For an exception to a rule (Z-1, P-1, X-1), record the owner and an expiry date.
5. Save as `docs/adr/ADR-NNN-kebab-title.md` and report the path. Do not edit other files.
