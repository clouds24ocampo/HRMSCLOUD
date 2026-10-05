"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { loadDtr } from "@/lib/dtr-data";
import { getMyEmployee } from "@/lib/employees";
import { approverUserIds, notify, userIdOfEmployee } from "@/lib/notify";
import { getOrgSettings } from "@/lib/settings";
import { ROLES } from "@/lib/roles";
import { canViewEmployee, isHr } from "@/lib/scope";
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
  await notify(me.organizationId, await approverUserIds(me.organizationId, emp.id), { title: `${me.name} asked for ${formatDuration(minutes)} overtime`, body: `${day} · ${reason.data}`, href: "/overtime" }, me.id);
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

// Same rule as leave: HR and Super Admin decide for anyone, a Manager for people below them, nobody for themselves (except the Super Admin).
export async function decideOvertime(id: string, decision: "APPROVED" | "REJECTED", _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/overtime");
  const note = z.string().trim().max(300).optional().parse(form.get("note") ?? undefined);
  if (decision === "REJECTED" && (note ?? "").length < 3) return { error: "Give a short reason for rejecting." };

  const r = await prisma.overtimeRequest.findFirst({ where: { id, organizationId: me.organizationId, status: "PENDING" } });
  if (!r) return { error: "This request was already handled." };
  const mine = await getMyEmployee(me);
  if (r.employeeId === mine.id && me.role.key !== ROLES.SUPER_ADMIN) return { error: "You cannot approve your own overtime." };
  const allowed = isHr(me.role.key) || (me.role.key === ROLES.MANAGER && (await canViewEmployee(me, mine.id, r.employeeId)));
  if (!allowed) return { error: "This request is not yours to decide." };

  await prisma.overtimeRequest.update({ where: { id }, data: { status: decision, decidedById: me.id, decidedAt: new Date(), decisionNote: note || null } });
  await audit(me.id, decision === "APPROVED" ? "overtime.approved" : "overtime.rejected", "OvertimeRequest", id, { note }, me.organizationId);
  const uid = await userIdOfEmployee(me.organizationId, r.employeeId);
  if (uid) await notify(me.organizationId, [uid], { title: `Your overtime was ${decision === "APPROVED" ? "approved" : "rejected"}`, body: note || undefined, href: "/overtime" }, me.id);
  done();
  return { ok: decision === "APPROVED" ? "Approved." : "Rejected." };
}
