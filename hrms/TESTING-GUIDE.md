# HRMS Testing Guide

Everything runs on your own computer. Nothing is sent anywhere.

- App: http://localhost:3300
- Database (Postgres): port 3366, started for you

## 1. Start it

| Do this | What happens |
|---|---|
| Run `npm run dev` in the `hrms` folder, or double-click `start-hrms.bat` | Starts Docker, the database, applies updates, then the app. Wait for "Ready". |
| Run `npm run dev:phone` | Same, plus an HTTPS link for testing on a phone (needed for real GPS). Needs `cloudflared`. |
| Open http://localhost:3300 | Landing page. |

If the database is off you see a friendly "Database is not running" page, not a crash. Start Docker Desktop, run `npm run dev` again.

After you change `prisma/schema.prisma`, run `npx prisma generate`, then restart `npm run dev`.

## 2. Get test accounts

Pick one.

**A. Sample company (fastest).** Run `npm run demo:seed`. It makes a separate "Sample Company (DEMO-SAMPLE)" with five people, schedules, pay rates and ten days of time stamps (one late, one overtime, one absence). Password for all: `Demo-Pass-12345`.

| Email | Role |
|---|---|
| admin@demo.test | Super Admin |
| hr@demo.test | HR Admin |
| manager@demo.test | Manager (supervises Ella and Ben) |
| emp1@demo.test | Employee (Ella Cruz) |
| emp2@demo.test | Employee (Ben Lopez) |

Remove it any time with `npm run demo:remove`. It never touches your real organizations.

**B. Your own organization.** Open the landing page, register (industry, size, name, your details). You become the Super Admin. Add people yourself from Employees. This is the real first-time experience.

Tip: use two browsers (or one normal plus one private window) so you can be an employee and a manager at the same time.

## 3. Who sees what

| Page | Super Admin | HR Admin | Manager | Employee |
|---|---|---|---|---|
| Home, DTR, Schedule, Leave, Overtime, Notifications, Performance, Learning, Documents, HR Requests, My payslips | yes | yes | yes | yes (own data) |
| Employees | all | all | own team | no (own profile via Home link) |
| Organization, Payroll, Recruitment, Announcements, Reports, Settings, Audit log | yes | yes | no | no |
| Users | yes | no | no | no |

Pages you may not open send you Home with "You do not have permission to open that page."

## 4. Test, module by module

Each row: do this, expect that. Mark what fails and tell me the page and what you saw.

### 4.1 Register and sign in
1. Register a new organization. Expect: you land on Home as Super Admin.
2. Sign out, sign in. Wrong password: "Wrong email or password". Right one: Home.
3. Register with an email already used. Expect: "This email is already registered."

### 4.2 Organization setup (Organization, Settings)
1. Organization: add departments and positions (one-click suggestions for your industry). Expect: they appear in lists.
2. Settings: add or edit shifts, leave types, time stamp buttons, onboarding and offboarding tasks, GPS policy, grace minutes, "ask for password before each stamp".
3. Add a time stamp (for example "Site Visit"). Expect: it appears on every employee's clock.

### 4.3 People (Employees)
1. Add an employee. Tick "Also create a sign-in" and set a temporary password. Expect: employee number assigned, onboarding checklist created.
2. Open the employee. Change department/position/supervisor. Expect: new line in Employment history; old lines stay (history is never overwritten).
3. Set a regular schedule (shift + work days). Expect: warning about no schedule disappears.
4. Change status to Separated with a note. Expect: offboarding checklist appears, their sign-in stops working.
5. Sign in as the new employee. Expect: forced to choose a new password, then Home with "Welcome. N things for you to finish" and a link to their checklist.

### 4.4 Time stamp (Home) and DTR
1. As an employee: choose where you are working (Office, Field work / Client site, Remote), pick **Time In**. If the password prompt is on, enter your password. Allow location when the browser asks. Expect: "Timed in", clock changes, location saved.
2. Deny location. Expect: stamp still works but is flagged "Location denied" (or blocked, depending on the GPS policy in Settings).
3. Take a Break, come back, **Time Out**. Expect: buttons enable only when they make sense (no Time Out before Time In).
4. Open **DTR**. Expect: today's row with in/out, worked time, late/undertime if your schedule says so, overtime as "candidate".
5. Manager and HR can open DTR of people below them. An employee cannot open someone else's DTR by editing the URL.
6. Use the CSV export from DTR. Expect: a file with the same numbers.

### 4.5 Schedule
1. As Manager or HR: open Schedule, pick an employee and a day, assign a shift or mark a day off (override). Expect: DTR for that day uses it.
2. As an employee: Schedule shows only your own.

### 4.6 Leave
1. Employee: Leave, choose type, dates, reason, **Send request**. Expect: "Request sent". Balance shows after approval.
2. Manager (or HR) gets a notification, approves or rejects (reject needs a reason). Expect: employee notified, DTR shows "Leave".
3. You cannot approve your own request (except the Super Admin when no one else can).

### 4.7 Overtime
1. Employee: after a day with extra time, request the overtime. Expect: needs approval.
2. Approver approves. Expect: only approved overtime is paid in payroll.

### 4.8 Payroll (HR / Super Admin)
1. **Pay setup**: add pay items (allowances, deductions), contributions and tax brackets. Nothing is built in: you enter the rates you are required to use. Have a payroll practitioner confirm them.
2. Employee profile: **Save pay rate** (monthly, daily or hourly). Old rates stay in history.
3. **Create pay period**, then **Calculate payroll**. Open a payslip line by line. Expect: every number explained from attendance, leave, overtime and rules.
4. A *different* HR/Super Admin **Approve**s (the person who calculated cannot approve). Then **Finalize and lock**.
5. Try to change a locked payroll. Expect: refused. Corrections go through an adjustment in the next run (**Add adjustment**).
6. Employee: **My payslips** shows only their own, after finalizing.

### 4.8a Philippine payroll rules (SSS, GSIS, PhilHealth, Pag-IBIG, BIR, DOLE)
Read [PH-COMPLIANCE.md](PH-COMPLIANCE.md) first: it says what is covered and what is not. The sample company (`npm run demo:seed`) already runs on these rules.
1. **Pay setup → Philippine rules and wage orders**. Expect "Coverage today" with missing items. Click **Both** under "Install the starter rules". Expect "complete". Click it again: "0 rules added".
2. Pay setup → "Rates come from" → Philippine statutory rules → Save. (It refuses if no rules are installed.)
3. **Holiday calendar** → "Add the holidays fixed by law" for this year (15 holidays). Add the holidays proclaimed this year by hand.
4. Rules page → **Wage orders**: add your region's daily minimum wage from the current wage order.
5. Employee page → **Tax and contributions** → set private or government, wage factor (261, 313, 365), minimum wage earner, ID numbers. Without a profile the payslip warns.
6. Create a monthly pay period and calculate. Open a payslip: SSS or GSIS, PhilHealth, Pag-IBIG and Withholding tax lines each explain themselves; "Tax summary" shows taxable pay. Check against the guide: ₱25,000 a month gives SSS ₱1,250, PhilHealth ₱625, Pag-IBIG ₱200, tax ₱313.80, net ₱22,611.20.
7. Weekly or semi-monthly: the matching withholding table is used and contributions are split over the month (or taken once, see "SSS, GSIS, PhilHealth and Pag-IBIG come off pay").
8. A daily-paid employee who works a regular holiday gets "Holiday premium"; overtime, rest-day and night pay appear as their own lines.
9. Pay item with a special tax treatment: Pay setup → Add pay item → "Philippine tax treatment" (for example Rice subsidy as de minimis). Amounts over the limit are flagged.
10. Create a payroll "13th month pay" (one twelfth of the year's basic pay earned). Tick **Year-end tax adjustment** on the last payroll of the year to settle the year's tax (refund or more tax).
11. Government employees: payroll "Government bonus or incentive" (mid-year, year-end) pays only those with enough service.
12. Approve (a second person) and finalize. Then **Reports**: SSS, GSIS, PhilHealth and Pag-IBIG remittance lists, BIR 1601-C figures, BIR 2316 data per employee, all with CSV download.
13. A new circular: Philippine rules → "Change or add a rule": pick the rule, set "In force from", change only the numbers. The old version ends the day before, so earlier payrolls keep their old rates.
14. **Benefit estimates**: SSS sickness and maternity, GSIS retirement, terminal leave.
15. Statutory leave types: Philippine rules → "Statutory leave types".

### 4.9 Recruitment (HR)
1. Open a job. Add applicants (same email twice is refused). Move: Applied, Screening, Interview, Offer. Add notes, set interview date. Reject one.
2. At Offer: pick supervisor and shift, optionally create sign-in, **Hire and create the employee**. Expect: employee record with department from the job, schedule, onboarding checklist. Job closes when all openings are filled.

### 4.10 Performance
1. HR: **Start the cycle**. Expect: a review for everyone.
2. Employee: rating 1 to 5 plus comment, **Submit my self-assessment**.
3. Manager: sees "Evaluations waiting for you", rates, submits.
4. HR: sets the final rating (manager's is pre-selected).
5. Employee: reads and clicks **I have read my review**.
6. Goals: add a goal, update progress. Managers see their team's goals; other employees never do.

### 4.11 Learning
1. HR: add a course (optional certificate validity in months). Manager: enroll people from their own team. HR: anyone.
2. Mark complete. Expect: "valid until" date. Expired or soon-expiring certificates show up for HR.

### 4.12 Documents
1. Employee: upload an ID (PDF, PNG or JPEG, max size from `.env`). Expect: saved. Upload again with the same title: version 2, version 1 kept as older.
2. Upload a renamed `.exe` as `.pdf`. Expect: refused (content is checked, not the name).
3. Only the owner and HR can open a file. A manager or another employee gets "not found". HR opening someone's file is written to the Audit log.
4. HR sees "Expiring within 60 days".

### 4.13 HR Requests, Announcements, Notifications
1. Employee: HR Requests, pick a topic, send. HR gets a notification, answers (answer required), request leaves the queue; employee sees the answer.
2. HR: Announcements, post (optionally pinned). Everyone sees it on Home and gets a notification. Employees cannot open the posting page.
3. The bell shows the unread count. "Mark all as read" clears it.

### 4.14 Reports (HR)
1. Pick dates. Expect: headcount, by department and status, attendance rate, lateness, overtime, leave taken, payroll cost of finalized periods.
2. **Download CSV** for attendance.

### 4.15 Users and Audit (Super Admin)
1. Users: reset someone's password (they must change it, and are signed out everywhere), deactivate/activate, change role. You cannot change or deactivate yourself; the last active Super Admin is protected.
2. Audit log: shows who did what and when for the actions above.

### 4.16 Phone
1. Run `npm run dev:phone`, open the HTTPS link on a phone. Expect: bottom bar plus a **More** sheet, no sideways scrolling, one-handed clock. Allow location to test real GPS.

## 5. Security spot checks (worth ten minutes)

- Sign in as an employee and type `/payroll`, `/reports`, `/admin/users` in the address bar. Expect: sent Home with a permission message.
- As employee A, open `/dtr?employee=<B's id>`. Expect: you see nothing of B.
- Register a second organization. Expect: it never sees the first one's people, files or numbers.
- Sign in with a wrong password many times. Expect: no hint whether the email exists.

## 6. Run the automated tests

```
npm run typecheck     types
npm run lint          code style
npm test              143 fast unit tests
npx playwright test --workers=1     66 browser tests, about 5 minutes, needs `npm run dev` running
```

The browser tests create their own throwaway organizations and delete them afterwards. Your real data is not touched.

## 7. Known limits (not built yet)

- Email verification and forgot-password by email (an admin resets passwords for now).
- Native mobile app (the web app works on phones).
- Industry-specific modules (for example government plantilla, healthcare credentials). Industries differ in starting data only; the time stamp process is the same for all.
- Real phone GPS is not covered by automated tests. Test it with `dev:phone`.
- Philippine rules are installed from a starter set (version PH-2026.10) that you can see, change and version. They are not a legal guarantee: confirm them with a payroll practitioner before using real pay. See PH-COMPLIANCE.md for everything not covered (claims, alphalist, agency file formats, separation pay, special groups).
- Reports load one DTR per person: fine for hundreds of people, needs precomputing for thousands.
