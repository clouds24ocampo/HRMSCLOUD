# 🌐 HRMS Master System Guide: Operations, Features & Testing Manual

> **Living Documentation**: This document serves as the single source of truth for the Human Resources Management System (HRMS). It covers every navigation tab, feature capability, role permission, operational workflow, and end-to-end testing procedure. Keep this document updated whenever new features or system changes are introduced.

---

## 📑 Table of Contents

1. [System Architecture & Roles](#1-system-architecture--roles)
2. [Master Tab & Feature Reference](#2-master-tab--feature-reference)
   - [Home / Dashboard](#home--dashboard-dashboard)
   - [People (Employees, Contracts, Handbook, Org, Recruitment, Documents, Policies, ID)](#people-management)
   - [Time & Attendance (Schedule, DTR, Overtime, Leave, Daily Report)](#time--attendance)
   - [WorkSync (Projects, Tasks, Views & Collaboration)](#worksync-project--task-management-worksync)
   - [Pay & Compensation (Payroll, Payslips, Cash Advance, Incentives)](#pay--compensation)
   - [Talent & Development (Performance, Learning)](#talent--development)
   - [Support & Communication (Chat, Requests, Announcements, Reports, Analytics)](#support--communication)
   - [Administration & Security (Settings, Users, Audit Log)](#administration--security)
3. [End-to-End Operational Workflows by Role](#3-end-to-end-operational-workflows-by-role)
4. [Comprehensive Testing & Quality Assurance Guide](#4-comprehensive-testing--quality-assurance-guide)
   - [Automated Testing Suite](#automated-testing-suite)
   - [Manual Test Scripts (Do & Expect)](#manual-test-scripts-do--expect)
   - [Sample Demo Data Management](#sample-demo-data-management)
5. [Living Document Protocol ("Update as We Get Along")](#5-living-document-protocol-update-as-we-get-along)

---

## 1. System Architecture & Roles

The system is built as a multi-role, enterprise-grade business platform designed for Philippine labor compliance, exact wage calculations, real-time presence tracking, and auditable project delivery.

### Role Hierarchy & Permissions

| Role | System Scope & Authority |
| --- | --- |
| **Super Admin** | Full root access. Organization setup, system settings, user credentials, database maintenance, emergency deletions. |
| **HR Admin** | Full operational access across all company personnel: onboarding, 201 files, organization, DTR corrections, payroll processing, compliance reporting, policy enforcement. |
| **Manager** | Supervisory access: reviews only their direct and downline department team. Manages team shifts, live attendance, leave approvals, overtime verification, and project boards. Cannot view payroll. |
| **Employee** | Self-service access: personal time stamp clock, personal DTR, own payslips, cash advance filing, leave requests, daily accomplishment reports, assigned WorkSync tasks, digital ID, policies. |

---

## 2. Master Tab & Feature Reference

### Home / Dashboard (`/dashboard`)

*The daily operational hub for every logged-in user.*

- **Time Clock Widget**: Quick action buttons for `Time In`, `Meal Break`, `Rest Break`, `Trip/Field`, `Issues` (Weather, Calamity, Power Outage, Clinic), and `Time Out`. Server-validated timestamp with geolocation verification.
- **Live Status Roster (HR & Managers)**: Real-time board showing who is actively `Working`, `On Break`, `On Trip`, `Late`, `Absent`, or on `Leave`. Displays cumulative worked hours excluding breaks.
- **My Tasks Widget**: Direct glance at personal WorkSync tasks due today or urgent.
- **Announcements Feed**: Pinned company bulletins and official notices.

---

### People Management

#### 1. Employees (`/employees`)

- **Directory & Search**: Filter employees by department, employment status (Probationary, Regular, Contractual), position, or name.
- **Add Employee**: Onboard new staff with personal data, residential address, department, position, supervisor, hire date, and monthly basic pay.
- **Employee Profile**:
  - **Overview**: Basic personal info, residential address, emergency contacts, employment timeline.
  - **Schedule Settings**: Configure regular shift schedule (e.g. 8:00 AM – 5:00 PM Mon–Fri) or Flexible Schedule.
  - **Rates & Compensation**: Computed daily and hourly rates ($Daily = Monthly \times 12 \div 313$, $Hourly = Daily \div 8$).
  - **DTR & History**: Quick view of individual attendance and past pay periods.

#### 2. Organization (`/organization`)

- **Department Hierarchy**: Visual organizational tree displaying Department Heads, Assistant Heads, and their reporting downlines.
- **Department Management**: Add and organize company departments (Operations, Engineering, HR, Sales, IT).
- **Position Levels**: Configure standard job positions and ladder levels (Executive, Department Head, Supervisor, Specialist, Associate).

#### 3. Recruitment (`/recruitment`)

- **Job Requisitions**: Open new job postings with requirements, salary range, and open slots.
- **Applicant Tracking System (ATS)**: Move applicants through stages: `Applied` → `Screening` → `Interview` → `Offer` → `Hired` / `Rejected`.
- **One-Click Onboarding**: Convert a hired applicant directly into an active employee profile.

#### 4. Employment Contracts (`/contracts`)

- **Automated Contract Generation & Import**: HR Admins and Managers can generate, import, issue, and manage official employment contracts.
- **Dynamic Variable Interpolation**: Automatically injects exact employee details into legal contract templates:
  - Exact Employee Name (`{{employee_name}}`)
  - Complete Residential Address (`{{employee_address}}` or `{{address}}`)
  - Official Position / Title (`{{position}}`)
  - Assigned Department (`{{department}}`)
  - Compensation / Salary (`{{salary}}`)
  - Start Date / Hire Date (`{{start_date}}`)
  - Company Legal Name (`{{company_name}}`)
- **Contract Templates**: Pre-configured with Philippine Labor Code compliant templates:
  - *Regular Employment Contract*
  - *Probationary Employment Agreement* (with 6-month evaluation standards)
  - *Project-Based / Fixed-Term Contract*
  - *Independent Contractor / Consultant Agreement*
- **Electronic Signing Workflow**: Issued contracts trigger a signature request for the employee. The employee reviews the terms with their exact details, checks the confirmation, and digitally signs. All events are logged with timestamp and IP certificate.
- **Print & PDF Export**: One-click official print formatting for physical filing or offline storage.

#### 5. Company Handbook (`/handbook`)

- **Centralized Employee Manual**: Complete, 8-chapter standard company handbook covering:
  1. *Welcome & Company Philosophy*
  2. *Working Hours, Shifts & DTR Time-Stamping*
  3. *Punctuality, Grace Period & Progressive Discipline Ladder* (Verbal, Written, Suspension, Dismissal)
  4. *Leaves & Holiday Entitlements* (VL, SL, SIL, Maternity, Paternity, Solo Parent, Magna Carta for Women)
  5. *Compensation, Cutoffs & Government Benefits* (SSS, PhilHealth, Pag-IBIG, 13th Month Pay)
  6. *Code of Conduct, Ethics & Harassment-Free Workplace* (Safe Spaces Act)
  7. *Occupational Health, Calamity & Safety Protocols* (OSH RA 11058, Typhoon/Disaster tags)
  8. *Separation, Resignation & Exit Clearance*
- **Employee Acknowledgment Tracking**: Employees read the handbook and electronically submit their agreement. HR sees an organization-wide compliance percentage (e.g., 94% acknowledged).
- **Custom Chapter Editor**: HR can update existing sections or add new chapters (e.g. Remote Work, AI Tool Usage).

#### 6. Documents (`/documents`)

- **201 Employee Document Compliance**: Central tracking for mandatory Philippine pre-employment requirements:
  - SSS, PhilHealth, Pag-IBIG numbers
  - BIR Form 1902 / 2316
  - Medical Certificate / Fit to Work
  - NBI / Police Clearance
  - Transcript of Records / Diploma
  - Signed Employment Contract
- **Document Status**: Tagged as `Submitted`, `Verified`, `Missing`, or `Expired`.
- **PDF Upload**: Upload digital copies for secure archival.

#### 7. Policies (`/policies`)

- **Policy Management**: Publish company policies, Code of Conduct, Privacy Policies, and Terms of Employment.
- **Mandatory E-Signatures**: Requires employees to read and electronically acknowledge policies. Unsigned policies trigger a persistent dashboard alert banner.

#### 8. Digital ID (`/id`)

- **Virtual Company ID**: Generates a tamper-proof digital ID with the employee's photo, designation, and active status.
- **QR Code Verification**: Admins can scan the QR code to verify the employee's active status and profile.
- **ID Designer**: Customize company card colors, branding logo, and display fields.

---

### Time & Attendance

#### 1. Schedule (`/schedule`)

- **Monthly Shift Planner**: Visual grid scheduling shifts across all employees.
- **Live Roster (`/schedule/live`)**: Instant real-time view of who is currently clocked in, on meal break, late, or absent.
- **Schedule Analytics (`/schedule/analytics`)**: Department-wide adherence statistics, tardiness rates, and absenteeism patterns.

#### 2. Daily Time Record — DTR (`/dtr`)

- **Detailed Audit Trail**: Records exact punch-in, punch-out, breaks, and business trips.
- **Multi-Period Rollups**: View attendance by **Day**, **Week**, **Semi-Monthly Cut-Off** (1st–15th / 16th–end), or **Month**.
- **Automated System Time-out Protection**: If an employee forgets to clock out, the system automatically logs them out 30 minutes after standard shift completion, flags the session as `System Logout`, suppresses overtime prompts, and deducts the 30-minute threshold from productive hours.
- **Progressive Disciplinary Audit**: Tracks infractions (Forgotten Logouts, Over-breaks, Tardiness) across a 4-tier ladder (Verbal Warning → Written Warning → Suspension → Dismissal) with a 3-month cooldown reset.
- **PDF Generation**: Download professional individual DTR sheets or an all-employee landscape payroll summary with daily wages and totals.

#### 3. Overtime (`/overtime`)

- **Filing**: File overtime for excess hours worked past scheduled shifts.
- **2-Tier Approval Flow**: Must be verified by the direct Manager, then approved by HR Admin before it is credited to payroll.
- **Calculations**: Automatically computes regular overtime (+25%), rest day overtime (+30%), and night differential (+10%).

#### 4. Leave (`/leave`)

- **Configurable Leave Types**: Vacation Leave, Sick Leave, Solo Parent Leave, Maternity/Paternity Leave, Bereavement Leave, Emergency Leave.
- **Accrual & Balances**: Tracks available leave credits, carry-over limits, and deductions.
- **Leave Filing & Workflow**: Employee submits dates with reason; managers approve/reject with mandatory justification.

#### 5. Daily Report (`/daily-report`)

- **Daily Accomplishments**: End-of-day submission where employees outline tasks completed, blockers encountered, and tomorrow's plan.
- **Supervisor Review**: Managers can leave feedback and comment on submissions.

---

### WorkSync: Project & Task Management (`/worksync`)

*Full standalone documentation in [WORKSYNC-GUIDE.md](WORKSYNC-GUIDE.md).*

- **Top Navigation**:
  - `Projects`: Company boards with health metrics (Blocked, Overdue, Stuck).
  - `My tasks`: Personal queue aggregating all cards assigned to your employee account.
  - `Daily activity`: Timestamped action log of what team members accomplished on boards.
- **The 5 Board Views**:
  - 📌 **Board**: Kanban view with draggable status lists (`To do`, `Doing`, `Blocked`, `Done`).
  - 📊 **Table**: Spreadsheet-style bulk editing for titles, assignees, dates, and priorities.
  - 📅 **Calendar**: Monthly view of task deadlines with one-click card creation.
  - ⏱️ **Timeline**: Gantt schedule showing duration bars and today's milestone line.
  - 📈 **Dashboard**: Visual progress percentages, workload per member, and velocity charts.
- **Card Capabilities**: Sub-task checklists with auto-calculated progress percentages, color labels, file attachments, and resolution audit records (`resolvedById`, `timeToResolve`).

---

### Pay & Compensation

#### 1. Payroll (`/payroll`)

- **Semi-Monthly Cut-off Engine**: Automatically aggregates verified DTR hours for the 1st–15th (paid month-end) and 16th–end (paid 15th of next month).
- **Philippine Statutory Deductions**:
  - **SSS**: Regular Social Security, WISP, and EC contribution tables.
  - **PhilHealth**: Mandated percentage premium shared equally between employee and employer.
  - **Pag-IBIG**: HDMF employee and employer statutory contributions.
  - **Withholding Tax**: Tax computation under the TRAIN Law brackets.
- **13th Month Pay & De Minimis**: Automatic calculation of non-taxable bonuses and de minimis benefits.
- **Payroll Locking**: Once finalized, payroll batches are locked to prevent retroactive alteration.

#### 2. My Payslips (`/payslips`)

- **Confidential Employee Access**: Employees can view itemized earnings (basic pay, overtime, night differential, allowances) and deductions (SSS, PhilHealth, Pag-IBIG, tax, cash advances, tardiness/undertime).
- **PDF Download**: Print-ready, official payslip format.

#### 3. Cash Advance (`/cash-advance`)

- **Request Submission**: Employees can request salary cash advances with a stated emergency reason.
- **Repayment Amortization**: Configure deduction schedules across 1, 2, or 4 payroll cut-offs.
- **Automatic Payroll Integration**: Approved advances are automatically deducted from future payroll runs until settled.

#### 4. Incentives & Spot Bonuses (`/incentives`)

- **Awarding Recognition**: HR Admins and Managers can award spot bonuses, attendance incentives, performance milestone awards, or project delivery bonuses directly from `/incentives` or from any WorkSync card.
- **Mandatory Employee Acceptance**: In compliance with auditable financial recognition, an incentive is created with `PENDING` status. The employee receives a notification and a prominent dashboard recognition banner where they click **"Accept Incentive"** with an optional acknowledgment note.
- **100% Auditable Record**: The award event, explicit employee acceptance, and any employee comments are immutably logged in the system `AuditLog` with exact timestamps and monetary centavos.
- **Automatic Payroll Disbursement**: Once accepted by the employee, the incentive is automatically credited to their upcoming semi-monthly payroll as an approved `EARNING` adjustment (`Incentive: [Title]`). When payroll is finalized, the incentive status transitions to `PAID` with the payslip ID permanently recorded.

---

### Talent & Development

#### 1. Performance (`/performance`)

- **Review Cycles**: Set annual, semi-annual, or quarterly performance evaluation cycles.
- **360° Evaluation Flow**: Employee Self-Assessment → Manager Review & Scoring → Calibration → HR Sign-off.
- **KPIs & Goals**: Track individual and departmental goals with percentage completion targets.

#### 2. Learning (`/learning`)

- **Training Catalog**: Company training courses, onboarding curricula, and skills modules.
- **Certificates**: Track training completion records and certification expirations.

---

### Support & Communication

#### 1. Chat (`/chat`)

- **Internal Messaging**: Real-time communication between team members, department groups, and project channels.

#### 2. HR Requests (`/requests`)

- **Helpdesk Ticketing**: Formal requests for Certificates of Employment (COE), Salary Certificates, DTR corrections, or disputes.
- **Status Tracking**: Track tickets from `Submitted` → `Under Review` → `Approved / Resolved`.

#### 3. Announcements (`/announcements`)

- **Company Broadcasts**: Post company-wide notices, holiday proclamations, or emergency directives with priority levels.

#### 4. Reports & Analytics Hub (`/reports`)

- **Central Analytics Dashboard**: 4 unified reporting tabs:
  - **Overview & Attendance**: Headcount, department distribution, tardiness rates, and absenteeism summaries.
  - **Document Requirements**: 201 compliance tracker with CSV export.
  - **Payroll & Compensation**: Statutory remittance reports (SSS, PhilHealth, Pag-IBIG, BIR 2316) and salary summaries.
  - **WorkSync Tasks**: Task velocity, completion rates, top contributors, and CSV export.

#### 5. Activity Analytics (`/analytics`)

- **System Telemetry**: Tracks login activity, kiosk stamping patterns, and security audit metrics.

---

### Administration & Security

#### 1. Settings (`/settings`)

- **Work Rules**: Configure grace periods for lateness, geolocation tolerances, and kiosk password verification.
- **Time Stamp Config**: Enable or customize punch buttons (breaks, field trips, special issues).
- **Shifts & Schedules**: Define shift templates and default meal periods.
- **Leave Configuration**: Define leave rules, credit allowances, and carry-over policies.

#### 2. Users (`/admin/users`)

- **Account Management**: Create user accounts, assign system roles, unlock locked accounts, and reset temporary passwords.

#### 3. Audit Log (`/audit`)

- **Immutable Audit Trail**: Chronological log of all critical system events (logins, role changes, payroll finalization, DTR overrides, employee edits) with user ID, IP address, and timestamp.

---

## 3. End-to-End Operational Workflows by Role

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        DAILY OPERATIONAL FLOW                          │
├────────────────────────────────────────────────────────────────────────┤
│ EMPLOYEE               MANAGER                  HR / SUPER ADMIN       │
│                                                                        │
│ 1. Time In (Phone/Kiosk) 1. Check Live Roster    1. Monitor Attendance  │
│ 2. Check "My tasks"      2. Review Roadblocks    2. Process 201 Files   │
│ 3. Update WorkSync Cards 3. Approve Overtime     3. Run Semi-Monthly    │
│ 4. File Overtime/Leave   4. Approve Leave           Payroll & Remit     │
│ 5. Submit Daily Report   5. Review Daily Reports 4. Audit Log & Rules   │
│ 6. Time Out              6. WorkSync Dashboard   5. Finalize Reports    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Comprehensive Testing & Quality Assurance Guide

### Automated Testing Suite

The repository contains automated unit, integration, and end-to-end browser tests.

#### Commands

```bash
# 1. Typecheck the entire codebase
npm run typecheck

# 2. Run unit and integration tests (Vitest)
npm run test

# 3. Run browser end-to-end tests (Playwright)
npx playwright test

# 4. Run WorkSync specific test suite
npx playwright test e2e/worksync.spec.ts
```

---

### Manual Test Scripts (Do & Expect)

Pair this checklist with your test runs to verify that real-world behavior matches requirements.

#### Test 1: First-Time Setup & Registration

1. **Do**: Open `http://localhost:3300` on a clean database and click **Register your organization**.
2. **Expect**: After creating the company and Super Admin account, registration automatically closes. Any attempt to visit `/register` redirects to the login screen.

#### Test 2: Time Stamping & Geolocation

1. **Do**: Open the login screen, switch to the **Time stamp** tab, enter ID and password, allow location on mobile, and press **Time In**.
2. **Expect**: Time In is recorded with exact server time, GPS coordinates, and device info.
3. **Do**: Type the wrong password 5 times.
4. **Expect**: The account ID is locked for 15 minutes to prevent brute-force attacks.

#### Test 3: Automated Time-Out & Infraction Tracking

1. **Do**: Time in an employee and leave the session open past shift completion (+30 minutes).
2. **Expect**: The system automatically executes a `System Logout`, records the reason as forgotten logout, deducts the 30-minute grace window from productive hours, suppresses overtime prompts, and records a 1st Offense (Verbal Warning) infraction.

#### Test 4: WorkSync Task Management

1. **Do**: Create a task in WorkSync, assign it to an employee, and open their **My tasks** tab.
2. **Expect**: The card immediately appears under **To finish**.
3. **Do**: Add 4 checklist items and check off 2.
4. **Expect**: Card progress displays **50%**.
5. **Do**: Move the card to **Done**.
6. **Expect**: Card shows resolution metadata (`Resolved by`, `Turnaround time`, `100% finished`).

#### Test 5: Payroll & Statutory Calculations

1. **Do**: Finalize an attendance cut-off (e.g. 1st–15th) for an employee with ₱25,000 monthly basic pay.
2. **Expect**: Daily rate computes to ₱958.47, hourly rate computes to ₱119.81, SSS, PhilHealth, Pag-IBIG, and withholding tax are deducted according to current statutory tables.
3. **Do**: Generate and download the payslip PDF.
4. **Expect**: A clean, printable PDF matching Philippine payroll compliance standards.

---

### Sample Demo Data Management

To test the system immediately with realistic data without typing everything manually:

```bash
# Seed demo company with 5 employees, shifts, DTR punches, and WorkSync boards:
npm run demo:seed

# Log in using the demo accounts:
# Admin:   admin@demo.test   | Password: Demo-Pass-12345
# HR:      hr@demo.test      | Password: Demo-Pass-12345
# Manager: manager@demo.test | Password: Demo-Pass-12345
# Staff:   emp1@demo.test    | Password: Demo-Pass-12345

# Remove demo data when testing is finished:
npm run demo:remove
```

---

## 5. Living Document Protocol ("Update as We Get Along")

Whenever modifying or adding new functionality to the codebase, follow this checklist to keep the documentation current:

1. **Tab & Route Additions**: When adding or renaming a route in `src/lib/menu.ts`, update Section 2 with the new URL, purpose, and role access.
2. **Business Rule Updates**: When changing payroll formulas, attendance deduction rules, or approval workflows, update Sections 2 and 3.
3. **Test Cases**: When implementing a bug fix or feature, add a corresponding manual test case to Section 4 and write an automated test in `src/**/*.test.ts` or `e2e/*.spec.ts`.
4. **Knowledge Graph Sync**: Always run `graphify update .` after updating code and documentation to keep AST and relationship graphs synchronized.
