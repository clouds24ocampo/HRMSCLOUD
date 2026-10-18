---
description: Independent review of the current change by the reviewer, security and privacy-compliance agents
argument-hint: [base branch, default main]
---
Run an independent review of the current change. Base branch: **$ARGUMENTS** (use `main` if empty).

1. Get the scope: `git diff <base>...HEAD` plus uncommitted changes (`git status`, `git diff`). If there is no diff, say so and stop.
2. Launch these WorkSync agents **in parallel**, each given the diff scope and the approved plan or ADRs if they exist:
   - `reviewer`: diff vs plan, tests, contracts, migrations, docs, regressions
   - `security`: secrets, dependencies, authn/authz, IDOR, input validation, rate limits
   - `privacy-compliance`: any employee data collected or shown (location, time, photos, check-ins, metrics)
3. If the diff touches sync, WebSocket, or automation code, also launch `realtime-sync` or `automation` as a reviewer of the relevant skill checklist (`offline-sync-review`, `realtime-sync-review`, `automation-engine-design`).
4. Consolidate: de-duplicate, rank by severity, give `file:line` for each finding. Mark as **blocker**: any critical/high finding, any route or event without server-side authorization, any cross-board object access, any automatic or background collection of employee data, any path that can lose or duplicate offline data, any exposed secret.
5. List missing evidence (tests not present, checks not run). Do not approve on the author's summary alone.

Do not modify files. The author of the change must not be the reviewer of sensitive code.
