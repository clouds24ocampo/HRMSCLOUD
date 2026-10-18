import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { descendantIds, isHr, type Actor } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { accessLevel, type CardFacts, type Category, type Level, type MemberRole } from "@/lib/worksync";

type Db = Prisma.TransactionClient | typeof prisma;

// Which projects this person may open. HR: all. A manager: projects where they or anyone below them is a member.
// Everyone else: projects they are a member of. Every lookup by id goes through this, so an id from a URL proves nothing.
export async function projectScope(me: Actor, mineId: string): Promise<Prisma.WsProjectWhereInput> {
  const base = { organizationId: me.organizationId };
  if (isHr(me.role.key)) return base;
  if (me.role.key === ROLES.MANAGER) {
    const rows = await prisma.employee.findMany({ where: base, select: { id: true, managerId: true } });
    return { ...base, members: { some: { employeeId: { in: descendantIds(rows, mineId) } } } };
  }
  return { ...base, members: { some: { employeeId: mineId } } };
}

export async function loadProject(me: Actor, mineId: string, id: string) {
  const project = await prisma.wsProject.findFirst({
    where: { id, ...(await projectScope(me, mineId)) },
    include: {
      members: { include: { employee: { select: { id: true, firstName: true, lastName: true, userId: true } } }, orderBy: { createdAt: "asc" } },
      lists: { where: { archivedAt: null }, orderBy: { position: "asc" } },
      labels: { orderBy: { name: "asc" } },
    },
  });
  if (!project) return null;
  const mem = project.members.find((m) => m.employeeId === mineId);
  let level: Level | null = accessLevel(isHr(me.role.key), (mem?.role ?? null) as MemberRole | null, !mem);
  if (level && project.archivedAt) level = "VIEW"; // an archived project is read only
  return level ? { project, level, myRole: (mem?.role ?? null) as MemberRole | null } : null;
}

export function logActivity(db: Db, a: { organizationId: string; projectId: string; cardId?: string; cardTitle?: string; actorId: string; type: string; detail?: string }) {
  return db.wsActivity.create({ data: a });
}

export { initials, personName } from "@/lib/worksync";

// A card reduced to what the progress numbers need. Pass cards loaded with `list` and `checklist`.
export function cardFacts(c: { updatedAt: Date; dueDate: Date | null; list: { category: Category }; checklist: { done: boolean }[] }): CardFacts {
  return { category: c.list.category, dueDay: c.dueDate ? c.dueDate.toISOString().slice(0, 10) : null, updatedAt: c.updatedAt, checkDone: c.checklist.filter((k) => k.done).length, checkTotal: c.checklist.length };
}
export const FACTS_INCLUDE = { list: { select: { category: true } }, checklist: { select: { done: true } } } as const;

// Everything a view needs about a card, loaded once for the board, table, timeline, calendar and dashboard.
export const CARD_INCLUDE = {
  list: true,
  assignees: { select: { employeeId: true, employee: { select: { firstName: true, lastName: true } } } },
  labels: { select: { labelId: true } },
  checklist: { select: { done: true } },
  _count: { select: { comments: true } },
} as const;
export type CardRow = Prisma.WsCardGetPayload<{ include: typeof CARD_INCLUDE }>;

export const loadCards = (projectId: string) =>
  prisma.wsCard.findMany({ where: { projectId, archivedAt: null, list: { archivedAt: null } }, orderBy: { position: "asc" }, include: CARD_INCLUDE });

export const filterable = (c: CardRow) => ({ title: c.title, description: c.description, priority: c.priority, assigneeIds: c.assignees.map((a) => a.employeeId), labelIds: c.labels.map((l) => l.labelId) });
export const dayOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// The clock, read in one place so pages stay free of impure calls.
export const serverNow = () => Date.now();
