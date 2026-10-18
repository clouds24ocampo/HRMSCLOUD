# HRMS Testing Guide

How to test the whole system by hand before it goes online. Everything runs on your own computer; nothing is sent anywhere. Pair it with [USER-GUIDE.md](USER-GUIDE.md), which explains each screen.

- App: http://localhost:3300
- Database (Postgres): port 3366, started for you

## 0. How to use this guide

Work through the sections in order. Each step says **Do** and **Expect**. When a step fails, write down: the page address, who you were signed in as, what you did, what you expected and what you saw (a screenshot helps). Tick a step only when you saw the expected result with your own eyes.

Tip: use two browsers (or one normal window and one private window) so you can be an administrator and an employee at the same time. Use a phone for time stamping.

## 1. Start it

| Do | What happens |
|---|---|
| Run `npm run dev` in the `hrms` folder, or double-click `start-hrms.bat` | Starts Docker, the database, applies updates, then the app. Wait for "Ready" |
| Run `npm run dev:phone` | Same, plus an HTTPS link for a phone (real GPS needs HTTPS). Needs `cloudflared` |
| Open http://localhost:3300 | Landing page |

If the database is off you see "Database is not running", not a crash. Start Docker Desktop and run `npm run dev` again. After you change `prisma/schema.prisma`, run `npx prisma generate` and restart.

## 2. Get test accounts

**A. Sample company (fastest, recommended).** Run `npm run demo:seed`. It makes "Sample Company (DEMO-SAMPLE)" with five people, schedules, pay rates, ten days of time stamps (one late, one overtime, one absence) and **two WorkSync projects: a Software board and a Network board** with cards in every state. Password for all: `Demo-Pass-12345`.

| Email | Role |
|---|---|
| admin@demo.test | Super Admin |
| hr@demo.test | HR Admin (Hannah Reyes) |
| manager@demo.test | Manager (Mark Santos, supervises Ella and Ben) |
| emp1@demo.test | Employee (Ella Cruz) |
| emp2@demo.test | Employee (Ben Lopez) |

Remove it with `npm run demo:remove`. It never touches your real company.

**B. Your own company.** See test 3.1. Real data, real first-time experience.

## 3. Who sees what (what the system enforces today)

| Page | Super Admin | HR Admin | Manager | Employee |
|---|---|---|---|---|
| Home, DTR, Schedule, WorkSync, Daily report, Cash advance, Chat, Policies, Notifications | yes | yes | yes | yes (own data) |
| My payslips, HR requests | yes | yes | yes | yes (own data) |
| Employees | all | all | own team | no |
| Leave, Overtime, Performance, Learning | all | all | own team | **no** (see decision below) |
| Documents (201 files) | yes | yes | no | **no** |
| Digital ID pages | yes | yes | own team | no |
| Schedule live and analytics | yes | yes | own team | no |
| Organization, Payroll, Recruitment, Announcements (post), Reports, Activity analytics, Settings, Audit log | yes | yes | no | no |
| Users | yes | no | no | no |

**Decision needed from you:** employees currently cannot open Leave, Overtime, Performance, Learning or Documents. If employees should file their own leave and overtime and upload their own 201 file, tell the developer: it is a one-line change per page. Until then, test those flows as Manager or HR.

Pages you may not open send you Home with "You do not have permission to open that page."

## 4. Test scripts

### 4.1 Company registration (once only)
Use a fresh database or a computer with no company registered.
1. Open the landing page. Expect a **Register your organization** button.
2. Register (industry, size, name, your details, password of 10+ characters). Expect: you land on Home as Super Admin.
3. Sign out and open the landing page and the login page. Expect: **no** "Register" link anywhere.
4. Type `/register` in the address bar. Expect: you are sent to the sign-in page.
5. Sign in with a wrong password. Expect: "Wrong email, username or password" (the same text whether or not the email exists).

### 4.2 Time stamp from the login page
1. Sign out. On the login page open the **Time stamp** tab. Expect: the animated panel is gone on this tab.
2. Enter an employee's ID number and password, choose **Time In**. On a phone allow location. Expect: success message with the time.
3. Enter a wrong password. Expect: "Wrong ID number or password". Do it six times for one ID. Expect: that ID is locked for 15 minutes.
4. Try an employee who still has a temporary password. Expect: refused, told to sign in first.
5. On a computer choose a stamp. Expect: a QR code to confirm location with the phone, or a rough location flagged with a note.
6. Open the employee's DTR as HR. Expect: the stamp is there with source "Kiosk", device and place.

### 4.3 Signed-in time clock, breaks, issues
1. Employee: **Home → Time In**, allow location. Expect: "Timed in" and status "Working".
2. Take a **Break**. Expect: status "On break" with a duration timer.
3. Press the next stamp to resume, then a weather issue (**Heavy rain**), then resume. Expect: the status tag names the issue.
4. **Time Out.** Expect: buttons are only enabled when they make sense.
5. As HR open **Home** (live status). Expect: each person with the right tag and a **Worked:** figure that **excludes breaks and issues** and stops growing while someone is on a break or issue.
6. Deny location on a phone. Expect: refused (phone) or flagged, depending on the setting in Settings → Work rules.
7. Forget to time out (use the demo or wait). Expect: automatic time-out 30 minutes after 8 hours of work, marked "System time-out", with a place to put the reason.

### 4.4 Pay rule: the numbers
1. Make an employee with monthly salary **₱10,000**. Open the profile. Expect: ₱383.3865 a day, ₱47.9233 an hour.
2. Salary **₱25,000**. Expect: ₱958.4664 a day, ₱119.8083 an hour.
3. Employee works 8:00 to 15:00 with no breaks (7 hours) on a ₱10,000 salary. Expect: pay ₱335.4632 for that day.
4. Add a 1-hour break inside the day. Expect: 1 hour fewer is paid (breaks and issues are deducted).
5. Add an **On Trip** period. Expect: it counts as work.
6. Add a weather issue, then work extra on a later day of the **same cut-off**. Expect: the lost time is shown as "Recovered" on that later day.
7. Work past 8 hours without approval. Expect: the extra shows as "not approved" and is not paid.
8. Cut-offs: 1st to 15th is paid on the last day of the month; 16th to the end is paid on the 15th of the next month.

### 4.5 DTR and DTR PDF
1. As an employee open **DTR**. Expect: your days with time in, time out, breaks, issues, hours paid, late, undertime.
2. Press **Download PDF**. Expect: a landscape PDF with a table of days and a **daily wage** column, a TOTAL row, and your name at the top.
3. As HR open **DTR**, press **PDF, everyone**. Expect: one section per person, daily wage and total for each, a grand total, "Page 1 of N" on every page.
4. As a manager press **PDF, everyone**. Expect: your team only, and **no wages** ("Pay is not shown on this copy").
5. As an employee change the address to another person's DTR. Expect: nothing of theirs is shown.
6. **Download CSV.** Expect: the same numbers.

### 4.6 Payslips, payment confirmation, cash advance
1. As an employee open **My payslips**. Expect: a cut-off picker listing only cut-offs where you have time stamps or pay, newest first.
2. A running cut-off shows your pay so far, day by day. A finalized one shows the payslip: gross, deductions, net, with every deduction listed (government contributions marked "not deducted" when the company has that off).
3. HR records the payment on the payslip (amount, method, proof). Expect: the employee sees "Please confirm receipt". The employee confirms or reports a problem.
4. **Cash advance**: the employee requests it. HR approves and chooses the payslip it is deducted on. Expect: the employee's page shows only the amount, date and time and their confirmation. The payslip shows the deduction on the chosen cut-off only.

### 4.7 Daily report and comments
1. Employee: **Daily report**, write what you did, blockers, plan, send. Expect: it cannot be edited. Send a second one: it becomes the one that counts and the first is marked replaced.
2. Manager or HR opens the report and writes a comment. Expect: the employee is notified.
3. The employee replies. Expect: the thread shows both, HR can join, and each is notified.

### 4.8 WorkSync (about 25 minutes)
Use the demo company, or make your own two projects. Sign in as **hr@demo.test** in one browser and **emp1@demo.test** in another.

**A. Start projects**
1. HR: **WorkSync → New project**, name "Test software", kind Software, a color. Expect: you land on its board with seven lists and six labels.
2. Repeat with kind Network. Expect: six lists (Planned … Handed over).
3. In each, **People**: add a member and a viewer. Expect: "<name> added." and they get a notification.

**B. Board**
1. Add a card in a list ("+ Add a card", Enter). Expect: it appears.
2. Open the card. Set priority High, a start and a due date, a label, a checklist of 3 steps, assign a member. Expect: the card on the board shows the label, the due badge, the checklist count and the member's face.
3. Drag the card to another list. Expect: it stays after refresh. Drag it into **Blocked**. Expect: the leads get a notification.
4. Drag a card to **Released / Handed over**. Expect: the project percent goes up and the card is marked finished.
5. Add a list, rename it, change what it counts as, drag its header to reorder. Remove an empty list. Try to remove a list with cards. Expect: refused with a message.

**C. The other views** (same project)
1. **Table:** change status, priority and dates in the cells. Expect: saved at once. Set a start date after the due date. Expect: refused and the old date comes back.
2. **Timeline:** Expect a bar per card between start and due, colored by status, a line for today, cards without dates listed at the bottom.
3. **Calendar:** Expect each card on its due date. Use the arrows and **Today**.
4. **Dashboard:** Expect the status donut, cards per list, workload per person, finished per day, and the blocked, overdue and due-soon lists.
5. Use the search box, person, label and priority filters. Expect: every view narrows, and "Showing N of M cards" with **Clear filters**.

**D. Admin and employee stay in sync**
1. As the employee open the same project. Move a card.
2. As HR watch the board. Expect: the change appears within about 20 seconds without reloading.
3. As HR open **Daily activity**. Expect: the employee's moves listed with times; people who did nothing listed separately.
4. As the employee open **Daily activity**. Expect: only your own actions. Open **My cards**. Expect: only what is assigned to you.

**E. Permissions**
1. Sign in as a person who is **not** on a project. Open **WorkSync**. Expect: the project is not listed. Paste its address. Expect: "not found" and no title, no cards.
2. As a **Viewer**: Expect no "+ Add a card", no drag, no list controls; you can comment.
3. As a **Member**: Expect no "+ Add another list", no ⋯ list menu, no Settings changes.
4. A manager above a member but not on the project: Expect to view and comment only.

### 4.9 Other modules (as Manager or HR, unless noted)
- **Organization, Settings:** add departments, positions, shifts, leave types, time stamp buttons. Expect them to appear for everyone.
- **Employees:** add one (temporary password), change department or supervisor (history keeps the old lines), set a schedule, mark Separated (their sign-in stops). Edit and delete: a person with records cannot be deleted by HR; the Super Admin can delete with records unless a payslip is finalized.
- **Leave:** request, approve (reject needs a reason), balance, DTR shows "Leave".
- **Overtime:** only approved overtime is paid.
- **Payroll:** create a period, calculate, a different administrator approves, finalize and lock, try to change it (refused), add an adjustment. Philippine rules: install the starter rules, holiday calendar, wage order, tax profile; check the remittance and BIR reports. Read [PH-COMPLIANCE.md](PH-COMPLIANCE.md) first.
- **Recruitment, Performance, Learning, Documents:** follow the screens: applicant stages and hire, review cycle (self, manager, HR, acknowledge), course enrollment, 201 uploads (a renamed `.exe` as `.pdf` is refused).
- **Policies:** upload a policy, sign it with the e-signature as an employee, check the banner disappears.
- **Digital ID:** employee profile picture, the ID with its QR code opens the profile for an administrator.
- **Chat:** message and call a colleague (voice and video).
- **HR requests, Announcements, Notifications, Reports (CSV), Users, Audit log:** each does what its page says. The audit log lists pay changes, payroll approval, document opens, project changes.

### 4.10 Phone
Run `npm run dev:phone` and open the HTTPS link. Expect: the bottom bar and **More**, no sideways scrolling, one-handed clock, real GPS on time in, and WorkSync boards that scroll sideways with **Move to** inside the card.

## 5. Security spot checks (ten minutes)

- As an employee type `/payroll`, `/reports`, `/admin/users`, `/analytics`. Expect: sent Home with a permission message.
- As employee A open `/dtr?employee=<B's id>` and `/payslips?employee=<B's id>`. Expect: you see only your own data.
- As an employee not on a WorkSync project, open its address and a card address. Expect: "not found".
- With a wrong password many times (sign in and login-page stamp). Expect: no hint whether the account exists, and a lockout.
- Registration after the first company. Expect: refused everywhere.

## 6. Run the automated tests

```
npm run typecheck                  types
npm run lint                       code style
npm test                           unit tests (about 230)
npx playwright test --workers=4    browser tests, about 5 minutes; it starts its own server (stop `npm run dev` first), or set PW_PORT=3301 and run `next start -p 3301` of the production build
```
The browser tests create their own throwaway companies and delete them afterwards. Your real data is not touched. They start the app with `ALLOW_MULTIPLE_ORGS=true`: that setting is for tests only and must never be set when the system is online.

Known state at the last run (production build): 99 browser tests pass, 4 are marked `fixme` and 0 fail; the phone-size crawl of every page for all four roles finds no sideways scroll and no errors. The four `fixme` tests need employees to open Leave, Documents or Performance (employee leave request and validation, employee leave rejection, employee document upload, employee self-assessment). They come back as soon as the role rule in part 3 changes.

## 7. Before you go online

- [ ] Sections 4.1 to 4.8 pass with the demo company and then with your real company.
- [ ] Payroll numbers confirmed by your payroll practitioner (4.4, 4.9).
- [ ] `DB_PASSWORD` is long and random; `.env` is not shared; `ALLOW_MULTIPLE_ORGS` is not set.
- [ ] Backups: a nightly database dump and a copy of the `storage` folder (uploaded documents and payment proofs), and a restore tried once.
- [ ] HTTPS on your domain (phones need it for GPS). See [DEPLOY.md](DEPLOY.md).
- [ ] You registered the company right after deploying, then checked the registration link is gone.
- [ ] Employees were told what is recorded (time, place, device) and e-signed the privacy policy.

## 8. Known limits (not built yet)

- Email verification and forgot-password by email (an administrator resets passwords).
- A native mobile app (the web app works on phones).
- WorkSync: file attachments, @mentions, sub-items, automations (for example "when blocked, notify"), and importing from Trello.
- Real phone GPS is not covered by automated tests: test it with `dev:phone`.
- Philippine rules are a starter set you can see and change. Confirm them with a payroll practitioner before real payroll.
- Reports load one DTR per person: fine for hundreds of people, needs precomputing for thousands.
