"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { createEmployee, assignmentSnapshot } from "@/lib/employees";
import { ROLES } from "@/lib/roles";
import { descendantIds, isHr } from "@/lib/scope";
import { dbDate } from "@/lib/time";
import { createChecklist } from "@/lib/checklists";
import type { FormState } from "@/app/login/actions";

const text = (label: string) => z.string().trim().min(1, `Enter ${label}.`).max(80);
const optional = z.string().trim().max(120).optional().transform((v) => v || undefined);
const pick = z.string().optional().transform((v) => v || undefined);
const STATUSES = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "SEPARATED"] as const;

const createSchema = z.object({
  firstName: text("a first name"),
  lastName: text("a last name"),
  email: optional,
  phone: optional,
  departmentId: pick,
  positionId: pick,
  managerId: pick,
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the hire date."),
  createLogin: z.string().optional(),
  roleId: pick,
  password: z.string().optional(),
  shiftId: pick,
});

// Every referenced id must belong to the caller's organization (never trust ids from the browser).
async function checkRefs(orgId: string, r: { departmentId?: string; positionId?: string; managerId?: string }, selfId?: string) {
  if (r.departmentId && !(await prisma.department.findFirst({ where: { id: r.departmentId, organizationId: orgId, archivedAt: null } }))) return "Choose a department from the list.";
  if (r.positionId && !(await prisma.position.findFirst({ where: { id: r.positionId, organizationId: orgId, archivedAt: null } }))) return "Choose a position from the list.";
  if (r.managerId) {
    if (r.managerId === selfId) return "A person cannot supervise themselves.";
    if (!(await prisma.employee.findFirst({ where: { id: r.managerId, organizationId: orgId, status: { not: "SEPARATED" } } }))) return "Choose a supervisor from the list.";
  }
  return null;
}

export async function createEmployeeAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/employees");
  if (!isHr(me.role.key)) return { error: "Only HR can add employees." };
  const parsed = createSchema.safeParse({ ...Object.fromEntries(form), days: undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const bad = await checkRefs(me.organizationId, d);
  if (bad) return { error: bad };
  const workDays = form.getAll("days").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (d.shiftId) {
    if (!(await prisma.shiftTemplate.findFirst({ where: { id: d.shiftId, organizationId: me.organizationId, archivedAt: null } }))) return { error: "Choose a shift from the list." };
    if (workDays.length === 0) return { error: "Choose the days this person works." };
  }

  let login: { roleId: string; passwordHash: string; email: string } | null = null;
  if (d.createLogin === "on") {
    if (!d.email || !z.email().safeParse(d.email).success) return { error: "A login needs a valid email." };
    if ((d.password ?? "").length < 10) return { error: "Temporary password needs at least 10 characters." };
    const role = d.roleId ? await prisma.role.findUnique({ where: { id: d.roleId } }) : null;
    if (!role) return { error: "Choose a role for the login." };
    // Only a Super Admin may hand out admin roles.
    if ((role.key === ROLES.SUPER_ADMIN || role.key === ROLES.HR_ADMIN) && me.role.key !== ROLES.SUPER_ADMIN) return { error: "Only a Super Admin can give an admin role." };
    const email = d.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) return { error: "This email already has a login." };
    login = { roleId: role.id, email, passwordHash: await bcrypt.hash(d.password!, 12) };
  }

  const emp = await prisma.$transaction(async (tx) => {
    const user = login
      ? await tx.user.create({
          data: { organizationId: me.organizationId, name: `${d.firstName} ${d.lastName}`, email: login.email, passwordHash: login.passwordHash, roleId: login.roleId, mustChangePassword: true },
        })
      : null;
    const created = await createEmployee(tx, me.organizationId, me.id, {
      firstName: d.firstName, lastName: d.lastName, email: d.email ?? null, phone: d.phone ?? null,
      departmentId: d.departmentId, positionId: d.positionId, managerId: d.managerId, hireDate: dbDate(d.hireDate), userId: user?.id,
    });
    if (d.shiftId) {
      await tx.regularSchedule.create({
        data: { organizationId: me.organizationId, employeeId: created.id, shiftId: d.shiftId, workDays, effectiveFrom: dbDate(d.hireDate), createdById: me.id },
      });
    }
    return created;
  });
  await audit(me.id, "employee.created", "Employee", emp.id, { employeeNo: emp.employeeNo, login: !!login }, me.organizationId);
  revalidatePath("/employees");
  return { ok: `${emp.firstName} ${emp.lastName} added as ${emp.employeeNo}.${login ? " They sign in with the temporary password." : ""}` };
}

export async function updateAssignment(employeeId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/employees");
  if (!isHr(me.role.key)) return { error: "Only HR can change assignments." };
  const parsed = z
    .object({ departmentId: pick, positionId: pick, managerId: pick, status: z.enum(STATUSES), note: optional })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the form and try again." };
  const d = parsed.data;

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId } });
  if (!emp) return { error: "Employee not found." };
  const bad = await checkRefs(me.organizationId, d, emp.id);
  if (bad) return { error: bad };
  if (d.managerId) {
    const rows = await prisma.employee.findMany({ where: { organizationId: me.organizationId }, select: { id: true, managerId: true } });
    if (descendantIds(rows, emp.id).includes(d.managerId)) return { error: "That would make a loop: the supervisor already reports to this person." };
  }

  const assignmentChanged =
    (d.departmentId ?? null) !== emp.departmentId || (d.positionId ?? null) !== emp.positionId || (d.managerId ?? null) !== emp.managerId;
  const statusChanged = d.status !== emp.status;
  if (!assignmentChanged && !statusChanged) return { ok: "Nothing changed." };

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: emp.id },
      data: { departmentId: d.departmentId ?? null, positionId: d.positionId ?? null, managerId: d.managerId ?? null, status: d.status },
    });
    const today = dbDate(new Date().toISOString().slice(0, 10));
    const base = { organizationId: me.organizationId, employeeId: emp.id, effectiveFrom: today, note: d.note, createdById: me.id };
    if (assignmentChanged) {
      await tx.employmentHistory.create({ data: { ...base, change: "ASSIGNMENT", ...(await assignmentSnapshot(tx, me.organizationId, d)) } });
    }
    if (statusChanged) await tx.employmentHistory.create({ data: { ...base, change: "STATUS", status: d.status } });
    if (statusChanged && d.status === "SEPARATED") {
      await createChecklist(tx, me.organizationId, emp.id, "OFFBOARDING");
      if (emp.userId) {
        // A separated person can no longer sign in, and any open session ends now.
        await tx.user.update({ where: { id: emp.userId }, data: { active: false } });
        await tx.session.deleteMany({ where: { userId: emp.userId } });
      }
    }
  });
  await audit(me.id, "employee.updated", "Employee", emp.id, { assignmentChanged, from: emp.status, to: d.status }, me.organizationId);
  revalidatePath(`/employees/${emp.id}`);
  return { ok: "Saved. The change is in the history below." };
}
