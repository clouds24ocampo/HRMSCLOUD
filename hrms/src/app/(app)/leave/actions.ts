"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { countLeaveDays } from "@/lib/leave";
import { loadSchedules, resolvePerson } from "@/lib/schedule-data";
import { approverUserIds, notify, userIdOfEmployee } from "@/lib/notify";
import { daysBetween } from "@/lib/time";
import { getOrgSettings } from "@/lib/settings";
import { canViewEmployee, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { addDays, dayKey, dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const key = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose both dates.");
const done = () => {
  revalidatePath("/leave");
  revalidatePath("/dashboard");
};

export async function requestLeave(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/leave");
  const parsed = z
    .object({ leaveTypeId: z.string().min(1, "Choose a leave type."), from: key, to: key, reason: z.string().trim().min(3, "Give a short reason.").max(300) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.from > d.to) return { error: "The end date is before the start date." };

  const settings = await getOrgSettings(me.organizationId);
  const emp = await getMyEmployee(me, settings.timezone);
  const today = dayKey(new Date(), settings.timezone);
  if (d.from < addDays(today, -30)) return { error: "Leave can be filed up to 30 days after the fact. Ask HR for older dates." };
  if (d.to > addDays(today, 366)) return { error: "That is too far ahead." };

  const type = await prisma.leaveType.findFirst({ where: { id: d.leaveTypeId, organizationId: me.organizationId, archivedAt: null } });
  if (!type) return { error: "Choose a leave type from the list." };

  const sched = await loadSchedules(me.organizationId, [emp.id], d.from, d.to);
  const resolved = resolvePerson(sched.get(emp.id), daysBetween(d.from, d.to));
  const days = countLeaveDays(d.from, d.to, new Map([...resolved].map(([k, r]) => [k, r.shift !== null])));
  if (days === 0) return { error: "Those dates are all days off. Nothing to file." };

  const overlap = await prisma.leaveRequest.findFirst({
    where: { employeeId: emp.id, organizationId: me.organizationId, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: dbDate(d.to) }, endDate: { gte: dbDate(d.from) } },
  });
  if (overlap) return { error: "You already have a leave request that overlaps these dates." };

  if (type.paid) {
    const year = today.slice(0, 4);
    const taken = await prisma.leaveRequest.aggregate({
      where: { employeeId: emp.id, leaveTypeId: type.id, status: { in: ["PENDING", "APPROVED"] }, startDate: { gte: dbDate(`${year}-01-01`), lte: dbDate(`${year}-12-31`) } },
      _sum: { days: true },
    });
    const left = type.annualDays - (taken._sum.days ?? 0);
    if (days > left) return { error: `Not enough ${type.name.toLowerCase()} left. You have ${Math.max(left, 0)} day${left === 1 ? "" : "s"}, this needs ${days}.` };
  }

  const r = await prisma.leaveRequest.create({
    data: { organizationId: me.organizationId, employeeId: emp.id, leaveTypeId: type.id, startDate: dbDate(d.from), endDate: dbDate(d.to), days, reason: d.reason },
  });
  await audit(me.id, "leave.requested", "LeaveRequest", r.id, { type: type.name, days, from: d.from, to: d.to }, me.organizationId);
  await notify(me.organizationId, await approverUserIds(me.organizationId, emp.id), { title: `${me.name} asked for ${days} day${days === 1 ? "" : "s"} of ${type.name.toLowerCase()}`, body: `${d.from} to ${d.to}`, href: "/leave" }, me.id);
  done();
  return { ok: `Request sent for ${days} day${days === 1 ? "" : "s"}. Your supervisor will review it.` };
}

export async function cancelLeave(id: string) {
  const me = await requireUser("/leave");
  const emp = await getMyEmployee(me);
  const r = await prisma.leaveRequest.findFirst({ where: { id, employeeId: emp.id, organizationId: me.organizationId, status: "PENDING" } });
  if (!r) return;
  await prisma.leaveRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(me.id, "leave.cancelled", "LeaveRequest", id, undefined, me.organizationId);
  done();
}

// Approver rules: HR and Super Admin decide for anyone; a Manager decides for people below them.
// Nobody approves their own request, except the Super Admin (the owner of the organization), who is always audited.
export async function decideLeave(id: string, decision: "APPROVED" | "REJECTED", _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/leave");
  const note = z.string().trim().max(300).optional().parse(form.get("note") ?? undefined);
  if (decision === "REJECTED" && (note ?? "").length < 3) return { error: "Give a short reason for rejecting." };

  const r = await prisma.leaveRequest.findFirst({ where: { id, organizationId: me.organizationId, status: "PENDING" } });
  if (!r) return { error: "This request was already handled." };
  const mine = await getMyEmployee(me);
  const own = r.employeeId === mine.id;
  if (own && me.role.key !== ROLES.SUPER_ADMIN) return { error: "You cannot approve your own request." };
  const allowed = isHr(me.role.key) || (me.role.key === ROLES.MANAGER && (await canViewEmployee(me, mine.id, r.employeeId)));
  if (!allowed) return { error: "This request is not yours to decide." };

  await prisma.leaveRequest.update({ where: { id }, data: { status: decision, decidedById: me.id, decidedAt: new Date(), decisionNote: note || null } });
  await audit(me.id, decision === "APPROVED" ? "leave.approved" : "leave.rejected", "LeaveRequest", id, { own, note }, me.organizationId);
  const uid = await userIdOfEmployee(me.organizationId, r.employeeId);
  if (uid) await notify(me.organizationId, [uid], { title: `Your leave was ${decision === "APPROVED" ? "approved" : "rejected"}`, body: note || undefined, href: "/leave" }, me.id);
  done();
  return { ok: decision === "APPROVED" ? "Approved." : "Rejected." };
}
