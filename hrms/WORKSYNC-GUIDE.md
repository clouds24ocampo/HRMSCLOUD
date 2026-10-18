# 📋 WorkSync Complete User & Administrator Guide

**WorkSync** is the built-in collaborative project and task management system within the HRMS. It functions similarly to Trello and Jira, connecting high-level organizational goals to daily employee tasks with real-time audit trails, accountability, and progress analytics.

---

## 📑 Table of Contents
1. [Core Terminology](#1-core-terminology)
2. [WorkSync Navigation Hubs](#2-worksync-navigation-hubs)
3. [The 5 Project Board Views](#3-the-5-project-board-views)
4. [Step-by-Step Workflows](#4-step-by-step-workflows)
   - [How to Create a New Project](#how-to-create-a-new-project-hr--managers)
   - [How to Create a Task (Card)](#how-to-create-a-task-card)
   - [How to Assign Tasks to Yourself or Team Members](#how-to-assign-tasks-to-yourself-or-team-members)
   - [How to Break Down Work with Checklists](#how-to-break-down-work-with-checklists)
   - [How to Flag Blocked Tasks](#how-to-flag-blocked-tasks)
   - [How to Mark Work as Done](#how-to-mark-work-as-done)
5. [Permissions & Roles](#5-permissions--roles)
6. [Daily Work Routine & Best Practices](#6-daily-work-routine--best-practices)
7. [Reporting & Analytics](#7-reporting--analytics)
8. [Troubleshooting & FAQs](#8-troubleshooting--faqs)

---

## 1. Core Terminology

| Concept | Meaning & Function |
|---|---|
| **Project** | A shared board dedicated to an initiative, operational objective, or team goal (e.g. *Website Redesign*, *Annual Tax Filing*, *Internal Audit*). |
| **Card (Task)** | The individual unit of work. Contains description, checklist, assignees, dates, priority, labels, comments, and resolution audit records. |
| **List (Stage)** | A workflow column representing the state of progress. Default stages are: `To do`, `Doing`, `Blocked`, and `Done`. |
| **Assignee (Member)** | The specific team member(s) responsible for completing the task. Assigned tasks appear in their personal queue. |
| **Checklist** | Sub-tasks within a card. Checking items off automatically recalculates the task's completion percentage (e.g., 2 of 4 items done = 50%). |
| **Labels** | Color-coded badges to classify tasks by category (e.g. `Bug`, `Feature`, `Compliance`, `Urgent`). |

---

## 2. WorkSync Navigation Hubs

When accessing WorkSync (`/worksync`), the top navigation bar gives you access to three main areas plus dedicated analytics:

```
[ Projects ]   [ My tasks ]   [ Daily activity ]   [ 📊 Reports & Analytics → ]
```

### 1. Projects Hub
- Displays all active projects your account has permission to view.
- Top-level stat indicators summarize:
  - **Total Projects** active.
  - **Blocked cards** requiring attention or supervisor intervention.
  - **Overdue cards** past their due dates.
  - **Stuck cards** that have had no status changes or updates for 3+ consecutive days.
- Each project tile shows its title, kind, due date, overall progress bar, card counts per stage, and member avatars.

### 2. My Tasks Hub (`/worksync?view=mine`)
- Your **personal action dashboard**.
- Aggregates every card across all company projects where **you are assigned as a member**.
- Organized into two simple sections:
  - **To finish**: Open tasks requiring your attention, sorted by due date and priority.
  - **Finished**: Archive of tasks you successfully resolved.
> **Note**: If your "My tasks" tab displays *"No tasks assigned to you"*, it means no cards have been assigned to your employee account yet. Once you or a project lead assign a task to you, it will appear here immediately.

### 3. Daily Activity Hub (`/worksync?view=today`)
- An auditable, timestamped log of team actions taken on boards for any selected calendar date.
- Records deliberate actions: cards created, cards moved between columns, checklists checked, cards marked blocked, comments posted, and cards finished.
- Project leads and HR see team activity; individual contributors see their own actions.

### 4. Reports & Analytics Hub (`/reports?tab=worksync`)
- Enterprise oversight tracking project completion velocity, task throughput, top contributors, overdue tasks, and CSV data export for management reporting.

---

## 3. The 5 Project Board Views

Inside any project board (`/worksync/[projectId]`), you can switch between 5 interchangeable perspectives using the top view bar:

### 1. 📌 Board View (Kanban)
- The traditional visual board with draggable columns (`To do`, `In progress`, `Blocked`, `Done`).
- Drag-and-drop cards between lists as work progresses.
- Add new tasks directly to any column by clicking **"+ Add card"** at the bottom of the list.

### 2. 📊 Table View (Spreadsheet)
- Grid layout designed for rapid mass updates.
- Grouped by list category.
- Allows editing task titles, assignees, lists, priorities, and due dates in-place without opening each card individually.

### 3. 📅 Calendar View
- Monthly calendar plotting each task on its designated start or due date.
- Click on any day to add a new card with that date prefilled.
- Click directly on any card to view its details or reschedule by dragging.

### 4. ⏱️ Timeline View (Gantt)
- Horizontal Gantt-style schedule displaying bars spanning each task's `Start Date` → `Due Date`.
- Displays a vertical marker for "Today" so you can visually assess if milestones are on schedule.

### 5. 📈 Dashboard View
- High-level project health summary:
  - Overall project completion percentage.
  - Distribution breakdown (`To do`, `In progress`, `Blocked`, `Done`).
  - Workload balance across project members.
  - Daily completion velocity chart.
  - Alert banners for blocked, stuck, or overdue items.

---

## 4. Step-by-Step Workflows

### How to Create a New Project (HR & Managers)
1. Go to **WorkSync → Projects**.
2. Click the **"+ New project"** button in the top right.
3. Enter:
   - **Project Name** (e.g. *Q4 Inventory Count*).
   - **Kind**: Select from *Client work*, *Internal project*, *Milestone / Goal*, or *Continuous work*.
   - **Target Due Date** (optional).
   - **Theme Color**: Visual gradient applied to the project header.
   - **Template**: Choose default list structures (e.g. *To do / Doing / Done*, *Sprint Backlog*, etc.).
4. Click **Create project**.
5. Once created, open the project, click the **three dots menu (`...`)** at the top right, and choose **Members** to invite team members and set their roles (*Lead*, *Member*, or *Viewer*).

---

### How to Create a Task (Card)
1. Open any project board.
2. In the **Board** view, go to the column where the task begins (usually **To do**).
3. Click **"+ Add card"** at the bottom of the column.
4. Type the task title and press **Enter** (or click *Add*).

---

### How to Assign Tasks to Yourself or Team Members
1. Click on the card to open its detail modal.
2. Look at the **right-hand sidebar** under the **Members** section.
3. You will see a list of everyone who has access to the project.
4. **Click on the person's name** (or your own name).
5. A checkmark (`✓`) will appear next to the name, confirming they are assigned.
6. The person's avatar will now display on the card face, and the card will immediately show in their personal **"My tasks"** hub.

---

### How to Break Down Work with Checklists
1. Open the card detail modal.
2. In the main column, find the **Checklist** section.
3. Enter a step (e.g. *Collect receipts*) and click **Add step**.
4. Repeat for all required sub-tasks (e.g. *Verify totals*, *Manager sign-off*).
5. As team members click the checkboxes (`☐` → `☑`), the card's progress bar automatically updates.

---

### How to Flag Blocked Tasks
If a task cannot proceed because you are waiting on a dependency, client response, supervisor approval, or missing materials:
1. Open the card or drag it to the **Blocked** column.
2. In the card modal under **Comments and activity**, leave a brief comment explaining the roadblock (e.g. *"Waiting for supplier price quotation before proceeding"*).
3. Moving a card to **Blocked** immediately highlights it in red/amber on the board, notifies project leads, and increments the company blocked task counter.

---

### How to Mark Work as Done
1. Complete all checklist items on the card.
2. Move the card to the **Done** column (either by dragging or selecting *Move* in the card details).
3. The system automatically records:
   - The user who resolved the card (`completedById`).
   - The exact timestamp of resolution (`completedAt`).
   - The total turnaround time (*Time to resolve*).

---

### How to Award an Incentive for Outstanding Task Delivery 🎁
When an employee delivers exceptional work on a task or project milestone:
1. Open the card detail modal.
2. In the right-hand sidebar under **Award Incentive 🎁**, click **"Award bonus to member…"**.
3. Select the recipient team member (prefills with the card's assigned worker).
4. Enter the incentive title, monetary amount in PHP (e.g. ₱5,000.00), and citation reason.
5. Click **"Award Incentive 🎁"**.
6. **Audit & Acceptance Flow**:
   - The action is posted to the card's activity feed and the organization audit trail.
   - The recipient is instantly notified and sees a recognition banner on their Home dashboard.
   - Once the recipient clicks **"Accept Incentive"**, the bonus is automatically queued as an approved earning in their next semi-monthly payslip.

---

## 5. Permissions & Roles

Within any WorkSync project, members have one of three permission levels:

| Role | Permissions |
|---|---|
| **Lead** | Full control: Can edit project settings, add or remove members, change member roles, delete or archive the project, and edit all cards. |
| **Member** | Contributor: Can create cards, edit cards they are working on, check off checklists, add comments, move cards, and assign members. |
| **Viewer** | Read-only: Can view the board, search, filter, and review progress, but cannot move, edit, or create cards. |

*Note: Organization Administrators and HR Managers always possess Lead-level administrative authority across company projects.*

---

## 6. Daily Work Routine & Best Practices

To get the most out of WorkSync, follow this 4-step daily rhythm:

```
Morning Check-in          Focus Work               Roadblock Alert          End-of-Day Closeout
 1. Check "My tasks"  →  2. Move to "Doing"   →   3. Mark "Blocked"   →   4. Check off & "Done"
```

1. **Morning Check-in**:
   - Open **WorkSync → My tasks** to see your priority list and any approaching deadlines for the day.
2. **Work in Progress**:
   - When starting work on a task, move it from *To do* to *Doing* so teammates know it is actively being handled.
3. **Communicate Roadblocks**:
   - Never let a task sit silently in *Doing* if you are waiting on someone else. Move it to *Blocked* with an explanatory comment.
4. **End-of-Day Closeout**:
   - Before logging out in your DTR, check off completed checklist items and drag finished tasks to *Done*.

---

## 7. Reporting & Analytics

Management and Team Leads can review performance metrics under **Reports → WorkSync Tasks** (`/reports?tab=worksync`):
- **Overall Completion Rate**: Percentage of company tasks successfully delivered.
- **Tasks by Status**: Breakdown across To Do, In Progress, Blocked, and Done.
- **Top Contributors**: Leaderboard showing members with the most completed cards and checklist actions.
- **Export to CSV**: Download raw task data with full audit timestamps for external reporting.

---

## 8. Troubleshooting & FAQs

### Q: Why do I see "No tasks assigned to you" on the My tasks tab?
**A:** This tab only shows cards specifically assigned to your employee account. If it is empty, you currently have no assigned tasks. Open **WorkSync → Projects**, open any project you belong to, and assign cards to your name under the **Members** section.

### Q: Why can't I edit cards or move them?
**A:** You may be set as a **Viewer** on that project, or the project may be archived. Contact the Project Lead or HR to upgrade your access to **Member**.

### Q: Why don't I see a project my coworker is talking about?
**A:** Projects are visible only to invited members (plus HR/Management). Ask the Project Lead to add your name to the project's member list.

### Q: How do I delete or archive an old project?
**A:** If you are a Project Lead or HR, open the project, click the three dots (`...`) in the upper-right corner, select **Settings**, and click **Archive project**.
