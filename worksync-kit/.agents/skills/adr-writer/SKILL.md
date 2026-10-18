---
name: adr-writer
description: Draft a WorkSync Architecture Decision Record from the template, listing open decisions honestly.
---
1. Find the next number in `docs/adr/` (ADR-001 to ADR-006 are reserved: stack, realtime transport, offline-sync model, permission model, automation engine, privacy and location policy). Copy `docs/adr/ADR-000-template.md`.
2. Context: the problem, constraints (headcount, hosting, devices), and which rule or milestone it serves.
3. Options: at least two real options, including "buy or use the existing tool" where relevant, with pros and cons. No strawmen.
4. Decision: what and why. If evidence is missing, set the status to Proposed and put the missing evidence under "Open questions" with an owner. Do not invent benchmarks, quotes, or approvals.
5. Consequences, security and privacy impact (new data, new permissions, new trust boundary), and how it will be verified.
6. Exceptions to a rule (Z-1, P-1, X-1) need a named owner and an expiry date.
7. Save as `docs/adr/ADR-NNN-kebab-title.md`; update the guide's decision list if the decision changes it.
