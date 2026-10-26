"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { goalOutcome } from "@/lib/goals";
import { getMyEmployee } from "@/lib/employees";
import { notify, userIdOfEmployee } from "@/lib/notify";
import { ROLES } from "@/lib/roles";
import { canViewEmployee, isHr } from "@/lib/scope";
import { dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const done = () => revalidatePath("/performance");
const rating = z.coerce.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5.");
const comment = z.string().trim().min(3, "Add a short comment.").max(2000);

type Me = Awaited<ReturnType<typeof requireUser>>;
const hrUserIds = async (orgId: string) =>
  (await prisma.user.findMany({ where: { organizationId: orgId, active: true, role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN] } } }, select: { id: true } })).map((u) => u.id);

// ---------- goals ----------
export async function addGoal(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/performance");
  const mine = await getMyEmployee(me);
  const parsed = z
    .object({ title: z.string().trim().min(3, "Name the goal.").max(120), description: z.string().trim().max(1000).optional(), targetDate: z.string().optional(), employeeId: z.string().optional() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const employeeId = parsed.data.employeeId || mine.id;
  // Own goals for anyone; goals for others only inside your chain (managers) or anywhere (HR).
  if (employeeId !== mine.id && !(isHr(me.role.key) || (me.role.key === ROLES.MANAGER && (await canViewEmployee(me, mine.id, employeeId))))) return { error: "You can only set goals for your own team." };
  if (!(await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId } }))) return { error: "Employee not found." };
  const g = await prisma.goal.create({
    data: { organizationId: me.organizationId, employeeId, title: parsed.data.title, description: parsed.data.description || null, targetDate: parsed.data.targetDate ? dbDate(parsed.data.targetDate) : null, createdById: me.id },
  });
  await audit(me.id, "goal.created", "Goal", g.id, { employeeId, title: g.title }, me.organizationId);
  if (employeeId !== mine.id) {
    const uid = await userIdOfEmployee(me.organizationId, employeeId);
    if (uid) await notify(me.organizationId, [uid], { title: `New goal for you: ${g.title}`, href: "/performance" }, me.id);
  }
  done();
  return { ok: "Goal added." };
}

export async function updateGoal(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/performance");
  const mine = await getMyEmployee(me);
  const parsed = z.object({ progress: z.coerce.number().int().min(0).max(100, "Progress is 0 to 100."), status: z.enum(["ACTIVE", "ACHIEVED", "DROPPED"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const g = await prisma.goal.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!g) return { error: "Goal not found." };
  if (g.employeeId !== mine.id && !(isHr(me.role.key) || (me.role.key === ROLES.MANAGER && (await canViewEmployee(me, mine.id, g.employeeId))))) return { error: "This goal is not yours to update." };
  const { progress, status } = goalOutcome(parsed.data.progress, parsed.data.status);
  await prisma.goal.update({ where: { id }, data: { progress, status } });
  await audit(me.id, "goal.updated", "Goal", id, { progress, status }, me.organizationId);
  done();
  return { ok: "Saved." };
}

// ---------- review cycles ----------
export async function createCycle(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/performance");
  if (!isHr(me.role.key)) return { error: "Only HR can start a review cycle." };
  const parsed = z
    .object({ name: z.string().trim().min(3, "Name the cycle.").max(80), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the dates."), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the dates.") })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.startDate > parsed.data.endDate) return { error: "The cycle ends before it starts." };
  const people = await prisma.employee.findMany({ where: { organizationId: me.organizationId, status: { in: ["ACTIVE", "ON_LEAVE"] } }, select: { id: true, managerId: true, userId: true } });
  if (people.length === 0) return { error: "There are no active employees to review." };
  const cycle = await prisma.$transaction(async (tx) => {
    const c = await tx.reviewCycle.create({ data: { organizationId: me.organizationId, name: parsed.data.name, startDate: dbDate(parsed.data.startDate), endDate: dbDate(parsed.data.endDate) } });
    await tx.review.createMany({ data: people.map((p) => ({ organizationId: me.organizationId, cycleId: c.id, employeeId: p.id, reviewerId: p.managerId })) });
    return c;
  });
  await audit(me.id, "review_cycle.created", "ReviewCycle", cycle.id, { name: cycle.name, people: people.length }, me.organizationId);
  await notify(me.organizationId, people.map((p) => p.userId).filter((x): x is string => !!x), { title: `${cycle.name}: please complete your self-assessment`, href: "/performance" }, me.id);
  done();
  return { ok: `${cycle.name} started for ${people.length} people. They were asked to do their self-assessment.` };
}

export async function closeCycle(id: string) {
  const me = await requireUser("/performance");
  if (!isHr(me.role.key)) return;
  const c = await prisma.reviewCycle.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!c) return;
  await prisma.reviewCycle.update({ where: { id }, data: { status: "CLOSED" } });
  await audit(me.id, "review_cycle.closed", "ReviewCycle", id, undefined, me.organizationId);
  done();
}

async function loadReview(me: Me, id: string) {
  return prisma.review.findFirst({ where: { id, organizationId: me.organizationId }, include: { cycle: true, employee: { select: { firstName: true, lastName: true, userId: true } } } });
}

// Step 1: the employee rates themselves. With no manager, it goes straight to HR.
export async function submitSelf(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/performance");
  const mine = await getMyEmployee(me);
  const parsed = z.object({ rating, comment }).safeParse({ rating: form.get("rating"), comment: form.get("comment") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const r = await loadReview(me, id);
  if (!r || r.employeeId !== mine.id) return { error: "This review is not yours." };
  if (r.cycle.status !== "OPEN") return { error: "This review cycle is closed." };
  if (r.stage !== "SELF") return { error: "You already submitted your self-assessment." };
  const next = r.reviewerId ? "MANAGER" : "FINAL";
  await prisma.review.update({ where: { id }, data: { selfRating: parsed.data.rating, selfComment: parsed.data.comment, stage: next } });
  await audit(me.id, "review.self_submitted", "Review", id, { rating: parsed.data.rating }, me.organizationId);
  const to = r.reviewerId ? [await userIdOfEmployee(me.organizationId, r.reviewerId)].filter((x): x is string => !!x) : await hrUserIds(me.organizationId);
  await notify(me.organizationId, to, { title: `${me.name} finished their self-assessment`, body: r.cycle.name, href: "/performance" }, me.id);
  done();
  return { ok: "Submitted. Your manager will review it next." };
}

// Step 2: the manager (or HR) rates the employee.
export async function submitManager(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/performance");
  const mine = await getMyEmployee(me);
  const parsed = z.object({ rating, comment }).safeParse({ rating: form.get("rating"), comment: form.get("comment") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const r = await loadReview(me, id);
  if (!r) return { error: "Review not found." };
  if (r.employeeId === mine.id) return { error: "You cannot evaluate yourself here." };
  if (!(isHr(me.role.key) || r.reviewerId === mine.id)) return { error: "This review is not yours to evaluate." };
  if (r.cycle.status !== "OPEN") return { error: "This review cycle is closed." };
  if (r.stage !== "MANAGER") return { error: "This review is not waiting for the manager." };
  await prisma.review.update({ where: { id }, data: { managerRating: parsed.data.rating, managerComment: parsed.data.comment, stage: "FINAL" } });
  await audit(me.id, "review.manager_submitted", "Review", id, { rating: parsed.data.rating }, me.organizationId);
  await notify(me.organizationId, await hrUserIds(me.organizationId), { title: `${r.employee.firstName} ${r.employee.lastName}: manager review done`, body: `${r.cycle.name}. Ready for the final rating.`, href: "/performance" }, me.id);
  done();
  return { ok: "Submitted. HR will set the final rating." };
}

// Step 3: HR sets the final rating, normally agreeing with the manager.
export async function finalizeReview(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/performance");
  if (!isHr(me.role.key)) return { error: "Only HR sets the final rating." };
  const parsed = z.object({ rating, comment }).safeParse({ rating: form.get("rating"), comment: form.get("comment") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const r = await loadReview(me, id);
  if (!r) return { error: "Review not found." };
  if (r.stage !== "FINAL") return { error: "This review is not ready for a final rating." };
  await prisma.review.update({ where: { id }, data: { finalRating: parsed.data.rating, finalComment: parsed.data.comment, stage: "DONE" } });
  await audit(me.id, "review.finalized", "Review", id, { rating: parsed.data.rating }, me.organizationId);
  if (r.employee.userId) await notify(me.organizationId, [r.employee.userId], { title: `Your ${r.cycle.name} review is ready`, href: "/performance" }, me.id);
  done();
  return { ok: "Final rating saved." };
}

export async function acknowledgeReview(id: string) {
  const me = await requireUser("/performance");
  const mine = await getMyEmployee(me);
  const r = await prisma.review.findFirst({ where: { id, organizationId: me.organizationId, employeeId: mine.id, stage: "DONE", acknowledgedAt: null } });
  if (!r) return;
  await prisma.review.update({ where: { id }, data: { acknowledgedAt: new Date() } });
  await audit(me.id, "review.acknowledged", "Review", id, undefined, me.organizationId);
  done();
}
