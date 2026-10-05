"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { ROLES } from "@/lib/roles";
import { canViewEmployee, isHr } from "@/lib/scope";

// Who may tick an item: HR any item; the employee their own "Employee" items; a manager the "Manager" items of people below them.
export async function toggleChecklistItem(id: string) {
  const me = await requireUser("/dashboard");
  const item = await prisma.checklistItem.findFirst({ where: { id, organizationId: me.organizationId }, include: { employee: { select: { userId: true } } } });
  if (!item) return;
  const mine = await getMyEmployee(me);
  const ok =
    isHr(me.role.key) ||
    (item.owner === "EMPLOYEE" && item.employeeId === mine.id) ||
    (item.owner === "MANAGER" && me.role.key === ROLES.MANAGER && item.employeeId !== mine.id && (await canViewEmployee(me, mine.id, item.employeeId)));
  if (!ok) return;
  const done = !item.doneAt;
  await prisma.checklistItem.update({ where: { id }, data: { doneAt: done ? new Date() : null, doneById: done ? me.id : null } });
  await audit(me.id, done ? "checklist.done" : "checklist.undone", "ChecklistItem", id, { title: item.title }, me.organizationId);
  revalidatePath(`/employees/${item.employeeId}`);
  revalidatePath("/dashboard");
}
