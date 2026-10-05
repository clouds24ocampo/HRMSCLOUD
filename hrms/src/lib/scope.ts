// Who may see whom. One place, used by every page and action that touches employee data.
//   Employee            -> self
//   Manager             -> self + everyone below them in the supervisor chain
//   HR Admin / Super Admin -> everyone in the organization
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";

export type Actor = { id: string; organizationId: string; name: string; role: { key: string } };

export const isHr = (roleKey: string) => roleKey === ROLES.SUPER_ADMIN || roleKey === ROLES.HR_ADMIN;

// Pure: the root plus everyone who reports to them, directly or not.
export function descendantIds(rows: { id: string; managerId: string | null }[], rootId: string): string[] {
  const kids = new Map<string, string[]>();
  for (const r of rows) if (r.managerId) kids.set(r.managerId, [...(kids.get(r.managerId) ?? []), r.id]);
  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    for (const k of kids.get(stack.pop()!) ?? []) {
      if (out.has(k)) continue;
      out.add(k);
      stack.push(k);
    }
  }
  return [...out];
}

// null means "everyone in the organization".
export async function visibleEmployeeIds(actor: Actor, myEmployeeId: string): Promise<string[] | null> {
  if (isHr(actor.role.key)) return null;
  if (actor.role.key === ROLES.MANAGER) {
    const rows = await prisma.employee.findMany({ where: { organizationId: actor.organizationId }, select: { id: true, managerId: true } });
    return descendantIds(rows, myEmployeeId);
  }
  return [myEmployeeId];
}

// Prisma where-fragment for employee queries: always org-scoped, plus the chain limit.
export async function employeeScope(actor: Actor, myEmployeeId: string) {
  const ids = await visibleEmployeeIds(actor, myEmployeeId);
  return { organizationId: actor.organizationId, ...(ids ? { id: { in: ids } } : {}) };
}

export async function canViewEmployee(actor: Actor, myEmployeeId: string, employeeId: string): Promise<boolean> {
  const ids = await visibleEmployeeIds(actor, myEmployeeId);
  if (ids) return ids.includes(employeeId);
  return !!(await prisma.employee.findFirst({ where: { id: employeeId, organizationId: actor.organizationId }, select: { id: true } }));
}
