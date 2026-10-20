# HRMS Development Plan (Philippines)

**Stack:** TypeScript end-to-end, Next.js (web), Expo/React Native (mobile, later phase), Supabase (Postgres, Auth, Storage, RLS)
**Note:** I could not read your ChatGPT share link (it returned only the page title, "Best HRMS Platforms"). This plan stands on its own. If ChatGPT's plan had specific features or priorities, paste them and I will reconcile the two.

---

## 1. Product Definition

**Goal:** A multi-tenant HRMS for Philippine SMEs and LGUs covering employee records, attendance, leave, payroll with statutory compliance, and reporting.

**Decide before coding (these change the architecture):**
1. **Who is the first customer?** A private company, an LGU, or a barangay. LGU payroll (plantilla, salary grades, PERA, GSIS) differs heavily from private-sector payroll (SSS, PhilHealth, Pag-IBIG, BIR withholding). Build one first, not both.
2. **SaaS or single-client deployment?** SaaS means multi-tenancy from day one. Single-client is simpler but hard to convert later.
3. **Buy vs build.** Existing HRMS products already cover the basics. Your edge must be a specific niche (e.g., LGU compliance, local payroll rules, offline-tolerant attendance). Without one, you are rebuilding a commodity.

**Honest pushback:** Payroll is the highest-risk module. A calculation error means employees are paid wrong, and contributions are filed wrong. As a self-described beginner, do not make payroll part of the MVP. Ship records, attendance, and leave first, and add payroll only after the data foundation is proven with a real client.

---

## 2. Scope by Module

| Module | MVP | Phase 2 | Phase 3 |
|---|---|---|---|
| Auth, roles, organizations | Yes | | |
| Employee 201 file | Yes | | |
| Org structure (departments, positions) | Yes | | |
| Attendance / DTR | Yes | | |
| Leave management | Yes | | |
| Document storage | Yes | | |
| Payroll (basic) | | Yes | |
| Statutory contributions and reports | | Yes | |
| Loans, deductions, 13th month | | Yes | |
| Recruitment / ATS | | | Yes |
| Onboarding / offboarding | | Yes | |
| Performance reviews | | | Yes |
| Training and certifications | | | Yes |
| Employee self-service mobile app | | Yes | |
| Analytics dashboards | Basic | Yes | Yes |
| Integrations (biometrics, accounting) | | | Yes |

---

## 3. Philippine Compliance Checklist

Verify every rate and rule against current official issuances before implementing. Contribution tables and tax rules change.

- **SSS, PhilHealth, Pag-IBIG:** contribution schedules, employer/employee shares, remittance reports
- **BIR:** withholding tax on compensation (TRAIN law tables), Form 2316, 1601-C, alphalist
- **13th month pay** (PD 851), **service incentive leave**, **holiday pay** rules, **night shift differential**, **overtime** rules (Labor Code)
- **Leave laws:** maternity (RA 11210), paternity (RA 8187), solo parent (RA 8972), VAWC leave (RA 9262), special leave for women (RA 9710)
- **Data Privacy Act (RA 10173):** HR data is personal and sensitive personal information. You need consent handling, access controls, retention rules, breach procedure, and likely NPC registration depending on scale. Treat this as a design requirement, not paperwork.
- **LGU-specific (if applicable):** CSC rules, plantilla, salary standardization law tables, GSIS, COA documentation, DBM circulars
- **Action:** engage a Philippine HR/payroll practitioner and a lawyer to validate the rules engine. Do not rely on memory or AI for rates.

---

## 4. Architecture

### 4.1 Multi-tenancy
- Single Postgres database, `organization_id` on every tenant table
- **Row Level Security** on every table, policies keyed on membership in `organization_members`
- Never rely on frontend checks for access control

### 4.2 Roles and permissions
Roles: Super Admin (you), Org Admin, HR Manager, Payroll Officer, Department Head/Supervisor, Employee.
Use a `roles` and `permissions` table pair plus RLS helper functions (`has_permission(org_id, 'payroll.run')`) rather than hardcoded role strings.

### 4.3 Core principles
- **Effective-dated records:** salary, position, and department changes carry `effective_from`/`effective_to`. Payroll for past periods must reproduce exactly.
- **Immutable audit log:** every change to sensitive tables recorded (who, when, old, new) via triggers.
- **Soft delete only** for HR records.
- **Payroll runs are snapshots:** once finalized, store computed results; never recompute from live data.
- **Money as integers (centavos)** or `numeric(14,2)`, never floats.
- **Timezone:** store UTC, display Asia/Manila.

### 4.4 Suggested layout
```
/apps
  /web        Next.js (admin, HR, self-service)
  /mobile     Expo (phase 2)
/packages
  /db         Supabase migrations, generated types
  /payroll-engine   pure TypeScript, no I/O, heavily tested
  /shared     zod schemas, constants, utils
```
Keeping the payroll engine as a pure, framework-free package makes it testable and reusable.

---

## 5. Data Model (core tables)

- `organizations`, `organization_members`, `roles`, `permissions`
- `employees` (personal info, employment status, hire date, government IDs encrypted)
- `employee_contacts`, `employee_dependents`, `employee_education`, `employee_documents`
- `departments`, `positions`, `employment_history` (effective-dated)
- `work_schedules`, `shifts`, `holidays` (regular, special non-working, local)
- `attendance_logs` (raw punches), `attendance_daily` (computed), `attendance_adjustments`
- `leave_types`, `leave_policies`, `leave_balances`, `leave_requests`, `leave_ledger`
- `approval_workflows`, `approval_steps`, `approvals`
- Later: `payroll_periods`, `payroll_runs`, `payslips`, `payslip_lines`, `compensation_components`, `loans`, `statutory_tables` (versioned)
- `audit_logs`, `notifications`, `files`

**Sensitive fields** (TIN, SSS, PhilHealth, Pag-IBIG numbers, salary): column-level encryption or restricted views, with access logging.

---

## 6. Phased Roadmap

Assumes one developer working part to mid-time. Adjust if you have a team.

### Phase 0: Discovery (2 weeks)
- Interview 3 to 5 real HR/payroll staff. Collect their actual forms, spreadsheets, DTRs, and pain points.
- Choose the target segment and write a one-page scope.
- Deliverables: scope doc, process maps, sample data, wireframes of 5 key screens.
- **Exit criterion:** a client agrees to pilot.

### Phase 1: Foundation (3 to 4 weeks)
- Monorepo, CI, environments (dev, staging, prod), Supabase projects
- Auth, organizations, roles, RLS policies with automated policy tests
- Audit logging, file storage, base UI kit, error handling
- **Exit:** a user from Org A provably cannot read Org B data (automated test).

### Phase 2: Employee Records and Org Structure (3 weeks)
- Employee CRUD, 201 file, documents, departments, positions, employment history
- CSV import with validation and dry run
- Search, filters, exports

### Phase 3: Attendance (4 weeks)
- Schedules and shifts, holidays calendar
- Time in/out (web first), manual entry with approval, corrections
- Daily computation: late, undertime, absences, overtime candidates
- DTR report and export
- Decide early: biometric import, GPS/selfie, or manual. Each carries privacy and anti-fraud implications.

### Phase 4: Leave and Approvals (3 weeks)
- Leave types and accrual policies, balances via ledger (never mutate a balance directly)
- Request and approval workflow with notifications
- Leave calendar, integration with attendance

### Phase 5: Pilot Release (2 to 4 weeks)
- Security review, backups tested, privacy notice, user training, support channel
- Run with one client in parallel with their existing process
- **Exit:** two full cycles with no data-integrity issues

### Phase 6: Payroll (8 to 12 weeks)
- Compensation components, pay schedules, payroll periods
- Pure payroll engine: gross, deductions, contributions, tax, net, with versioned statutory tables
- Test suite built from real payslips (hundreds of cases) and cross-checked against the client's current computation
- Payslip generation (PDF), bank file export, approval and lock
- Statutory reports and 13th month
- Run parallel payroll for at least 2 cycles before going live

### Phase 7: Self-Service Mobile and Analytics (4 to 6 weeks)
- Expo app: payslips, leave filing, attendance, announcements
- Dashboards: headcount, attrition, leave utilization, overtime cost

### Phase 8: Extended HR (ongoing)
- Recruitment, onboarding, performance, training, integrations

---

## 7. Security and Privacy

- RLS everywhere, tested with automated policy tests per role
- MFA for admin, HR, and payroll roles
- Encrypted backups, tested restores, point-in-time recovery enabled
- Least-privilege service keys; service role key never in client code
- Rate limiting, input validation (zod on every boundary)
- Audit trail viewable by Org Admin
- Data retention and deletion policy per Data Privacy Act
- Written incident response and breach notification procedure
- Data stored in an appropriate region; document where and why

---

## 8. Testing Strategy

- **Unit tests:** payroll engine, attendance computation, leave accrual (these must have very high coverage)
- **RLS policy tests:** per table, per role, cross-tenant attempts
- **Integration tests:** API and database
- **E2E (Playwright):** login, file leave, approve, run attendance
- **Golden-file tests:** known payslips from real data must match to the centavo
- **UAT:** with real HR staff on staging with anonymized data

---

## 9. DevOps

- Environments: local (Supabase CLI), staging, production
- CI: typecheck, lint, tests, migration check on every PR
- Migrations versioned in repo, never edited in the dashboard
- Monitoring: Sentry, uptime checks, database health, slow query logs
- Backups and a documented restore drill every quarter

---

## 10. Team, Budget, and Timeline

| Item | Estimate |
|---|---|
| Solo developer, Phases 0 to 5 | roughly 4 to 5 months |
| Add Payroll (Phase 6) | roughly 2 to 3 more months |
| Full Phases 0 to 7 | roughly 9 to 12 months solo |
| Part-time HR/payroll advisor | strongly recommended |
| Lawyer review (privacy, contracts, terms) | one-time plus as needed |

Infrastructure at pilot scale is modest (Supabase Pro, hosting, monitoring, email/SMS); price it against your client count before committing.

---

## 11. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Payroll miscalculation | Delay to Phase 6, golden tests, parallel runs, practitioner review |
| Cross-tenant data leak | RLS policy tests in CI, no service key on client |
| Changing statutory rules | Versioned statutory tables, not hardcoded constants |
| Scope creep | Hard MVP boundary, written change process |
| Data privacy non-compliance | Privacy by design, legal review, DPO appointed |
| Solo-developer bus factor | Documentation, runbooks, automated deploys |
| No customer demand | Phase 0 pilot commitment before building |
| Biometric and attendance fraud disputes | Clear policy, audit trail, supervisor approval for edits |

---

## 12. Success Metrics

- Pilot client runs full attendance and leave cycles in-system
- Payroll variance vs. manual computation: zero after parallel runs
- Time to complete a payroll cycle reduced by an agreed percentage
- Zero cross-tenant access incidents
- Support tickets per active user trending down

---

## 13. Immediate Next Steps (this week)

1. Choose the target segment (private SME vs. LGU) and the pilot client.
2. Collect their real DTR, leave forms, and payslip samples.
3. Set up the monorepo, Supabase project, and the multi-tenant RLS skeleton.
4. Write the RLS test harness before building any feature screens.
5. Book a session with an HR/payroll practitioner to review the rules you will implement.
