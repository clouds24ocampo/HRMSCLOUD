# WorkSync — Master Guide

**Version 1.0 · working name "WorkSync" (rename freely) · single source of truth for building the company progress-reporting and work-sync system**

A private work-management and progress-reporting system for every employee: field staff, office staff, work-from-home staff, programmers, and marketing. Its functions are modeled on what monday.com and Trello do (boards, items, views, automations, dashboards, forms), designed fresh for this company. Companion files: `docs/research/FEATURE_ANALYSIS.md` (what we studied, with sources) and `AGENTS.md` (short rules for coding agents).

> **Honesty notes.**
> 1. **Original build, not a copy.** We replicate capabilities (boards, columns, automations), which are not owned by anyone. We do not copy vendor code, screens, layouts, icons, logos, names, templates, or help text, and we studied only public pages and normal product use. Design our own look.
> 2. **Everything here is a proposed baseline.** Nothing is installed or working until built and verified. No system is "100% secure"; the goal is risk reduction with tests, review, and an external assessment.
> 3. **Not legal advice.** Employee data (location, time, performance) needs HR, counsel, and DPO review under the Philippine Data Privacy Act (RA 10173) before rollout.
> 4. **Team size, hosting, and budget are unknown.** Timelines below assume a small team and are rough estimates, not commitments.

---

## 0. How to use this file

1. Read sections 1–3 first (scope, build-vs-buy, rules). Everything else obeys them.
2. Build in milestone order (section 14). Do not skip ahead.
3. Agents follow the roster (section 13) and the rules in `AGENTS.md`.
4. Nothing ships without the Definition of Done (section 16).
5. This file wins conflicts. Change it by PR, never silently.

---

## 1. Mission, users, and scope

**Mission:** every person in the company reports progress in one place, in a way that fits how they work, and every manager sees an accurate, current picture without chasing people.

### 1.1 Who uses it, and what each needs

| Group | Typical work | What they need from WorkSync | Key views / flows |
|---|---|---|---|
| **Field staff** | Site visits, installs, inspections, deliveries | Fast mobile capture, works offline, photos, optional location check-in/out, simple daily report | My Work (mobile), Field Report form, Map, offline outbox |
| **Office staff** | Admin, finance, HR, requests, recurring tasks | Clear task lists, request forms, approvals, recurring work | Table, Kanban, Forms, Calendar |
| **Work-from-home staff** | Same as office, remote | Async check-ins, time-zone-aware reminders, visibility without meetings | Daily check-in, My Work, activity feed |
| **Programmers** | Features, bugs, releases | Sprint board, link to GitHub PRs/issues, status sync, blockers | Kanban/Sprint, Timeline, GitHub integration |
| **Marketing** | Campaigns, content, design reviews | Content calendar, approval workflow, asset attachments, deadlines | Calendar, Kanban with approval states, Timeline |
| **Managers** | Oversee teams | Team pulse, overdue/stuck/blocked, workload, weekly digest | Dashboards, Workload, Portfolio board |
| **Admin / executives** | Govern, report up | Company-wide rollup, access control, audit | Portfolio dashboard, admin console, audit log |

### 1.2 Scope of v1

In: boards, groups, items, subitems, typed columns, updates (comments), files, notifications, Table / Kanban / My Work / Calendar / Timeline / Workload / Map views, dashboards, forms, automations, daily check-ins, weekly digests, role templates, mobile PWA with offline capture, GitHub and chat/email integrations, time tracking, audit log, SSO.

Out (for now): AI agents, CRM/service modules, email campaigns, public template gallery, multi-company tenancy, native mobile apps, docs editor, white-labeling.

**Target size:** design for 25–200 employees (confirm, open decision 1). **Principle:** smallest working increment, secure by default, every sensitive action visible and auditable.

---

## 2. Build vs buy (read this before committing months)

monday.com and Trello exist, work today, and were studied for this guide. Building is a real engineering commitment (see milestones). Build only if at least one of these is a hard requirement:

| Reason to build | Why off-the-shelf may not satisfy it |
|---|---|
| Data must stay on company infrastructure | Both are hosted SaaS |
| Offline-first field capture with photos and consented location | Possible with add-ons, but not designed around it |
| Tight integration with CloudConnect (one sign-in, meeting from an item, remote-support request) | Needs custom integration either way |
| Progress reporting (daily check-in, digest, "who did what today") as the core, not a configured board | Achievable by configuration, but fiddly |
| Long-term cost or lock-in concerns | Depends on headcount and plan |

**Recommendation:** run a 2-week pilot of one team on Trello's free plan (Trello lists a Free plan; check current terms) or a monday.com trial, using the templates in section 4. Record what people actually used. That turns this guide's feature list into evidence and may shrink v1. Build WorkSync if the pilot shows a requirement the tools do not meet, or if hosting/privacy rules the SaaS option out.

---

## 3. Golden rules

| # | Rule |
|---|---|
| Z-1 | Deny by default. Every request and every WebSocket event is authorized on the server. A hidden button is not a control. |
| P-1 | **No covert monitoring.** No screenshots, keystroke or app/URL logging, background location, or activity scoring. Location and time are captured only by an explicit employee action, shown to that employee, with a stated purpose. |
| S-1 | No secrets in code, logs, prompts, or fixtures. |
| A-1 | Security- and privacy-relevant actions write an audit event (section 9.4). |
| D-1 | Data minimization: collect only what a feature needs; set retention before launch. |
| O-1 | Offline writes are idempotent and never silently overwrite someone else's change (section 8). |
| T-1 | Typecheck before every commit; strict TypeScript, no `any` without a documented exception. |
| M-1 | Smallest working increment; no speculative infrastructure. Inspect before changing; reproduce before fixing. |
| V-1 | Never fake verification: report only commands actually run and their real results. |
| X-1 | Security findings block release. Waivers need a named owner and an expiry in an ADR. |
| E-1 | Separate dev, staging, production: credentials, data, networks. |
| U-1 | Usability is a requirement: field staff on a phone must complete a report in under a minute (measured in the pilot). |

---

## 4. Product model: what the system is made of

### 4.1 Concepts

| Concept | Meaning | Notes |
|---|---|---|
| **Workspace** | A team or area (e.g. Field Ops, Engineering, Marketing, Office) | Holds boards; a *Portfolio* workspace rolls up others |
| **Board** | A workflow or project | Visibility: **Open** (all employees), **Private** (invited only), **Shared** (with named guests) |
| **Group** | A section of items (e.g. a sprint, a week, a client) | Ordered |
| **Item** | One unit of work | Has an owner, status, dates, any columns |
| **Subitem** | A child step | Drives % complete |
| **Column** | A typed field on a board | Types below |
| **Update** | A comment on an item | @mentions, attachments |
| **View** | A saved way to look at a board | Table, Kanban, Calendar, Timeline, Workload, Map |
| **Dashboard** | Widgets across boards | Shows only what the viewer may already see |
| **Form** | A public-to-employees (or guest) entry point that creates items | Field reports, requests |
| **Automation** | Trigger → conditions → actions | Section 7 |
| **Check-in** | A person's daily "done / next / blocked" note | Section 6 |
| **Template** | A starter board for a role | Section 5 |

### 4.2 Column types

MVP: Text, Long text, Status, People, Date, Timeline (start–end), Number, Dropdown, Checkbox, Link, Files, Rating, Progress (computed). Next: Location (explicit check-in only), Time tracking, Formula (safe expression parser, never `eval`), Connect/Mirror (cross-board links), GitHub link, Email/Phone. Every column has: required flag, default value, validation, and per-type settings.

### 4.3 Status categories (the key design choice)

Boards may name statuses however they like ("In QA", "Waiting on client"), but each status label maps to exactly one **category**: `todo`, `doing`, `blocked`, `done`. All rollups, dashboards, digests, "stuck" detection and automations use categories, so reports stay meaningful across very different boards.

### 4.4 Data model (PostgreSQL)

```
users(id, idp_sub, name, email, org_role, status, timezone, locale)
teams, team_members
workspaces(id, name, kind[team|portfolio])
boards(id, workspace_id, name, visibility[open|private|shared], template_key, archived_at)
board_members(board_id, principal_type[user|team], principal_id, board_role)
groups(id, board_id, name, color, position)
items(id, board_id, group_id, parent_item_id?, name, position, version, created_by, created_at, updated_at, archived_at)
columns(id, board_id, key, title, type, settings jsonb, required, position)
status_labels(id, column_id, label, category[todo|doing|blocked|done], color, position)
cell_values(item_id, column_id, value jsonb, version, updated_by, updated_at)   PK(item_id, column_id)
updates(id, item_id, author_id, body, created_at, edited_at)
attachments(id, item_id, object_key, mime, size, sha256, scan_status, uploaded_by)
views(id, board_id, type, config jsonb, owner_id?, shared)
automations(id, board_id, name, enabled, trigger jsonb, conditions jsonb, actions jsonb, version, created_by)
automation_runs(id, automation_id, event_id, depth, status, error?, started_at, finished_at)
events(id, board_id, item_id?, actor_id|system, type, payload jsonb, caused_by?, created_at)   append-only
notifications(id, user_id, kind, ref, read_at, created_at)
check_ins(id, user_id, for_date, done, next, blockers, item_ids[], created_at)   unique(user_id, for_date)
place_check_ins(id, user_id, item_id?, lat, lng, accuracy_m, captured_at, purpose)   short retention
time_entries(id, user_id, item_id, started_at, ended_at?, source[timer|manual], note)
forms(id, board_id, config jsonb, audience[employees|guests], enabled)
dashboards(id, owner_id, shared), dashboard_widgets(id, dashboard_id, type, config jsonb, position)
client_ops(op_id uuid PK, user_id, applied_at, result jsonb)   idempotency for offline writes
audit_events(id, actor_id, action, target_type, target_id, result, ip, correlation_id, created_at, detail jsonb)
```

Notes: positions use **fractional indexing** (string keys between neighbors) so drag-and-drop reorders one row, not the table. Cell values are validated server-side against the column type; filters use JSONB indexes. `events` feeds the activity feed, automations, and notifications; `audit_events` is separate, restricted, and append-only for the application role.

---

## 5. Role templates (shipped on day one)

| Template | Groups / columns / views | Built-in automations |
|---|---|---|
| **Field visit** | Group per week; Site, Assigned to, Status (Scheduled / On site / Needs follow-up / Done), Visit date, Photos, Check-in, Notes. Views: Table, Map, Calendar. Form: Field Report. | Report submitted → create/close item; overdue visit → notify manager |
| **Office requests** | Group per request type; Requester, Owner, Status (New / In progress / Waiting / Done), Due. Form: Request. Views: Table, Kanban | New request → assign by type; waiting > 3 days → nudge owner |
| **Sprint (programmers)** | Group per sprint; Assignee, Status (Backlog / In dev / In review / Blocked / Done), PR link, Estimate. Views: Kanban, Timeline | PR merged → Done; Blocked > 1 day → notify lead |
| **Content calendar (marketing)** | Group per month; Owner, Channel, Publish date, Status (Idea / Draft / In review / Approved / Published), Asset. Views: Calendar, Kanban | Moved to In review → notify approver; approved → set publish task |
| **Team check-in** | One check-in per person per day; digest view | Missing check-in by cut-off → gentle reminder |
| **Portfolio** | Boards from other workspaces rolled up by status category | None; read-only dashboards |

Templates are our own wording and layout. Keep boards small: roughly 6–10 columns.

---

## 6. Progress reporting (the heart of the system)

### 6.1 What counts as progress
Item status category changes, subitem completion, updates posted, check-ins, form reports, and linked PR state. **Percent complete** of an item = done subitems / total subitems (or manual if none). Board and portfolio % complete roll up from items by category. Weighted estimates are optional.

### 6.2 Daily check-in
- Prompt at each person's local morning or end of day (per role: field staff at end of shift).
- Three fields: *Done*, *Next*, *Blocked*. Can link items; pre-filled from what they changed today.
- Takes under a minute on a phone. Blockers raise a flag to the manager.
- **Not punitive by design:** check-in completion is shown to managers as a team rate and per-person list for follow-up, never as a performance score. HR sets policy.

### 6.3 Weekly digest (to managers and executives)
Completed this week, overdue, blocked, stuck (no update > N days and not done), workload by person, check-in rate, upcoming deadlines. Delivered in-app and by email.

### 6.4 Dashboards
Widgets: counts by status category, overdue list, workload, % complete by board, burn-up for a sprint, check-in rate, recent activity, map of today's field visits. Each widget respects the viewer's permissions.

### 6.5 Field reporting
A *Field Report* form (works offline): site/item, outcome, photos, notes, and an optional **Check in here** button that records location once, with a visible purpose. Submission updates the item and notifies the owner.

---

## 7. Automations

### 7.1 Grammar
`WHEN <trigger> [IF <conditions>] THEN <actions>`

| Triggers (MVP) | Conditions | Actions (MVP) |
|---|---|---|
| Item created · status becomes X · column changes · assignee changes · moved to group · form submitted · date arrives (due in N days, overdue) · recurring schedule · check-in missing at time T · PR state changes (GitHub) | Column equals / contains · assigned to · priority · within working hours | Set column · move to group · assign · notify (in-app / email / push) · create item or subitem · post update · create recurring item · outgoing webhook (allow-listed hosts) |

Also: **buttons** (one click runs actions on an item or a board) and **scheduled commands** (daily/weekly), covering the same shapes Butler documents (rules, card buttons, board buttons, calendar and due-date commands).

### 7.2 Safety rules
- Runs as a system actor limited to the automation's board; it can never do more than the creator could.
- **Loop guard:** each event carries a `caused_by` chain; max depth 3; per-automation rate limit; idempotency key `(event_id, automation_id)`.
- Every run is logged (`automation_runs`), failures notify the owner, and there is a **test/dry-run** mode.
- Outgoing webhooks: HTTPS only, host allow-list, no private/link-local IPs (SSRF), signed payloads, timeouts, no secrets in URLs.
- Only board owners create automations that notify many people or call webhooks.

---

## 8. Architecture

```
 Browser / PWA (React) ──HTTPS + WSS──►  API (NestJS)  ──►  PostgreSQL (private)
        │  IndexedDB outbox                │  modules: auth, boards, items, columns, views,
        │  (offline)                       │  updates, files, forms, automations, reports,
        ▼                                  │  notifications, integrations, audit
   Service worker + push                   ├──►  Redis (private): queues, presence, rate limits
                                           ├──►  MinIO (private): attachments, presigned URLs, AV scan
 Keycloak (OIDC, same as CloudConnect) ◄───┤
 Workers (jobs): automations, digests, reminders, email, webhooks, importers
 Integrations: GitHub, Slack/Teams, email in/out
```

### 8.1 Stack (reuses CloudConnect's choices so one team can run both)
React 18 + TypeScript + Vite + Tailwind (PWA) · NestJS API with a **global deny-by-default guard** and DTO validation (`whitelist: true`) · PostgreSQL 16 · Redis 7 + a Redis-backed job queue · MinIO · Keycloak (OIDC, MFA for admins) · Socket.IO or native WebSocket for realtime · Docker Compose first. Confirm versions at install time; record deviations as ADRs.

### 8.2 Realtime
Authenticate at connect. A client **subscribes to a board** only after the server checks board membership; every inbound event is re-authorized, schema-validated, size- and rate-limited. Server pushes minimal change events; clients refetch or patch. When a user's role or membership changes, their subscriptions are re-checked or dropped.

### 8.3 Offline sync (field staff) — rule O-1
- The client keeps an **outbox** in IndexedDB. Each operation has a client-generated `op_id` (UUID), the entity ids, the **base version** it was made against, and the new value.
- The server applies ops in order inside a transaction; an `op_id` already seen returns the stored result (idempotent). Ops are small and per-cell, so different people editing different columns never conflict.
- **Stale base version on the same cell:** if the values differ, the server returns a conflict with the current value; the app shows "your change / their change" and the user chooses. No silent last-writer-wins for Status, People, or Date. Free-text fields keep both versions in the update thread.
- Deletes are tombstones. Photos upload separately with resumable, retried uploads and attach when complete. Failed ops stay visible with a retry button; nothing is dropped silently.
- Server time is authoritative for ordering; the device clock is stored only as `captured_at`.

### 8.4 Security and network
Reuse CloudConnect's zones: only HTTPS/WSS at the edge; PostgreSQL, Redis, MinIO private; admin access through VPN/bastion with MFA; TLS everywhere; secrets in a vault; rate limits on login, form submit, file upload, and automation runs.

Application controls: DTO whitelisting (blocks mass assignment); **every object lookup checks board membership** (blocks IDOR, e.g. `/items/:id` must verify the item's board); rich text rendered through a sanitizer with a Content-Security-Policy; uploads limited by size/type, scanned, served via short-lived presigned URLs with `Content-Disposition: attachment` for risky types; CSRF protection for cookie sessions; no `eval` in formulas; guests see only their shared boards and cannot enumerate users.

### 8.5 Integrations
GitHub (link PRs/issues to items, map PR state to status), Slack or Teams (notifications, create-item command), email in (to-do capture, like an inbox) and out (digests). Verify webhook signatures, use least-privilege tokens, store tokens encrypted, and log every outbound call. Importers for **Trello JSON** and **CSV** (so a pilot on Trello migrates cleanly).

### 8.6 CloudConnect link (optional, later)
Same Keycloak sign-in; "Start meeting" button on an item that opens a CloudConnect room; a *Remote support* form that creates an item and requests a session. Remote control still follows CloudConnect's consent rules; WorkSync only creates the request.

---

## 9. Identity, permissions, audit

### 9.1 Roles
**Organization:** Admin, Manager, Member, Guest (optional). **Board:** Owner, Editor, Contributor (add/edit content, cannot change structure), Assigned-only (edit only items assigned to them), Viewer. Board owners can narrow but never exceed the organization role. Column-level restrictions come in a later milestone. This mirrors the role ceilings monday documents for its Enterprise tier, applied from the start.

### 9.2 Checks on every request and event
User active · org role allows the action · board membership and board role allow it · the item/column/update/attachment belongs to that board · token not expired · guest scope respected · dashboards and search return only permitted data.

### 9.3 Authorization tests (authz matrix)
Anonymous vs authenticated · member vs manager vs admin · board member vs non-member · each board role against each action · assigned-only editing an unassigned item · guest vs internal · cross-board item id guessing · removed member with open WebSocket · dashboard widget over a board the viewer cannot open.

### 9.4 Audit events
Login success/failure · role and membership changes · board visibility changes · export/download of bulk data · automation create/edit/enable with webhook or mass notify · integration token changes · form publish · admin impersonation (if any) · audit-log reads · location check-in views by managers. Include timestamp, actor, action, target, result, correlation id; never secrets or free-text content.

---

## 10. Privacy and worker transparency (P-1, D-1)

| Topic | Rule |
|---|---|
| Location | Only when the employee taps **Check in** or attaches location to a field report. Foreground, one reading, with the purpose shown. No background tracking, no trails. Visible to the employee and to board members with permission. Default retention 90 days (owner decides). |
| Time | Employee-controlled timer or manual entry. No automatic activity capture. Totals shown per item, not per minute of activity. |
| Photos | Attached to items for work purposes; scanned; access follows the board. Warn against photographing people without need. |
| Visibility | A "What can my manager see about me?" page lists the data categories and who can view them. |
| Metrics | Check-in rates and completion counts are management information, not an automatic performance score. HR defines how they are used. |
| Notice and consent | Written notice and, where required, consent before launch. Data Privacy Act review by HR/counsel/DPO covering lawful basis, DPO contact, data subject rights, retention, breach notification, and any cross-border transfer. |
| Retention | Defined per data type before production; automated purge job; verified. |
| Guests | See only their shared boards; no directory access. |

---

## 11. Quality and security tooling

| Area | Tool | Required outcome |
|---|---|---|
| Types | TypeScript strict | Failures block merge |
| Lint / format | ESLint, Prettier | Consistent code |
| Tests | Vitest (web/packages), Jest (API), Playwright (e2e), k6 (load) | Reproducible |
| Authorization lint | `scripts/authz-guard.mjs` | Global guard present, `@Public()` allow-listed with an ADR, gateway handlers guarded, DTO whitelist on. **A signal, not proof** |
| Secrets | gitleaks binary (pre-commit and CI), plugin hook `guard-secrets` as a tripwire | Hard fail |
| SAST / deps | CodeQL, `npm audit`, Dependabot | High/critical triaged |
| Containers | Trivy | High/critical block |
| DAST | OWASP ZAP in staging | Before pilot |
| Accessibility | axe checks in Playwright, manual keyboard pass | WCAG 2.1 AA on core flows |
| External | Independent pen-test | Before company-wide rollout |

---

## 12. Repository layout

```text
worksync/
├── AGENTS.md  README.md  SECURITY.md  package.json  .env.example  .gitignore
├── .agents/            agents/ (roles)  skills/ (15)      <- source of truth
├── .claude-plugin/     marketplace.json
├── plugin/worksync/    Claude Code plugin (generated + hooks + commands)
├── .github/            workflows/ci.yml  dependabot.yml  PULL_REQUEST_TEMPLATE.md
├── docs/               architecture/ research/ adr/ security/ privacy/ operations/ api/
├── apps/               web/ (React PWA)   api/ (NestJS)   worker/ (jobs)
├── packages/           shared-types/
├── scripts/            gen-agents.mjs  build-plugin.mjs  authz-guard.mjs  *.test.mjs
├── infra/              docker/ deployment/ monitoring/
└── tests/              integration/ e2e/ security/ load/
```
Start with `apps/web`, `apps/api`, `packages/shared-types`, Postgres and Keycloak in Compose. Add `worker`, Redis, and MinIO when a milestone needs them. No empty placeholder services.

---

## 13. Agents, skills, plugin

Role files live in `.agents/agents/` (generated by `node scripts/gen-agents.mjs`); skills in `.agents/skills/`; `node scripts/build-plugin.mjs` assembles the Claude Code plugin (read-only tools for review roles). Install: `/plugin marketplace add <this folder>` then `/plugin install worksync@worksync-local`.

**Roles:** product-analyst, architect, api-architect, database, designer, frontend, backend, realtime-sync, mobile-pwa, automation, integrations, reporting, qa, security, privacy-compliance, reviewer, devops, documentation, system-debugger, performance-engineer.

**Skills:** board-data-model, permission-model-review, authz-test-matrix, automation-engine-design, offline-sync-review, realtime-sync-review, progress-reporting-design, worker-privacy-review, integration-webhook-review, board-template-design, threat-modeling, audit-event-design, db-migration-review, pr-checklist, adr-writer.

**Commands:** `/ws-gate W0..W7` · `/ws-review` · `/ws-authz` · `/ws-adr <title>` · `/ws-template <role>`.

**Hooks:** `guard-secrets` (blocks real `.env` writes and obvious secrets) · `post-api-guard` (re-runs the authorization lint after edits to controllers, gateways, `main.ts`, modules).

Collaboration rules: analyst and architect plan first; implementers build after approval; security and privacy review sensitive designs and diffs independently; the author never self-certifies authorization, privacy, or sync code; QA writes negative cases first.

---

## 14. Milestones

Each starts when the previous **Exit** passes. Week counts assume a small team and are rough.

### W0 — Discovery (weeks 0–2)
- [ ] Interview 2–3 people from each group in section 1.1; capture their current reporting routine
- [ ] Pilot team chosen; 2-week Trello/monday pilot run and findings written down (section 2)
- [ ] Decide open decisions (section 18); ADR-001…006 drafted
- [ ] Threat model (`threat-modeling`); privacy review started with HR/DPO
- **Exit:** requirements cut to a v1 list the owner signed; build-vs-buy decision recorded.

### W1 — Foundation (weeks 2–5)
- [ ] Repo, AGENTS.md, plugin, CI green on empty project, secret scanning
- [ ] SSO via Keycloak, org roles, global deny-by-default guard, audit log
- [ ] Workspaces, boards, groups, items, subitems, columns (MVP types), Table view, fractional ordering
- **Exit:** `npm run validate` green; authz matrix tests (section 9.3) pass for boards and items.

### W2 — Collaboration (weeks 5–8)
- [ ] Kanban view, updates with @mentions, files (scan + presigned), notifications (in-app, email)
- [ ] Realtime board sync with per-subscription authorization
- **Exit:** two users edit one board live; removed member loses live access immediately; upload abuse tests pass.

### W3 — Progress reporting (weeks 8–11)
- [ ] Status categories, subitem rollups, My Work, Calendar, Timeline
- [ ] Daily check-in, weekly digest, dashboards v1, "stuck" detection
- **Exit:** pilot team uses check-ins for 2 weeks; digest numbers match a manual count.

### W4 — Automations, forms, templates (weeks 11–14)
- [ ] Rule engine (triggers/conditions/actions, loop guard, dry-run, run log), buttons, scheduled/due-date triggers
- [ ] Forms, role templates (section 5), recurring items
- **Exit:** loop and rate-limit tests pass; SSRF tests for webhooks pass; each template works end to end.

### W5 — Field and mobile (weeks 14–18)
- [ ] PWA install, offline outbox, idempotent sync, conflict UI, resumable photo upload, push
- [ ] Field Report form, explicit location check-in, Map view, retention job
- **Exit:** field pilot works in airplane-mode tests; no lost or duplicated ops in the sync test suite; privacy review signed off on location handling.

### W6 — Integrations and capacity (weeks 18–21)
- [ ] GitHub, Slack/Teams, email-in, Trello/CSV importers
- [ ] Workload view, time tracking, portfolio rollups
- **Exit:** signature-verification and token-scope tests pass; importer round-trip tested on a real export.

### W7 — Hardening and rollout (weeks 21–25)
- [ ] External pen-test; findings fixed or risk-accepted in writing
- [ ] Backup/restore drill, monitoring, load test at agreed headcount, accessibility pass
- [ ] Training, champions per team, pilot → staged rollout, signed notices
- **Exit:** no unresolved critical/high; verified restore; sign-off by security, privacy, and the owner.

---

## 15. Testing strategy

- **Authorization:** the matrix in 9.3; run on every PR.
- **Realtime:** subscribe without membership; membership revoked mid-session; oversized and malformed events; reconnect storm.
- **Offline sync:** duplicate op replay; reordered ops; stale base version; photo upload interrupted at each stage; device clock wrong; two devices, one user.
- **Automations:** loops (A triggers B triggers A), burst of events, failing action, webhook to private IP, disabled mid-run.
- **Reporting:** rollup math against hand-computed fixtures; time-zone and daylight-saving boundaries; permission-filtered widgets.
- **Privacy:** location never recorded without the tap; purge job removes what retention says; "what can my manager see" matches reality.
- **Load:** k6 at agreed headcount plus headroom; board with thousands of items; large dashboards.
- **Usability:** timed field-report task on a mid-range phone; keyboard-only pass.

Coverage numbers are a signal, not proof; require strong coverage of authorization, sync, and automation logic.

---

## 16. Definition of Done

- [ ] Matches the approved plan, architecture, and ADRs
- [ ] Threat and abuse cases considered; server-side authn/authz on every route and event
- [ ] Input validated (DTO whitelist); errors, timeouts, retries, cleanup handled
- [ ] Audit event added where A-1 applies; no new personal data without a privacy note
- [ ] Positive, negative, and failure-path tests added; sync/automation changes include replay and loop tests
- [ ] Typecheck, lint, tests, authz lint run where configured; secret and dependency checks run
- [ ] Migrations, shared-types, OpenAPI, ADRs, docs updated in the same PR
- [ ] No secrets, no unrelated diff; a reviewer read the actual diff
- [ ] Report lists exact commands and results, known limits, next step

---

## 17. Adoption and rollout (where these tools usually fail)

1. **Pilot one team first**, ideally one that feels the pain of status meetings. Fix the template with them.
2. **One champion per group** (field, office, programmers, marketing) who helps peers in week one.
3. **Keep boards small and the template opinionated.** Too many columns kills adoption.
4. **Replace a meeting or a spreadsheet, don't add to them.** Retire the old status report the day the digest starts.
5. **Managers use the dashboards in their regular meetings**, or people stop updating.
6. **Explain what is and is not collected** (section 10) before launch.
7. **Measure adoption:** weekly active users, check-in completion, share of items with a current status, time to submit a field report.

---

## 18. Open decisions for the owner

1. Headcount now and in 2 years (drives load targets and cost).
2. Hosting: on-premises with CloudConnect, or cloud?
3. Field devices: Android, iOS, or both? Typical connectivity?
4. Languages: English only, or Filipino as well?
5. Is WorkSync a separate app, or a section inside CloudConnect (shared login either way)?
6. Retention periods: location, photos, check-ins, audit logs.
7. Are guests (clients, contractors) in scope for v1?
8. Is a Trello/monday pilot acceptable before building (section 2)?
9. Who is the accountable product owner and who is the DPO?

---

## 19. First actions

1. Create a separate `worksync/` repo; unzip this kit; `git init`.
2. Run `node scripts/gen-agents.mjs --check`, `node scripts/build-plugin.mjs --check`, and `node --test scripts/authz-guard.test.mjs`.
3. Answer section 18 (at least items 1, 2, 5, 8).
4. Run the section 2 pilot and the W0 interviews.
5. Write ADR-001…006 with `/ws-adr`: stack, realtime transport, offline-sync model, permission model, automation engine, privacy/location policy.
6. Only then scaffold W1.

---

## 20. References

Feature research and sources: `docs/research/FEATURE_ANALYSIS.md` · OWASP ASVS and API Security Top 10 (broken object-level authorization, mass assignment, SSRF) · NIST SSDF · Philippine Data Privacy Act of 2012 (RA 10173) and NPC guidance · WCAG 2.1 · NestJS documentation (guards, validation) · Playwright docs.

**Final rule:** if a feature conflicts with these requirements, stop and redesign it rather than weakening the controls.
