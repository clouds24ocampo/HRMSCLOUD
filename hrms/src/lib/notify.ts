import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";

type Note = { title: string; body?: string; href?: string };

// In-app notifications. Always inside one organization; the signed-in user themselves is never notified of their own action.
export async function notify(organizationId: string, userIds: string[], note: Note, exceptUserId?: string) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== exceptUserId);
  if (!ids.length) return;
  await prisma.notification.createMany({ data: ids.map((userId) => ({ organizationId, userId, ...note })) });
}

// Everyone who may decide for this employee: HR and Super Admins, plus the supervisor chain above them.
export async function approverUserIds(organizationId: string, employeeId: string): Promise<string[]> {
  const [hr, people] = await Promise.all([
    prisma.user.findMany({ where: { organizationId, active: true, role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN] } } }, select: { id: true } }),
    prisma.employee.findMany({ where: { organizationId }, select: { id: true, managerId: true, userId: true } }),
  ]);
  const byId = new Map(people.map((p) => [p.id, p]));
  const chain: string[] = [];
  const seen = new Set<string>();
  for (let cur = byId.get(employeeId)?.managerId; cur && !seen.has(cur); cur = byId.get(cur)?.managerId) {
    seen.add(cur);
    const uid = byId.get(cur)?.userId;
    if (uid) chain.push(uid);
  }
  return [...hr.map((u) => u.id), ...chain];
}

export async function userIdOfEmployee(organizationId: string, employeeId: string): Promise<string | null> {
  return (await prisma.employee.findFirst({ where: { id: employeeId, organizationId }, select: { userId: true } }))?.userId ?? null;
}
