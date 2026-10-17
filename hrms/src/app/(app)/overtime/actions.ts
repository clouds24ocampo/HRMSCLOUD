"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { loadDtr } from "@/lib/dtr-data";
import { getMyEmployee } from "@/lib/employees";
import { approverUserIds, notify, supervisorUserIds, userIdOfEmployee } from "@/lib/notify";
import { getOrgSettings } from "@/lib/settings";
import { ROLES } from "@/lib/roles";
import { ancestorIds, mayDecide, stepOf } from "@/lib/overtime";
import { addDays, dayKey, dbDate, formatDuration } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const done = () => {
  revalidatePath("/overtime");
  revalidatePath("/dtr");
};

// The employee asks for the overtime the DTR measured on one day. The amount is whatever the DTR shows, not what the browser says.
export async function requestOvertime(day: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/overtime");
  const reason = z.string().trim().min(3, "Give a short reason.").max(300).safeParse(form.get("reason"));
  if (!reason.success) return { error: reason.error.issues[0].message };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Invalid day." };

  const settings = await getOrgSettings(me.organizationId);
  const emp = await getMyEmployee(me, settings.timezone);
  const today = dayKey(new Date(), settings.timezone);
  if (day > today) return { error: "Overtime can only be requested after it happened." };
  if (day < addDays(today, -31)) return { error: "Overtime can be filed up to 31 days after. Ask HR for older days." };

  const dtr = await loadDtr(me, emp.id, emp.id, day, day, settings.timezone, settings.graceMinutes);
  const minutes = dtr?.rows[0]?.overtimeMinutes ?? 0;
  if (minutes <= 0) return { error: "The DTR shows no overtime for that day." };

  const existing = await prisma.overtimeRequest.findUnique({ where: { employeeId_date: { employeeId: emp.id, date: dbDate(day) } } });
  if (existing && existing.status !== "CANCELLED" && existing.status !== "REJECTED") return { error: "Overtime for this day was already requested." };

  const data = { minutes, reason: reason.data, status: "PENDING" as const, decidedById: null, decidedAt: null, decisionNote: null };
  const r = existing
    ? await prisma.overtimeRequest.update({ where: { id: existing.id }, data }) // a rejected or cancelled day can be asked again
    : await prisma.overtimeRequest.create({ data: { ...data, organizationId: me.organizationId, employeeId: emp.id, date: dbDate(day) } });
  await audit(me.id, "overtime.requested", "OvertimeRequest", r.id, { day, minutes }, me.organizationId);
  // Step 1 goes to the supervisor chain; with no supervisor it goes straight to HR.
  const chain = await supervisorUserIds(me.organizationId, emp.id);
  await notify(me.organizationId, chain.length ? chain : await approverUserIds(me.organizationId, emp.id), { title: `${me.name} asked for ${formatDuration(minutes)} overtime`, body: `${day} · ${reason.data}`, href: "/overtime" }, me.id);
  done();
  return { ok: `Requested ${formatDuration(minutes)} of overtime for ${day}.` };
}

export async function cancelOvertime(id: string) {
  const me = await requireUser("/overtime");
  const emp = await getMyEmployee(me);
  const r = await prisma.overtimeRequest.findFirst({ where: { id, employeeId: emp.id, organizationId: me.organizationId, status: "PENDING" } });
  if (!r) return;
  await prisma.overtimeRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(me.id, "overtime.cancelled", "OvertimeRequest", id, undefined, me.organizationId);
  done();
}

// Two steps (see lib/overtime.ts): the department head first, then HR. Either step can reject.
export async function decideOvertime(id: string, decision: "APPROVED" | "REJECTED", _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/overtime");
  const note = z.string().trim().max(300).optional().parse(form.get("note") ?? undefined);
  if (decision === "REJECTED" && (note ?? "").length < 3) return { error: "Give a short reason for rejecting." };

  const r = await prisma.overtimeRequest.findFirst({ where: { id, organizationId: me.organizationId, status: "PENDING" }, include: { employee: { select: { managerId: true, firstName: true, lastName: true } } } });
  if (!r) return { error: "This request was already handled." };
  const mine = await getMyEmployee(me);
  const rows = await prisma.employee.findMany({ where: { organizationId: me.organizationId }, select: { id: true, managerId: true } });
  const step = stepOf(r, !!r.employee.managerId);
  const blocked = mayDecide({ roleKey: me.role.key, actorUserId: me.id, actorEmployeeId: mine.id, employeeId: r.employeeId, step, ancestors: ancestorIds(rows, r.employeeId), headApprovedById: r.headApprovedById });
  if (blocked) return { error: blocked };

  const uid = await userIdOfEmployee(me.organizationId, r.employeeId);
  const who = `${r.employee.firstName} ${r.employee.lastName}`;
  if (decision === "APPROVED" && step === "HEAD") {
    // Guarded update: if someone else decided in the meantime, nothing changes.
    const n = await prisma.overtimeRequest.updateMany({ where: { id, status: "PENDING", headApprovedAt: null }, data: { headApprovedById: me.id, headApprovedAt: new Date(), decisionNote: note || null } });
    if (n.count === 0) return { error: "This request was already handled." };
    await audit(me.id, "overtime.head_approved", "OvertimeRequest", id, { note }, me.organizationId);
    const hr = await prisma.user.findMany({ where: { organizationId: me.organizationId, active: true, role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN] } } }, select: { id: true } });
    await notify(me.organizationId, hr.map((u) => u.id), { title: `Overtime for ${who} needs final approval`, body: `${formatDuration(r.minutes)} · approved by ${me.name}`, href: "/overtime" }, me.id);
    if (uid) await notify(me.organizationId, [uid], { title: "Your department head approved your overtime", body: "HR gives the final approval.", href: "/overtime" }, me.id);
    done();
    return { ok: "Approved. HR gives the final approval." };
  }

  const n = await prisma.overtimeRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: decision, decidedById: me.id, decidedAt: new Date(), decisionNote: note || r.decisionNote } });
  if (n.count === 0) return { error: "This request was already handled." };
  await audit(me.id, decision === "APPROVED" ? "overtime.approved" : "overtime.rejected", "OvertimeRequest", id, { note, step }, me.organizationId);
  if (uid) await notify(me.organizationId, [uid], { title: `Your overtime was ${decision === "APPROVED" ? "approved" : "rejected"}`, body: note || undefined, href: "/overtime" }, me.id);
  done();
  revalidatePath("/payroll");
  return { ok: decision === "APPROVED" ? "Approved. It is paid in this cut-off." : "Rejected." };
}
