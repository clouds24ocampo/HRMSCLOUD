# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences of equal weight.
- **Employees and team leaders, daily.** Employees time in and out, take breaks and file requests, often on a phone. Team leaders watch their team's live attendance, set and change schedules, and approve requests.
- **HR and payroll staff, daily.** They manage schedules, correct DTR records, run payroll and answer HR requests. Super Admin sets up the organization and roles.

## Product Purpose

A production HRMS for organizations from small businesses to large enterprises, in any industry. It records what was planned (schedule) and what was actually worked (DTR), then turns that into auditable payroll. Success means attendance and pay are accurate, explainable down to source punches, and nobody has to trust a number they cannot trace.

## Positioning

Philippine payroll and DOLE rules are built in as editable, dated rules (SSS/GSIS, PhilHealth, Pag-IBIG, BIR withholding, 13th month, premium pay, remittance reports), and attendance is strictly controlled in the same system: password-verified time stamps, GPS tag at the moment of each stamp, break limits, schedule adherence and auto-flagging. One engine serves every industry; only data differs.

## Operating Context

- Time stamps use the server clock only; the browser supplies location, never time.
- Records are append-only. Corrections are new entries with a reason; finalized payroll is never silently altered.
- Visibility follows the supervisor chain (`managerId`); HR and Super Admin see the whole organization. Roles and per-account functions are moving from fixed roles to configurable permissions.
- Works across organizations (multi-tenant); every record is scoped to one organization.

## Capabilities and Constraints

- Modules: employees and organization, schedule (regular weekly plus day changes, team-linked), DTR clock card (Punch and Issues pages), overtime, leave, payroll, payslips, performance, learning, documents, recruitment, requests, announcements, reports, audit log.
- Planned, not yet built: custom roles and permissions, DTR requests with proof upload (absent, half day, weather, missed punch), work-site geofence, auto time-out and auto-absent, monthly warning ladder with HR dismissal review (never automatic).
- Stack: Next.js, React, Prisma, PostgreSQL, Tailwind. Times shown in the organization timezone.
- Undecided: warning-ladder thresholds, adherence thresholds beyond the 95%/85% defaults, geofence default policy.

## Brand Commitments

Product name is HRMS. No logo, brand voice or visual identity has been declared binding.

## Evidence on Hand

Working app with demo data (`npm run demo:seed`), Philippine compliance notes in `PH-COMPLIANCE.md`, engineering standards in `ENGINEERING_STANDARDS.md`. No customer testimonials, benchmarks or pricing exist; do not invent any.

## Product Principles

1. Every number is traceable to its source record.
2. Mobile first: the clock card must work one-handed on a phone.
3. Security and privacy are core: least privilege, sensitive data hidden unless needed.
4. One source of truth per business rule; the UI displays, the server decides.
5. Minimum clicks for the changes people make constantly (schedule, punches).

## Accessibility & Inclusion

WCAG 2.1 AA: semantic HTML, ARIA labels, keyboard navigation, focus management, AA contrast. Mobile-first layouts with no sideways scroll.
