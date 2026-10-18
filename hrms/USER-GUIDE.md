# HRMS User Guide

How to use the system, step by step. Written for the company owner, HR, managers and employees. Find your role first, then read that part.

| You are | Read |
|---|---|
| Owner / Super Admin / HR | Parts 1, 2, 5, 6, 7 |
| Manager or department head | Parts 1, 3, 6, 7 |
| Employee or sub-contractor | Parts 1, 4, 6, 7 |

Open the system at your company address (on your own computer: http://localhost:3300). It works on phones. Time stamping is meant to be done on a phone.

---

## Part 1. The basics

### Signing in
1. Open the address, press **Sign in**, enter your email (or username) and password.
2. If an administrator gave you a **temporary password**, the system asks you to choose your own password first. Nothing else opens until you do.
3. Use the eye icon to see what you typed. Use **Change password** at the top any time.

### The menu
The menu on the left (on a phone: the bottom bar and **More**) shows only the pages your role may open. If you type the address of a page you may not open, you are sent Home with a message.

| Group | Pages |
|---|---|
| Home | Everyone's starting page: the time clock, live status, your tasks |
| People | Employees, Organization, Recruitment, Documents, Policies, Digital ID |
| Time | Schedule, DTR, Overtime, Leave, Daily report |
| Work | **WorkSync** (projects and tasks) |
| Pay | Payroll, My payslips, Cash advance |
| Talent | Performance, Learning |
| Support | Chat, HR requests, Announcements, Reports, Activity analytics |
| Manage | Settings, Users, Audit log |

The 🔔 bell shows unread notifications. The 💬 icon opens Chat.

### Time stamping without signing in (login page)
Anyone can stamp from the login page, even when not signed in:
1. On the login page open the **Time stamp** tab.
2. Type your **ID number** and **password**, then choose the stamp (Time In, Break, Time Out, and so on).
3. On a phone, allow location when asked. A phone without location is refused. On a computer there is no GPS: scan the QR code with your phone to confirm where you are, or the system records a rough location and flags it with a note.

Five wrong passwords for the same ID lock that ID for 15 minutes. Accounts that still have a temporary password cannot stamp here: sign in once and choose a new password first.

### What the system records, and why
Every time stamp stores the time (set by the server, not your device), where you were, the device and the way you stamped. Employees see their own records. A manager sees the people below them. HR sees everyone. Pay information is visible only to HR and to the person it belongs to.

---

## Part 2. Owner and HR: first-time setup

Do these in order. Each step takes a few minutes.

### Step 1. Register the company (once)
1. Open the landing page and press **Register your organization**.
2. Choose the industry and size, enter the company name, your name, email and a password of at least 10 characters.
3. You become the **Super Admin**.

Registration closes after the first company. The "Register" links disappear and `/register` sends visitors to the sign-in page. One installation serves one company.

### Step 2. Organization and Settings
- **Organization:** add departments and positions (the system suggests common ones). Set each department head and their assistants. Positions such as "Head Field / Network Engineer" or "Field Network Technician" can be added by hand. The chart shows heads and their downline.
- **Settings → Work rules:** grace minutes for lateness, what happens when someone stamps without a location, whether to ask for the password before each stamp.
- **Settings → Time stamps:** the buttons employees see. Breaks and issue types (weather, calamity, power outage, system issue, clinic) live here. Add your own, for example "Site visit".
- **Settings → Shifts:** your regular shifts. A shift also has a meal break (60 minutes, once per schedule).
- **Settings → Leave types** and **Onboarding and offboarding checklists.**

### Step 3. Add your people
1. **Employees → Add employee.** Enter name, department, position, supervisor, hire date and the **monthly salary**.
2. Tick the option to create a sign-in, then set a temporary password. Give the employee their email (or username) and that password.
3. The system works out the rates for you: daily = monthly × 12 ÷ 313, hourly = daily ÷ 8.
4. Open the employee to set their **regular schedule** (shift and work days) or make it **flexible** (at least 8 hours a day, one day off a week).
5. Employees upload their own 201 file under **Documents**. The 201 requirements are mandatory for employees; the PDF upload is optional for admins.

Editing or deleting an employee is on their profile. Someone with time or pay records cannot simply be deleted. The Super Admin can delete them with their records, but never when a finalized payslip exists.

### Step 4. Policies and Digital ID
- **Policies:** upload the User Agreement, Terms and Conditions and Privacy policy. Every employee must read and e-sign. A banner reminds them until they do.
- **Digital ID:** design the card under **ID design**. Each employee has a profile picture and an ID with a QR code that opens their profile for an administrator.

### Step 5. Pay setup
**Payroll → Pay setup** holds pay items, contributions and tax settings. For the Philippines also open **Philippine rules** and install the starter rules, then add the holiday calendar. Have a payroll practitioner confirm every rate before real use (see PH-COMPLIANCE.md).

---

## Part 3. Managers and department heads

- **Employees** shows your team (and everyone below them). Open a person to see their DTR, schedule, daily reports and performance.
- **Schedule → Live** shows who is in, late, absent or on a break right now. **Schedule analytics** shows tardiness and adherence across your team.
- **Overtime:** approve overtime for your team. Overtime is paid only after the department head and then HR approve it.
- **Leave:** approve or reject (a reason is needed to reject).
- **Daily report:** read your team's reports and comment on them. Employees can reply.
- **WorkSync:** start projects, add your people, track progress (Part 6).

---

## Part 4. Employees and sub-contractors

### Your day
1. **Home → Time In** (on a phone). Choose where you work (office, field, remote) if asked. Allow location.
2. Use **Break** or an issue button (such as **Heavy rain**, **Power outage**) when your work stops. Press **Back to work** or the next stamp when you resume.
3. **Time Out** when you finish. If you forget, the system times you out automatically 30 minutes after 8 hours of work and marks it "System time-out". Put a reason if you did not log out.
4. Your **Home** shows your status, the time you have worked so far (breaks and issues are not counted) and your tasks.

### Your DTR, schedule and pay
- **DTR:** today's and past days: time in, time out, breaks, issues, hours paid, late, undertime. **Download PDF** gives your own DTR with the daily wage and total. **Download CSV** gives the numbers for a spreadsheet.
- **Schedule:** your own schedule.
- **My payslips:** pick a cut-off. Only cut-offs where you have time stamps are listed. A running cut-off shows your pay so far, day by day. A finalized one shows the payslip line by line, including deductions and the government contributions.
- **Confirm your pay:** when HR records that you were paid, open the payslip and confirm receipt, or report a problem. HR attaches the proof of payment.
- **Cash advance:** request one with the amount and reason. HR decides when it is deducted and which payslip shows the deduction. You see the amount, date and time, and your confirmation.

### Daily report
**Daily report** is where you write what you did, your blockers and your plan for tomorrow. A sent report cannot be edited: send a new one if something changed. Your supervisor and HR can comment, and you can reply.

### Other pages for you
Policies (read and e-sign), Documents (your 201 file), Digital ID, Chat (messages, voice and video calls inside the company), HR requests (certificates, concerns), Announcements on Home.

---

## Part 5. HR and Super Admin: the routine

### Every day
- **Home:** the live status of everyone (Working, On break, On a weather issue, On trip, Late, On leave) with the correct tag. The Worked time on each card excludes breaks and issues.
- **Activity analytics:** a dashboard of everything happening in the system.
- **Schedule → Live** and **Reports** for attendance questions.

### Every cut-off (twice a month)
Cut-offs are automatic: the 1st to the 15th is paid on the last day of the month, and the 16th to the end of the month is paid on the 15th of the next month.
1. **Payroll → Standing pay:** see every employee and their tagged time stamps for the cut-off. Download **DTR report with daily wages (PDF)** for everyone: one section per person with daily wage and a total, and a grand total at the end.
2. Check overtime was approved. Approved overtime only is paid.
3. **Create the pay period → Calculate.** Open any payslip: every number is explained down to the time stamps behind it.
4. A **different** administrator approves. Then **Finalize and lock.** A finalized payroll cannot be changed silently: corrections are made as adjustments in the next run.
5. Record the payment on each payslip (amount, method, proof). The employee confirms receipt.
6. **Cash advance:** approve, and choose the payslip it is deducted on.
7. **Reports:** remittance lists and BIR data, with CSV download.

### The pay rule in one paragraph
Only time worked and time **On Trip** count toward the 8 hours. Breaks and issues are deducted, whatever their "paid" setting says. Lost issue time (weather or calamity, for example) can be **recovered** on later days of the same cut-off. Overtime counts only when approved.

Example: monthly salary ₱10,000 gives ₱383.3865 a day and ₱47.9233 an hour. Seven hours worked pays ₱335.4632. ₱25,000 a month gives ₱958.4664 a day and ₱119.8083 an hour.

### People and access
- **Users** (Super Admin): reset a password (the person is signed out everywhere and must choose a new one), deactivate, change role. You cannot change your own role. The last active Super Admin is protected.
- **Audit log:** who did what and when for important actions, such as pay changes, payroll approval, document views, project changes.

---

## Part 6. WorkSync: projects and daily progress

WorkSync tracks every project and every task, for software and for network work, the way Trello and monday.com do. Admin and employees look at the same board. What each person can change depends on their role in the project.

### The idea
- A **project** has a **board** made of **lists** (columns). A list is a status, such as In development or Testing.
- A **card** is one piece of work. Move it from list to list as it progresses.
- Each list **counts as** To do, In progress, Blocked or Done. All the percentages use that, so every project is measured the same way.
- Percent complete = the average of all cards. A finished card counts 100%. Any other card counts the share of its checklist that is ticked.

### Roles in a project
| Role | Can |
|---|---|
| **Lead** | Everything: people, lists, labels, settings, archive. Also HR and Super Admin. |
| **Member** | Create, edit and move cards, assign people, comment. |
| **Viewer** | Read and comment only. |
A manager who is above a member in the chain can look and comment without being on the project.

### Set up your two projects
1. **WorkSync → New project.** Name it for your software work (for example "Customer portal v2"), choose kind **Software**, pick a color, set a target date, **Create project.**
2. Repeat for the network work (for example "Branch fibre rollout") with kind **Network**.
   - Software starts with: Backlog, To do, In development, Code review, Testing / QA, Blocked, Released.
   - Network starts with: Planned, Site survey / design, Installation / configuration, Testing, Blocked, Handed over.
   - Each comes with ready labels (Bug, Feature, Outage, Installation …).
3. Open a project and press **People** (top right). Add each person and choose their role. Put the software team on the software project and the network team on the network project.

### Work the board
- **Add a card:** type in "+ Add a card" at the bottom of a list and press Enter.
- **Open a card** by clicking it. A window opens (Esc closes it). Set the title, description, priority, **Start** and **Due** dates. Tick checklist steps. Assign people in **Members**. Put **Labels**. Write updates in **Comments**.
- **Move a card** by dragging it to another list or position. On a phone, open the card and use **Move to**.
- **Lists** (Leads and HR): **+ Add another list**, the ⋯ menu on a list to rename it or change what it counts as, drag a list header to reorder, **Remove this list** when it is empty.
- **Labels** and **Settings** (name, description, target date, board color, archive) are in the menu at the top right.

### Five ways to look at the same work
| View | Use it to |
|---|---|
| **Board** | Run the day: drag cards through the stages |
| **Table** | Edit fast: status, priority and dates change in place, grouped by list, with a summary per group |
| **Timeline** | See the schedule: a bar for every card from start to due date, with a line for today |
| **Calendar** | See what is due each day of the month |
| **Dashboard** | Report: status, cards per list, workload per person, finished per day, blocked, overdue, stuck and due-soon cards |

**Search and filters** sit above every view: text, person (Everyone, Only mine, Unassigned), label, priority. They apply to all views.

### Tracking progress every day
- **WorkSync → Daily activity** lists what each person did on the boards that day (cards added, moved, finished, blocked, commented). Pick any day. Managers and HR see everyone in their projects; an employee sees their own. People with no board activity are listed as a prompt to follow up: they may have been on leave or in the field. It is information, not a score.
- **WorkSync → My cards** lists everything assigned to you across all projects, with due dates.
- Notifications tell you when you are assigned a card, added to a project, or when a card you are on is blocked, finished or commented on.

### Good habits
1. Break a card into checklist steps: progress becomes accurate.
2. Give every card a due date. Overdue cards turn red.
3. Move a card to **Blocked** the moment you are stuck, and comment why. Leads are notified.
4. Finish the day by moving your cards to their true stage.

> 📖 For a detailed walk-through with screenshots, roles, and FAQs, see [WORKSYNC-GUIDE.md](WORKSYNC-GUIDE.md).

---

## Part 7. If something looks wrong

| Problem | Do this |
|---|---|
| "Database is not running" page | On the server computer start Docker Desktop and run the start script again |
| A page sends me Home | Your role cannot open it. Ask HR if you should have access |
| I cannot stamp from the login page | Wrong ID or password five times locks the ID for 15 minutes. Still on a temporary password: sign in once and choose a new one |
| The stamp says location is missing | On a phone, allow location for the site. On a computer, scan the QR with your phone |
| My hours look short | Breaks and issues are deducted by company rule. Check the DTR for each one, and for recovered time on later days |
| A card will not move | You may be a Viewer on that project, or the project is archived. Ask a Lead |
| I cannot remove a list | A list with cards cannot be removed: move or archive its cards first |
| A project I expect is missing | You are not on it. Ask a Lead or HR to add you |
