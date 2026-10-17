// Overtime approval in two steps:
//   1. HEAD  - someone above the employee in the supervisor chain (the department head, or whoever leads them) approves first.
//   2. FINAL - HR or a Super Admin approves. Only then is it APPROVED and paid.
// Someone with no supervisor skips step 1. Nobody decides their own overtime (except a Super Admin), and the same person
// cannot give both approvals unless they are a Super Admin.
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { isHr, type Actor } from "@/lib/scope";

export type OtStep = "HEAD" | "FINAL";
type Row = { id: string; managerId: string | null };

// Pure: everyone above this person in the supervisor chain, nearest first.
export function ancestorIds(rows: Row[], id: string): string[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: string[] = [];
  for (let cur = byId.get(id)?.managerId; cur && !out.includes(cur); cur = byId.get(cur)?.managerId) out.push(cur);
  return out;
}

export const stepOf = (r: { headApprovedAt: Date | null }, hasSupervisor: boolean): OtStep => (hasSupervisor && !r.headApprovedAt ? "HEAD" : "FINAL");

// Pure: may this actor decide this request at its current step?
export function mayDecide(o: { roleKey: string; actorUserId: string; actorEmployeeId: string; employeeId: string; step: OtStep; ancestors: string[]; headApprovedById: string | null }): string | null {
  const superAdmin = o.roleKey === ROLES.SUPER_ADMIN;
  if (o.employeeId === o.actorEmployeeId && !superAdmin) return "You cannot approve your own overtime.";
  if (o.step === "HEAD") return o.ancestors.includes(o.actorEmployeeId) || superAdmin ? null : "Waiting for the department head to approve first.";
  if (!isHr(o.roleKey)) return "Your part is done. HR gives the final approval.";
  if (o.headApprovedById === o.actorUserId && !superAdmin) return "You approved as department head. Another HR admin gives the final approval.";
  return null;
}

// Pending requests waiting for this actor, with their step.
export async function overtimeQueue(me: Actor, myEmployeeId: string) {
  const [rows, pending] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId: me.organizationId }, select: { id: true, managerId: true } }),
    prisma.overtimeRequest.findMany({
      where: { organizationId: me.organizationId, status: "PENDING" },
      include: { employee: { select: { firstName: true, lastName: true, managerId: true } } },
      orderBy: { date: "asc" },
      take: 300,
    }),
  ]);
  return pending
    .map((r) => {
      const step = stepOf(r, !!r.employee.managerId);
      const blocked = mayDecide({ roleKey: me.role.key, actorUserId: me.id, actorEmployeeId: myEmployeeId, employeeId: r.employeeId, step, ancestors: ancestorIds(rows, r.employeeId), headApprovedById: r.headApprovedById });
      return { ...r, step, blocked };
    })
    .filter((r) => !r.blocked);
}
