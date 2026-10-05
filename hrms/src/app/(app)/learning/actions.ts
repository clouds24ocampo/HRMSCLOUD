"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { notify, userIdOfEmployee } from "@/lib/notify";
import { ROLES } from "@/lib/roles";
import { canViewEmployee, isHr, visibleEmployeeIds } from "@/lib/scope";
import { dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const done = () => revalidatePath("/learning");
const optNum = z.string().optional().transform((v) => (v ? Number(v) : null));

export async function addCourse(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/learning");
  if (!isHr(me.role.key)) return { error: "Only HR manages the course catalog." };
  const parsed = z
    .object({ title: z.string().trim().min(3, "Name the course.").max(100), description: z.string().trim().max(1000).optional(), hours: optNum.pipe(z.number().int().min(1).max(1000).nullable()), validityMonths: optNum.pipe(z.number().int().min(1).max(240).nullable()) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the hours and validity: whole numbers, or leave them empty." };
  if (await prisma.course.findUnique({ where: { organizationId_title: { organizationId: me.organizationId, title: parsed.data.title } } })) return { error: "A course with this name already exists." };
  const c = await prisma.course.create({ data: { organizationId: me.organizationId, title: parsed.data.title, description: parsed.data.description || null, hours: parsed.data.hours, validityMonths: parsed.data.validityMonths } });
  await audit(me.id, "course.created", "Course", c.id, { title: c.title }, me.organizationId);
  done();
  return { ok: `${c.title} added.` };
}

export async function setCourseArchived(id: string, archived: boolean) {
  const me = await requireUser("/learning");
  if (!isHr(me.role.key)) return;
  const c = await prisma.course.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!c) return;
  await prisma.course.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(me.id, archived ? "course.archived" : "course.restored", "Course", id, { title: c.title }, me.organizationId);
  done();
}

// HR enrolls anyone; a Manager enrolls people in their own team.
export async function enroll(courseId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/learning");
  if (!isHr(me.role.key) && me.role.key !== ROLES.MANAGER) return { error: "Only HR and managers can enroll people." };
  const wanted = form.getAll("people").map(String);
  if (wanted.length === 0) return { error: "Choose at least one person." };
  const course = await prisma.course.findFirst({ where: { id: courseId, organizationId: me.organizationId, archivedAt: null } });
  if (!course) return { error: "Course not found." };
  const mine = await getMyEmployee(me);
  const allowed = await visibleEmployeeIds(me, mine.id);
  const people = await prisma.employee.findMany({ where: { organizationId: me.organizationId, id: { in: allowed ? wanted.filter((w) => allowed.includes(w)) : wanted }, status: { not: "SEPARATED" } }, select: { id: true, userId: true } });
  if (people.length !== wanted.length) return { error: "One or more people are outside your team." };
  const res = await prisma.enrollment.createMany({ data: people.map((p) => ({ organizationId: me.organizationId, courseId, employeeId: p.id, assignedById: me.id })), skipDuplicates: true });
  await audit(me.id, "enrollment.created", "Enrollment", undefined, { course: course.title, people: res.count }, me.organizationId);
  await notify(me.organizationId, people.map((p) => p.userId).filter((x): x is string => !!x), { title: `You were enrolled in ${course.title}`, href: "/learning" }, me.id);
  done();
  return { ok: res.count ? `${res.count} enrolled.` : "They were already enrolled." };
}

// Marking done sets the certificate expiry from the course's validity.
export async function completeEnrollment(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/learning");
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the completion date.").safeParse(form.get("completedOn"));
  if (!date.success) return { error: date.error.issues[0].message };
  const e = await prisma.enrollment.findFirst({ where: { id, organizationId: me.organizationId }, include: { course: true } });
  if (!e) return { error: "Enrollment not found." };
  const mine = await getMyEmployee(me);
  const ok = isHr(me.role.key) || (me.role.key === ROLES.MANAGER && e.employeeId !== mine.id && (await canViewEmployee(me, mine.id, e.employeeId)));
  if (!ok) return { error: "Only HR or the person's manager can mark a course complete." };
  const completed = new Date(`${date.data}T00:00:00Z`);
  if (completed.getTime() > Date.now() + 86_400_000) return { error: "The completion date cannot be in the future." };
  let expires: Date | null = null;
  if (e.course.validityMonths) {
    expires = new Date(completed);
    expires.setUTCMonth(expires.getUTCMonth() + e.course.validityMonths);
  }
  await prisma.enrollment.update({ where: { id }, data: { status: "COMPLETED", completedOn: dbDate(date.data), expiresOn: expires } });
  await audit(me.id, "enrollment.completed", "Enrollment", id, { course: e.course.title, on: date.data }, me.organizationId);
  const uid = await userIdOfEmployee(me.organizationId, e.employeeId);
  if (uid) await notify(me.organizationId, [uid], { title: `${e.course.title} marked complete`, href: "/learning" }, me.id);
  done();
  return { ok: "Marked complete." };
}

export async function cancelEnrollment(id: string) {
  const me = await requireUser("/learning");
  const e = await prisma.enrollment.findFirst({ where: { id, organizationId: me.organizationId, status: "ENROLLED" } });
  if (!e) return;
  const mine = await getMyEmployee(me);
  const ok = isHr(me.role.key) || (me.role.key === ROLES.MANAGER && (await canViewEmployee(me, mine.id, e.employeeId)));
  if (!ok) return;
  await prisma.enrollment.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(me.id, "enrollment.cancelled", "Enrollment", id, undefined, me.organizationId);
  done();
}
