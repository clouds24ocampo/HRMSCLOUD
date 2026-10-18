---
name: threat-modeling
description: Run a STRIDE-style threat pass on a new WorkSync feature or boundary before implementation.
---
1. Draw the data flow for the feature: actors (member, manager, guest, integration, automation), processes, stores (Postgres, Redis, MinIO), and trust boundaries (browser/PWA, API, worker, third parties).
2. For each flow crossing a boundary, ask STRIDE:
   - **Spoofing:** can someone act as another user, a webhook sender, or a service?
   - **Tampering:** can a body, id, version, or queued job be altered (mass assignment, op replay)?
   - **Repudiation:** would we know who did it (audit event, correlation id)?
   - **Information disclosure:** IDOR across boards, search/dashboard leaks, exports, logs, error messages, presigned URL reuse, stored XSS in updates.
   - **Denial of service:** huge boards, upload floods, automation loops, WebSocket storms, regex or formula bombs.
   - **Elevation of privilege:** contributor to editor, guest to member, automation exceeding its creator, importer acting as admin.
3. WorkSync-specific abuse cases: employee tries to see a private board's titles; manager tries to browse staff location history outside scope; ex-employee token still works; automation used to mass-notify or exfiltrate via webhook; malicious attachment; CSV formula injection; offline queue replayed by another user on a shared phone.
4. Privacy threats: feature drifts into covert tracking, location kept too long, metrics used as a ranking.
5. For each threat: likelihood, impact, control (existing or new), test that proves it, owner. Unmitigated high risks block release (X-1).
6. Record the model in `docs/security/threat-model.md` and link ADRs for accepted risks (owner and expiry).

Output: table of threat | boundary | control | test | status, plus a short list of open risks.
