"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { firstRepaymentCutoff, MAX_INSTALLMENTS } from "@/lib/cash-advance";
import { cutoffFor, type Cutoff } from "@/lib/cutoffs";
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
      installments: z.coerce.number().int().min(1).max(MAX_INSTALLMENTS, `Repay it over 1 to ${MAX_INSTALLMENTS} cut-offs.`),
      reason: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const cents = parsePesos(form.get("amount"));
  if (!cents || cents < 10_000) return { error: "Enter the amount in pesos, at least 100.00." };
  if (cents > 100_000_000) return { error: "That amount is too large. Talk to HR." };
  const emp = await getMyEmployee(me);
  if (await prisma.cashAdvance.findFirst({ where: { employeeId: emp.id, organizationId: me.organizationId, status: "PENDING" } })) return { error: "You already have a request waiting. Cancel it or wait for HR's decision." };
  const r = await prisma.cashAdvance.create({ data: { organizationId: me.organizationId, employeeId: emp.id, amountCents: cents, installments: parsed.data.installments, reason: parsed.data.reason } });
  await audit(me.id, "cash_advance.requested", "CashAdvance", r.id, { amountCents: cents, installments: r.installments }, me.organizationId);
  const hr = await prisma.user.findMany({ where: { organizationId: me.organizationId, active: true, role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN] } } }, select: { id: true } });
  await notify(me.organizationId, hr.map((u) => u.id), { title: `${me.name} asked for a cash advance of ${formatMoney(cents)}`, body: parsed.data.reason, href: "/cash-advance" }, me.id);
  done();
  return { ok: `Requested ${formatMoney(cents)}. HR will decide.` };
}

export async function cancelCashAdvance(id: string) {
  const me = await requireUser("/cash-advance");
  const emp = await getMyEmployee(me);
  const n = await prisma.cashAdvance.updateMany({ where: { id, employeeId: emp.id, organizationId: me.organizationId, status: "PENDING" }, data: { status: "CANCELLED" } });
  if (n.count) await audit(me.id, "cash_advance.cancelled", "CashAdvance", id, undefined, me.organizationId);
  done();
}

// HR picks when it comes off pay: the cut-off it starts in, and over how many cut-offs (1 = whole amount at once).
// Only the current cut-off or a later one: a cut-off already paid cannot take an installment.
function readSchedule(form: FormData, today: string) {
  const start = String(form.get("firstCutoff") ?? "");
  const n = Number(form.get("installments"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || cutoffFor(start).start !== start) return { error: "Choose the cut-off to start deducting." };
  if (start < cutoffFor(today).start) return { error: "Choose the current cut-off or a later one." };
  if (!Number.isInteger(n) || n < 1 || n > MAX_INSTALLMENTS) return { error: `Deduct it over 1 to ${MAX_INSTALLMENTS} cut-offs.` };
  return { start, n };
}

// HR (or a Super Admin) decides, and on approval sets the repayment schedule.
export async function decideCashAdvance(id: string, decision: "APPROVED" | "REJECTED", _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/cash-advance");
  if (!isHr(me.role.key)) return { error: "Only HR can decide cash advances." };
  const note = z.string().trim().max(300).optional().parse(form.get("note") ?? undefined);
  if (decision === "REJECTED" && (note ?? "").length < 3) return { error: "Give a short reason for rejecting." };
  const r = await prisma.cashAdvance.findFirst({ where: { id, organizationId: me.organizationId, status: "PENDING" } });
  if (!r) return { error: "This request was already handled." };
  const mine = await getMyEmployee(me);
  if (r.employeeId === mine.id && me.role.key !== ROLES.SUPER_ADMIN) return { error: "You cannot approve your own cash advance." };
  const settings = await getOrgSettings(me.organizationId);
  const today = dayKey(new Date(), settings.timezone);
  let first: Cutoff | null = null;
  let installments = r.installments;
  if (decision === "APPROVED") {
    const sch = form.has("firstCutoff") ? readSchedule(form, today) : { start: firstRepaymentCutoff(today).start, n: r.installments };
    if ("error" in sch) return { error: sch.error };
    first = cutoffFor(sch.start);
    installments = sch.n;
  }
  const n = await prisma.cashAdvance.updateMany({
    where: { id, status: "PENDING" },
    data: { status: decision, decidedById: me.id, decidedAt: new Date(), decisionNote: note || null, firstCutoff: first ? dbDate(first.start) : null, installments },
  });
  if (!n.count) return { error: "This request was already handled." };
  await audit(me.id, decision === "APPROVED" ? "cash_advance.approved" : "cash_advance.rejected", "CashAdvance", id, { note, amountCents: r.amountCents, requestedInstallments: r.installments, installments, firstCutoff: first?.start }, me.organizationId);
  const uid = await userIdOfEmployee(me.organizationId, r.employeeId);
  if (uid) await notify(me.organizationId, [uid], { title: `Your cash advance of ${formatMoney(r.amountCents)} was ${decision === "APPROVED" ? "approved" : "rejected"}`, body: first ? `${installments === 1 ? "Deducted in full" : `Deducted over ${installments} cut-offs`} from the ${first.name} cut-off.` : note, href: "/cash-advance" }, me.id);
  // Live cut-offs pick the installment up on the next view.
  await prisma.payrollPeriod.updateMany({ where: { organizationId: me.organizationId, calculatedById: null, status: { in: ["DRAFT", "CALCULATED"] } }, data: { calculatedAt: null } });
  done();
  return { ok: decision === "APPROVED" ? `Approved. ${installments === 1 ? "Deducted in full" : `Deducted over ${installments} cut-offs`} from the ${first!.name} cut-off.` : "Rejected." };
}

// HR moves the schedule of an approved advance, as long as nothing has been repaid yet (repaid installments are on record).
export async function rescheduleCashAdvance(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/cash-advance");
  if (!isHr(me.role.key)) return { error: "Only HR can change the schedule." };
  const r = await prisma.cashAdvance.findFirst({ where: { id, organizationId: me.organizationId, status: "APPROVED" }, include: { _count: { select: { payments: true } } } });
  if (!r) return { error: "Advance not found." };
  if (r._count.payments > 0) return { error: "Installments were already repaid, so the schedule can no longer change." };
  const settings = await getOrgSettings(me.organizationId);
  const sch = readSchedule(form, dayKey(new Date(), settings.timezone));
  if ("error" in sch) return { error: sch.error };
  await prisma.cashAdvance.update({ where: { id }, data: { firstCutoff: dbDate(sch.start), installments: sch.n } });
  await audit(me.id, "cash_advance.rescheduled", "CashAdvance", id, { from: { firstCutoff: r.firstCutoff, installments: r.installments }, to: { firstCutoff: sch.start, installments: sch.n } }, me.organizationId);
  const uid = await userIdOfEmployee(me.organizationId, r.employeeId);
  if (uid) await notify(me.organizationId, [uid], { title: "Your cash advance repayment schedule changed", body: `${sch.n === 1 ? "In full" : `Over ${sch.n} cut-offs`} from ${cutoffFor(sch.start).name}.`, href: "/cash-advance" }, me.id);
  await prisma.payrollPeriod.updateMany({ where: { organizationId: me.organizationId, calculatedById: null, status: { in: ["DRAFT", "CALCULATED"] } }, data: { calculatedAt: null } });
  done();
  return { ok: "Schedule changed. Payroll picks it up on the next calculation." };
}
