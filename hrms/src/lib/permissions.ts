// Itemized access. Every power in the system is one permission on this list. An account's access =
//   the permissions of its role  +  extra permissions added for that account  -  permissions removed for that account.
// The six built-in roles (Super Admin, HR Admin, Manager, Employee, Sub Contractor, Applicant) have fixed defaults in this file;
// a company can add its own roles in the Roles page and pick the permissions of each.
//
// "Elevated" permissions give authority over other people or over sensitive records (approving, hiring, payroll, settings, deleting).
// They can never be given to an entry-level position. The few self-service permissions (own payslips, own requests) are not elevated.
// Page access and every action check these permissions on the server; hiding a menu item is only cosmetic.
import type { RoleKey } from "@/lib/roles"; // a type only: roles.ts imports this file, so no runtime import back

export type Perm = (typeof PERMISSIONS)[number]["key"];

type P = { key: string; label: string; group: string; help: string; elevated: boolean; locked?: boolean };

// `locked`: cannot be given to a custom role or added to one account. Only the Super Admin role has it, so access control can never be handed on.
export const PERMISSIONS = [
  // ---- People
  { key: "employees.view_all", group: "People", label: "See every employee", help: "Open the employee list and files of everyone in the company. Without it, only the people who report to the account.", elevated: true },
  { key: "employees.add", group: "People", label: "Add employees", help: "Create a new employee record (and their sign-in).", elevated: true },
  { key: "employees.edit", group: "People", label: "Edit employees", help: "Change details, position, department, supervisor, pay setup and status of employees.", elevated: true },
  { key: "employees.deactivate", group: "People", label: "Make employees inactive or active", help: "Turn an employee's sign-in off (separated) or back on. Their history is kept.", elevated: true },
  { key: "employees.delete", group: "People", label: "Delete employees permanently", help: "Remove an employee from the system for good.", elevated: true },
  { key: "checklists.manage", group: "People", label: "Tick onboarding and offboarding items", help: "Complete checklist items for any employee.", elevated: true },
  { key: "documents.view_all", group: "People", label: "Open everyone's 201 file", help: "See the 201 file documents of every employee.", elevated: true },
  { key: "documents.manage", group: "People", label: "Upload and archive 201 documents", help: "Add and remove documents in anyone's 201 file.", elevated: true },
  { key: "contracts.manage", group: "People", label: "Create and issue contracts", help: "Generate, issue, cancel and restore employment contracts.", elevated: true },
  { key: "id.manage", group: "People", label: "Digital ID: print and design", help: "Print ID cards, design the card, change anyone's ID picture.", elevated: true },
  // ---- My team
  { key: "team.manage", group: "My team", label: "Manage my team", help: "See and decide for the people who report to the account: approve leave and overtime, plan schedules, review performance, award incentives, read daily reports.", elevated: true },
  // ---- Time
  { key: "schedule.insights", group: "Time", label: "Live personnel and schedule analytics", help: "Open the live attendance board and the adherence and tardiness analytics.", elevated: true },
  { key: "schedule.plan_all", group: "Time", label: "Plan anyone's schedule", help: "Change the schedule of any employee, not only the team.", elevated: true },
  { key: "schedule.edit_past", group: "Time", label: "Change past schedule days", help: "Edit days that are already over.", elevated: true },
  { key: "dtr.view_all", group: "Time", label: "See everyone's time records", help: "Open the DTR of any employee and export everyone.", elevated: true },
  { key: "dtr.correct", group: "Time", label: "Correct time records", help: "Add a missed punch or void a punch.", elevated: true },
  { key: "leave.approve_all", group: "Time", label: "Approve leave for anyone", help: "Decide leave requests of any employee.", elevated: true },
  { key: "overtime.approve_all", group: "Time", label: "Give final overtime approval", help: "The final HR step on overtime requests.", elevated: true },
  // ---- Pay
  { key: "payroll.view", group: "Pay", label: "Open payroll", help: "See pay periods, pay setup and payroll reports.", elevated: true },
  { key: "payroll.manage", group: "Pay", label: "Calculate, approve and finalize payroll", help: "Run and lock payroll.", elevated: true },
  { key: "payslips.own", group: "Pay", label: "See my own payslips", help: "Self-service: read the account's own payslips.", elevated: false },
  { key: "payslips.view_all", group: "Pay", label: "See everyone's payslips", help: "Open any employee's payslip.", elevated: true },
  { key: "payslips.record_payment", group: "Pay", label: "Record payslip payments", help: "Mark a payslip as paid and attach the proof.", elevated: true },
  { key: "cashadvance.decide", group: "Pay", label: "Decide cash advances", help: "Approve or decline cash advances and their deductions.", elevated: true },
  { key: "incentives.award", group: "Pay", label: "Award incentives", help: "Give incentives to employees and see the records.", elevated: true },
  { key: "requests.own", group: "Pay", label: "Send my own HR requests", help: "Self-service: ask HR for a certificate, a change, a document.", elevated: false },
  // ---- Talent
  { key: "performance.manage", group: "Talent", label: "Run performance cycles", help: "Start review cycles, see all reviews, set the final rating.", elevated: true },
  { key: "learning.manage", group: "Talent", label: "Manage the course catalog", help: "Add and edit courses.", elevated: true },
  { key: "learning.enroll", group: "Talent", label: "Enroll people in training", help: "Enroll employees in courses.", elevated: true },
  // ---- Recruitment
  { key: "recruitment.access", group: "Recruitment", label: "Open Recruitment", help: "See jobs, applicants, exams, results and the pipeline.", elevated: true },
  { key: "recruitment.hire", group: "Recruitment", label: "Hire and delete applicants", help: "Hire an applicant into an employee or subcontractor, or delete an applicant.", elevated: true },
  // ---- Company
  { key: "organization.manage", group: "Company", label: "Organization structure", help: "Departments, positions, branches.", elevated: true },
  { key: "settings.manage", group: "Company", label: "Company settings", help: "Time stamps, GPS rules, schedules and other settings.", elevated: true },
  { key: "announcements.post", group: "Company", label: "Post announcements", help: "Write announcements everyone reads on Home.", elevated: true },
  { key: "policies.manage", group: "Company", label: "Publish company policies", help: "Upload, replace and restore policies that need signatures.", elevated: true },
  { key: "handbook.manage", group: "Company", label: "Edit the company handbook", help: "Edit and install handbook sections.", elevated: true },
  { key: "requests.answer", group: "Company", label: "Answer HR requests", help: "Reply to and close employees' requests.", elevated: true },
  { key: "reports.view", group: "Company", label: "Reports and exports", help: "Open reports and export data.", elevated: true },
  { key: "analytics.view", group: "Company", label: "Activity analytics", help: "See activity across the whole system.", elevated: true },
  { key: "audit.view", group: "Company", label: "Audit log", help: "Read who did what and when.", elevated: true },
  { key: "worksync.start_project", group: "Company", label: "Start WorkSync projects", help: "Create projects and boards.", elevated: true },
  { key: "worksync.manage_all", group: "Company", label: "Manage all WorkSync projects", help: "See and manage every project, whoever its members are.", elevated: true },
  // ---- Administration
  { key: "access.manage", group: "Administration", label: "Manage accounts, roles and access", help: "Create accounts, set roles and itemized access. Only the Super Admin role has this.", elevated: true, locked: true },
] as const satisfies readonly P[];

export const PERMISSION_KEYS: Perm[] = PERMISSIONS.map((p) => p.key);
export const PERMISSION_GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];
const KNOWN = new Set<string>(PERMISSION_KEYS);
export const isPerm = (v: string): v is Perm => KNOWN.has(v);
export const permInfo = (k: string) => PERMISSIONS.find((p) => p.key === k);
export const isElevatedPerm = (k: string) => !!permInfo(k)?.elevated;
export const isLockedPerm = (k: string) => !!(permInfo(k) as P | undefined)?.locked;
// Permissions a custom role or a single account may be given.
export const GRANTABLE: Perm[] = PERMISSIONS.filter((p) => !(p as P).locked).map((p) => p.key);

// ---- built-in role defaults
const TEAM_LEAD_DEFAULTS: Perm[] = ["team.manage", "schedule.insights", "incentives.award", "learning.enroll", "worksync.start_project", "payslips.own", "requests.own"];

export const ROLE_DEFAULTS: Record<RoleKey, Perm[]> = {
  SUPER_ADMIN: PERMISSION_KEYS, // everything, always
  HR_ADMIN: PERMISSION_KEYS.filter((k) => k !== "access.manage"),
  MANAGER: TEAM_LEAD_DEFAULTS,
  EMPLOYEE: ["payslips.own", "requests.own"],
  SUBCONTRACTOR: [],
  APPLICANT: [],
};
export const isBuiltInRole = (key: string): key is RoleKey => key in ROLE_DEFAULTS;

// Who can edit what: the Super Admin role is fixed (always everything), as is the applicant role.
export const FIXED_ROLES: string[] = ["SUPER_ADMIN", "APPLICANT"];

export type RoleLike = { key: string; permissions?: readonly string[] | null };
// The permissions a role gives: built-in roles from the defaults above, custom roles from what was chosen for them.
export function rolePerms(role: RoleLike): Perm[] {
  if (isBuiltInRole(role.key)) return ROLE_DEFAULTS[role.key];
  return (role.permissions ?? []).filter((p): p is Perm => isPerm(p) && GRANTABLE.includes(p as Perm));
}

// Role + extra - removed. The Super Admin role cannot lose anything.
export function effectivePerms(role: RoleLike, grants: readonly string[] = [], revokes: readonly string[] = []): Set<Perm> {
  const set = new Set<Perm>(rolePerms(role));
  if (role.key === "SUPER_ADMIN" || role.key === "APPLICANT") return set;
  for (const g of grants) if (isPerm(g) && GRANTABLE.includes(g as Perm)) set.add(g as Perm);
  for (const r of revokes) if (isPerm(r)) set.delete(r);
  return set;
}

// What the code asks. `me` is the signed-in user as loaded by the session.
export type HasPerms = { perms: ReadonlySet<string> };
export const can = (me: HasPerms, perm: Perm) => me.perms.has(perm);
export const canAny = (me: HasPerms, ...perms: Perm[]) => perms.some((p) => me.perms.has(p));

// ---- pages
// Longest matching prefix wins. Unlisted paths are denied. "BASE" = any signed-in staff account (every role but the applicant).
export const PAGE_PERMS: Record<string, "BASE" | "APPLICANT" | Perm[]> = {
  "/dashboard": "BASE",
  "/change-password": "BASE",
  "/employees": ["employees.view_all", "team.manage"],
  "/organization": ["organization.manage"],
  "/schedule": "BASE",
  "/schedule/live": ["schedule.insights"],
  "/schedule/analytics": ["schedule.insights"],
  "/dtr": "BASE",
  "/leave": ["team.manage", "leave.approve_all"],
  "/overtime": ["team.manage", "overtime.approve_all"],
  "/worksync": "BASE",
  "/notifications": "BASE",
  "/payroll": ["payroll.view"],
  "/payslips": ["payslips.own", "payslips.view_all"],
  "/settings": ["settings.manage"],
  "/audit": ["audit.view"],
  "/recruitment": ["recruitment.access"],
  "/performance": ["performance.manage", "team.manage"],
  "/learning": ["learning.manage", "team.manage"],
  "/documents": ["documents.view_all", "documents.manage"],
  "/requests": ["requests.own", "requests.answer"],
  "/locate": "BASE",
  "/id": ["id.manage", "team.manage"],
  "/profile": "BASE",
  "/id/design": ["id.manage"],
  "/chat": "BASE",
  "/policies": "BASE",
  "/handbook": "BASE",
  "/contracts": "BASE",
  "/daily-report": "BASE",
  "/cash-advance": "BASE",
  "/incentives": "BASE",
  "/announcements": ["announcements.post"],
  "/reports": ["reports.view"],
  "/analytics": ["analytics.view"],
  "/admin/users": ["access.manage"],
  "/admin/roles": ["access.manage"],
  "/apply": "APPLICANT",
};

export function canAccessPath(roleKey: string, perms: ReadonlySet<string>, path: string): boolean {
  const match = Object.keys(PAGE_PERMS).filter((p) => path === p || path.startsWith(p + "/")).sort((a, b) => b.length - a.length)[0];
  if (!match) return false;
  const rule = PAGE_PERMS[match];
  if (rule === "APPLICANT") return roleKey === "APPLICANT";
  if (roleKey === "APPLICANT") return path === "/change-password"; // an applicant with a temporary password must be able to choose their own
  if (rule === "BASE") return true;
  return rule.some((p) => perms.has(p));
}

// ---- entry level
export type Level = "ENTRY" | "TEAM_LEAD" | "MANAGER" | "ASSISTANT_HEAD" | "DEPT_HEAD" | "EXECUTIVE";
export const hasElevated = (perms: Iterable<string>) => [...perms].some(isElevatedPerm);
// Entry-level positions get no elevated access. An account with no position (for example the owner or an admin) is not restricted.
export function entryLevelProblem(level: Level | null | undefined, perms: Iterable<string>): string | null {
  if (level !== "ENTRY") return null;
  const bad = [...perms].filter(isElevatedPerm).map((k) => permInfo(k)?.label ?? k);
  return bad.length ? `This person holds an entry-level position, and entry-level positions cannot be given manager or higher access. Remove: ${bad.slice(0, 4).join(", ")}${bad.length > 4 ? ` and ${bad.length - 4} more` : ""}.` : null;
}

// ---- the role a position usually gets
export const LEVEL_ROLE_NAME: Record<Level, string> = {
  ENTRY: "Employee", TEAM_LEAD: "Team Leader", MANAGER: "Manager", ASSISTANT_HEAD: "Assistant Department Head", DEPT_HEAD: "Department Head", EXECUTIVE: "Executive",
};
// Picks from the roles that exist: a company role named like the level's usual role wins, else the built-in one that fits.
export function suggestRole<R extends { key: string; name: string }>(level: Level | null | undefined, roles: R[]): R | null {
  if (!level) return null;
  const byName = roles.find((r) => !isBuiltInRole(r.key) && r.name.trim().toLowerCase() === LEVEL_ROLE_NAME[level].toLowerCase());
  if (byName) return byName;
  const fallback: RoleKey = level === "ENTRY" ? "EMPLOYEE" : "MANAGER";
  return roles.find((r) => r.key === fallback) ?? null;
}

// ---- ready-made company roles, installed on request. Companies edit them freely.
export const ROLE_TEMPLATES: { name: string; description: string; perms: Perm[] }[] = [
  { name: "Team Leader", description: "Leads a small team: approves their leave and overtime, plans their schedule, sees live attendance.", perms: [...TEAM_LEAD_DEFAULTS] },
  { name: "Assistant Department Head", description: "Supports a department head. Like a manager, plus the department's reports.", perms: [...TEAM_LEAD_DEFAULTS, "reports.view", "performance.manage"] },
  { name: "Department Head", description: "Runs a department: team approvals, schedules, performance, learning, reports and the department's people.", perms: [...TEAM_LEAD_DEFAULTS, "employees.view_all", "schedule.plan_all", "reports.view", "performance.manage", "learning.manage", "dtr.view_all"] },
  { name: "Executive", description: "Senior leadership: sees the whole company and its reports; does not run HR operations.", perms: [...TEAM_LEAD_DEFAULTS, "employees.view_all", "dtr.view_all", "reports.view", "analytics.view", "performance.manage", "payroll.view", "recruitment.access"] },
  { name: "Payroll Officer", description: "Runs payroll and payslips; sees cash advances and the time records payroll needs.", perms: ["payroll.view", "payroll.manage", "payslips.own", "payslips.view_all", "payslips.record_payment", "cashadvance.decide", "dtr.view_all", "employees.view_all", "reports.view", "requests.own"] },
  { name: "Recruiter", description: "Runs hiring: jobs, applicants, exams and the pipeline; can hire.", perms: ["recruitment.access", "recruitment.hire", "employees.view_all", "documents.view_all", "payslips.own", "requests.own"] },
  { name: "Timekeeper", description: "Keeps time records right: sees everyone's DTR and schedule, corrects punches.", perms: ["dtr.view_all", "dtr.correct", "schedule.insights", "schedule.plan_all", "employees.view_all", "payslips.own", "requests.own"] },
  { name: "HR Assistant", description: "Helps HR with people records without payroll, hiring or deleting.", perms: ["employees.view_all", "employees.add", "employees.edit", "checklists.manage", "documents.view_all", "documents.manage", "requests.answer", "policies.manage", "payslips.own", "requests.own"] },
];
