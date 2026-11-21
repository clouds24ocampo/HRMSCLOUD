// Role keys. Who may open which page and do which action is itemized in src/lib/permissions.ts.
// Roles themselves are rows in the Role table; seed.ts inserts these.
export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  HR_ADMIN: "HR_ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
  SUBCONTRACTOR: "SUBCONTRACTOR",
  APPLICANT: "APPLICANT", // job applicant: sees only the careers portal (/apply), never the workspace
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_SEED: { key: RoleKey; name: string }[] = [
  { key: ROLES.SUPER_ADMIN, name: "Super Admin" },
  { key: ROLES.HR_ADMIN, name: "HR Admin" },
  { key: ROLES.MANAGER, name: "Manager" },
  { key: ROLES.EMPLOYEE, name: "Employee" },
  { key: ROLES.SUBCONTRACTOR, name: "Sub Contractor" },
  { key: ROLES.APPLICANT, name: "Applicant" },
];

// Who may open which page is in src/lib/permissions.ts (PAGE_PERMS): a page needs one of its permissions, and each built-in role has fixed defaults there.

// Where a person lands after signing in, and where a denied page sends them.
export const homeFor = (role: string) => (role === ROLES.APPLICANT ? "/apply" : "/dashboard");

// Page access of a built-in role with no personal changes. Signed-in accounts use their own permissions (user.perms) instead.
export function canAccess(role: string, path: string): boolean {
  return isBuiltInRole(role) && canAccessPath(role, effectivePerms({ key: role }), path);
}

import { canAccessPath, effectivePerms, isBuiltInRole } from "@/lib/permissions";
