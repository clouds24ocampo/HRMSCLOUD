"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { cutoffFor } from "@/lib/cutoffs";
import { getMyEmployee } from "@/lib/employees";
import { formatMoney, parsePesos } from "@/lib/money";
import { notify, userIdOfEmployee } from "@/lib/notify";
import { ROLES } from "@/lib/roles";
import { isHr } from "@/lib/scope";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const done = () => {
  revalidatePath("/cash-advance");
  revalidatePath("/payroll", "layout");
};

// The employee asks for an advance. One open request at a time.
export async function requestCashAdvance(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/cash-advance");
  const parsed = z
    .object({
      reason: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const cents = parsePesos(form.get("amount"));
  if (!cents || cents < 10_000) return { error: "Enter the amount in pesos, at least 100.00." };
  if (cents > 100_000_000) return { error: "That amount is too large. Talk to HR." };
  const emp = await getMyEmployee(me);
  if (await prisma.cashAdvance.findFirst({ where: { employeeId: emp.id, organizationId: me.organizationId, status: "PENDING" } })) return { error: "You already have a request waiting. Cancel it or wait for HR's decision." };
  const r = await prisma.cashAdvance.create({ data: { organizationId: me.organizationId, employeeId: emp.id, amountCents: cents, installments: 1, reason: parsed.data.reason } });
  await audit(me.id, "cash_advance.requested", "CashAdvance", r.id, { amountCents: cents, installments: 1 }, me.organizationId);
  const hr = await prisma.user.findMany({ where: { organizationId: me.organizationId, active: true, role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN] } } }, select: { id: true } });
  await notify(me.organizationId, hr.map((u) => u.id), { title: `${me.name} asked for a cash advance of ${formatMoney(cents)}`, body: parsed.data.reason, href: "/cash-advance" }, me.id);
  done();
  return { ok: `Requested ${formatMoney(cents)}. HR will confirm.` };
}

export async function cancelCashAdvance(id: string) {
  const me = await requireUser("/cash-advance");
  const emp = await getMyEmployee(me);
  const n = await prisma.cashAdvance.updateMany({ where: { id, employeeId: emp.id, organizationId: me.organizationId, status: "PENDING" }, data: { status: "CANCELLED" } });
  if (n.count) await audit(me.id, "cash_advance.cancelled", "CashAdvance", id, undefined, me.organizationId);
  done();
}

// HR (or a Super Admin) confirms/decides the cash advance request.
export async function decideCashAdvance(id: string, decision: "APPROVED" | "REJECTED", _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/cash-advance");
  if (!isHr(me.role.key)) return { error: "Only HR can decide cash advances." };
  const note = z.string().trim().max(300).optional().parse(form.get("note") ?? undefined);
  if (decision === "REJECTED" && (note ?? "").length < 3) return { error: "Give a short reason for rejecting." };
  const r = await prisma.cashAdvance.findFirst({ where: { id, organizationId: me.organizationId, status: "PENDING" } });
  if (!r) return { error: "This request was already handled." };
  const mine = await getMyEmployee(me);
  if (r.employeeId === mine.id && me.role.key !== ROLES.SUPER_ADMIN) return { error: "You cannot approve your own cash advance." };
  // Confirming does not deduct anything: HR decides later on which payslip it comes off (setCashAdvanceDeduction).
  const n = await prisma.cashAdvance.updateMany({
    where: { id, status: "PENDING" },
    data: { status: decision, decidedById: me.id, decidedAt: new Date(), decisionNote: note || null, firstCutoff: null, installments: 1 },
  });
  if (!n.count) return { error: "This request was already handled." };
  await audit(me.id, decision === "APPROVED" ? "cash_advance.approved" : "cash_advance.rejected", "CashAdvance", id, { note, amountCents: r.amountCents }, me.organizationId);
  const uid = await userIdOfEmployee(me.organizationId, r.employeeId);
  if (uid) await notify(me.organizationId, [uid], { title: `Your cash advance of ${formatMoney(r.amountCents)} was ${decision === "APPROVED" ? "confirmed" : "rejected"}`, body: decision === "APPROVED" ? "HR will let you know on which payslip it is deducted." : note, href: "/cash-advance" }, me.id);
  done();
  return { ok: decision === "APPROVED" ? "Confirmed. Choose when to deduct it below." : "Rejected." };
}

// HR decides when a confirmed advance comes off pay: the whole amount on one cut-off's payslip, or not yet (empty).
// It can change until a payroll that took it is finalized; after that the deduction is on record.
export async function setCashAdvanceDeduction(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/cash-advance");
  if (!isHr(me.role.key)) return { error: "Only HR can decide deductions." };
  const r = await prisma.cashAdvance.findFirst({ where: { id, organizationId: me.organizationId, status: "APPROVED" }, include: { _count: { select: { payments: true } } } });
  if (!r) return { error: "Advance not found." };
  if (r._count.payments > 0) return { error: "Already deducted on a finalized payslip. It can no longer change." };
  const start = String(form.get("firstCutoff") ?? "");
  const settings = await getOrgSettings(me.organizationId);
  const today = dayKey(new Date(), settings.timezone);
  if (start) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || cutoffFor(start).start !== start) return { error: "Choose the cut-off to deduct it on." };
    if (start < cutoffFor(today).start) return { error: "Choose the current cut-off or a later one." };
    const final = await prisma.payrollPeriod.findFirst({ where: { organizationId: me.organizationId, kind: "REGULAR", status: "FINALIZED", startDate: { lte: dbDate(cutoffFor(start).end) }, endDate: { gte: dbDate(start) } } });
    if (final) return { error: `${final.name} is already finalized. Choose a later cut-off.` };
  }
  await prisma.cashAdvance.update({ where: { id }, data: { firstCutoff: start ? dbDate(start) : null, installments: 1 } });
  await audit(me.id, start ? "cash_advance.deduction_set" : "cash_advance.deduction_cleared", "CashAdvance", id, { from: r.firstCutoff, to: start || null }, me.organizationId);
  const uid = await userIdOfEmployee(me.organizationId, r.employeeId);
  if (uid) await notify(me.organizationId, [uid], { title: start ? `Your cash advance of ${formatMoney(r.amountCents)} will be deducted on the ${cutoffFor(start).name} payslip` : "Your cash advance deduction was put on hold", href: "/cash-advance" }, me.id);
  await prisma.payrollPeriod.updateMany({ where: { organizationId: me.organizationId, calculatedById: null, status: { in: ["DRAFT", "CALCULATED"] } }, data: { calculatedAt: null } });
  done();
  return { ok: start ? `Will be deducted on the ${cutoffFor(start).name} payslip.` : "Not deducted for now." };
}
