import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { effectivePerms, entryLevelProblem, isBuiltInRole, rolePerms, type Level } from "@/lib/permissions";

// Server helpers for itemized access. The rules live in permissions.ts; these load the data and apply them.

export type Chooser = { id?: string; role: { key: string }; organizationId: string; perms: ReadonlySet<string> };

const roleSelect = { id: true, key: true, name: true, description: true, permissions: true, organizationId: true } as const;

// The built-in roles plus this company's own. Never another company's, never the applicant role.
export function orgRoles(organizationId: string) {
  return prisma.role.findMany({
    where: { key: { not: ROLES.APPLICANT }, OR: [{ organizationId: null }, { organizationId }] },
    select: roleSelect,
    orderBy: [{ organizationId: "asc" }, { name: "asc" }],
  });
}

// The position level of the employee record behind an account (null: no position, for example the owner).
export async function levelOfUser(userId: string, organizationId: string): Promise<Level | null> {
  const e = await prisma.employee.findFirst({ where: { userId, organizationId }, select: { position: { select: { level: true } } } });
  return (e?.position?.level as Level | undefined) ?? null;
}

export async function levelOfPosition(positionId: string | null | undefined, organizationId: string): Promise<Level | null> {
  if (!positionId) return null;
  const p = await prisma.position.findFirst({ where: { id: positionId, organizationId }, select: { level: true } });
  return (p?.level as Level | undefined) ?? null;
}

// May `actor` give this role (with these personal changes) to someone at this level? Returns the role, or a message.
export async function checkRoleChoice(
  actor: Chooser,
  roleId: string,
  o: { level?: Level | null; grants?: readonly string[]; revokes?: readonly string[] } = {},
) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, key: { not: ROLES.APPLICANT }, OR: [{ organizationId: null }, { organizationId: actor.organizationId }] },
    select: roleSelect,
  });
  if (!role) return { error: "Choose a role from the list." } as const;
  const isSuper = actor.role.key === ROLES.SUPER_ADMIN;
  if (!isSuper && (role.key === ROLES.SUPER_ADMIN || role.key === ROLES.HR_ADMIN)) return { error: "Only a Super Admin can give an admin role." } as const;
  // Nobody can hand out access they do not hold themselves.
  if (!isSuper) {
    const missing = rolePerms(role).filter((p) => !actor.perms.has(p));
    if (missing.length) return { error: "That role includes access you do not have yourself, so you cannot give it." } as const;
  }
  const problem = entryLevelProblem(o.level, effectivePerms(role, o.grants ?? [], o.revokes ?? []));
  if (problem) return { error: problem } as const;
  return { role } as const;
}

// Would moving this account to a position of this level leave it holding access that level may not have?
export async function levelChangeProblem(userId: string, organizationId: string, newLevel: Level | null) {
  if (newLevel !== "ENTRY") return null;
  const u = await prisma.user.findFirst({ where: { id: userId, organizationId }, select: { grants: true, revokes: true, role: { select: { key: true, permissions: true } } } });
  if (!u) return null;
  return entryLevelProblem("ENTRY", effectivePerms(u.role, u.grants, u.revokes));
}

export const isCustomRole = (key: string) => !isBuiltInRole(key);

// May `actor` change the sign-in, status or existence of this account? A Super Admin may. Anyone else may not touch an admin, nor an
// account that holds access they do not hold themselves (otherwise a small permission could take over a bigger account).
export function accountProblem(
  actor: Chooser,
  target: { id: string; role: { key: string; permissions?: readonly string[] | null }; grants: readonly string[]; revokes: readonly string[] } | null | undefined,
  what: string,
): string | null {
  if (!target || actor.role.key === ROLES.SUPER_ADMIN || target.id === actor.id) return null;
  if (target.role.key === ROLES.SUPER_ADMIN || target.role.key === ROLES.HR_ADMIN) return `Only a Super Admin can ${what} an admin.`;
  if ([...effectivePerms(target.role, target.grants, target.revokes)].some((p) => !actor.perms.has(p))) return `This account holds access you do not have yourself, so only a Super Admin can ${what} it.`;
  return null;
}
