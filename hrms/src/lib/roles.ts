// Single source of truth for role keys and who may open which page.
// Roles themselves are rows in the Role table; seed.ts inserts these.
export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  HR_ADMIN: "HR_ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
  SUBCONTRACTOR: "SUBCONTRACTOR",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_SEED: { key: RoleKey; name: string }[] = [
  { key: ROLES.SUPER_ADMIN, name: "Super Admin" },
  { key: ROLES.HR_ADMIN, name: "HR Admin" },
  { key: ROLES.MANAGER, name: "Manager" },
  { key: ROLES.EMPLOYEE, name: "Employee" },
  { key: ROLES.SUBCONTRACTOR, name: "Sub Contractor" },
];

const ALL: RoleKey[] = Object.values(ROLES);
const INTERNAL: RoleKey[] = [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE];

// Longest matching prefix wins. Unlisted paths are denied.
export const PAGE_ACCESS: Record<string, RoleKey[]> = {
  "/dashboard": ALL,
  "/change-password": ALL,
  "/employees": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN, ROLES.MANAGER], // managers see their own team only
  "/organization": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN],
  "/schedule": ALL, // employees/subcontractors see their own; managers edit their team
  "/schedule/live": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN, ROLES.MANAGER], // who is in, late, absent right now: downline only for managers
  "/schedule/analytics": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN, ROLES.MANAGER], // adherence and tardiness across the downline
  "/dtr": ALL, // everyone sees what their place in the chain allows
  "/leave": INTERNAL,
  "/overtime": INTERNAL,
  "/notifications": ALL,
  "/payroll": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN], // includes /payroll/setup
  "/payslips": INTERNAL, // own payslips only; HR can open any
  "/settings": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN],
  "/audit": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN],
  "/recruitment": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN],
  "/performance": INTERNAL, // own goals and reviews; managers see their team; HR sees all
  "/learning": INTERNAL,
  "/documents": INTERNAL, // own file only; HR can open any
  "/requests": INTERNAL, // own requests; HR answers all
  "/locate": ALL, // phone confirms the location of a desktop time stamp
  "/id": ALL, // own digital ID; supervisors and HR can open their people's
  "/id/design": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN],
  "/chat": ALL, // messages and calls inside the organization
  "/policies": ALL, // read and e-sign; HR uploads
  "/daily-report": ALL, // own report; managers read their downline, HR reads everyone
  "/cash-advance": ALL, // own requests; HR decides and sees every record
  "/announcements": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN], // posting. Everyone reads them on Home
  "/reports": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN],
  "/analytics": [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN], // all activity in the system
  "/admin/users": [ROLES.SUPER_ADMIN],
};

export function canAccess(role: string, path: string): boolean {
  const match = Object.keys(PAGE_ACCESS)
    .filter((p) => path === p || path.startsWith(p + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return match ? (PAGE_ACCESS[match] as string[]).includes(role) : false;
}
