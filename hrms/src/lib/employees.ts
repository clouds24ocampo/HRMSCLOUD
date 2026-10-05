import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { dbDate, dayKey } from "@/lib/time";
import { createChecklist } from "@/lib/checklists";

type Db = Prisma.TransactionClient;

export async function nextEmployeeNo(db: Db, organizationId: string): Promise<string> {
  let n = (await db.employee.count({ where: { organizationId } })) + 1;
  for (;;) {
    const employeeNo = `EMP-${String(n).padStart(4, "0")}`;
    if (!(await db.employee.findUnique({ where: { organizationId_employeeNo: { organizationId, employeeNo } } }))) return employeeNo;
    n++;
  }
}

// Names are copied into history rows so they stay readable after renames or archiving.
export async function assignmentSnapshot(db: Db, organizationId: string, e: { departmentId?: string | null; positionId?: string | null; managerId?: string | null }) {
  const [d, p, m] = await Promise.all([
    e.departmentId ? db.department.findFirst({ where: { id: e.departmentId, organizationId }, select: { name: true } }) : null,
    e.positionId ? db.position.findFirst({ where: { id: e.positionId, organizationId }, select: { title: true } }) : null,
    e.managerId ? db.employee.findFirst({ where: { id: e.managerId, organizationId }, select: { firstName: true, lastName: true } }) : null,
  ]);
  return { departmentName: d?.name ?? null, positionTitle: p?.title ?? null, managerName: m ? `${m.firstName} ${m.lastName}` : null };
}

export type NewEmployee = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  managerId?: string | null;
  hireDate: Date;
  userId?: string | null;
};

export async function createEmployee(db: Db, organizationId: string, actorId: string | null, data: NewEmployee, opts: { checklist?: boolean } = {}) {
  const emp = await db.employee.create({
    data: { ...data, organizationId, employeeNo: await nextEmployeeNo(db, organizationId) },
  });
  await db.employmentHistory.create({
    data: {
      organizationId, employeeId: emp.id, change: "HIRED", status: emp.status, effectiveFrom: data.hireDate, createdById: actorId,
      ...(await assignmentSnapshot(db, organizationId, data)),
    },
  });
  if (opts.checklist !== false) await createChecklist(db, organizationId, emp.id, "ONBOARDING");
  return emp;
}

// Every signed-in person has an employee profile (time clock, schedule and leave hang off it).
// Created on first use for accounts that were made before profiles existed.
export async function getMyEmployee(actor: { id: string; organizationId: string; name: string }, tz = "Asia/Manila") {
  const found = await prisma.employee.findUnique({ where: { userId: actor.id } });
  if (found) return found;
  const [firstName, ...rest] = actor.name.trim().split(/\s+/);
  const hireDate = dbDate(dayKey(new Date(), tz));
  return prisma.$transaction((tx) =>
    createEmployee(tx, actor.organizationId, actor.id, { firstName, lastName: rest.join(" ") || "-", hireDate, userId: actor.id }, { checklist: false }),
  );
}
