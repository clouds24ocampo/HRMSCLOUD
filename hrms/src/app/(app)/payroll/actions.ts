"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { parsePesos } from "@/lib/money";
import { calculatePeriod } from "@/lib/payroll-data";
import { getOrgSettings } from "@/lib/settings";
import { ROLES } from "@/lib/roles";
import { daysBetween, dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const key = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose all three dates.");
const done = (id?: string) => {
  revalidatePath("/payroll");
  if (id) revalidatePath(`/payroll/${id}`);
};

export async function createPeriod(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Give the period a name.").max(60),
      startDate: key, endDate: key, payDate: key,
      periodsPerMonth: z.coerce.number().int().refine((n) => [1, 2, 4].includes(n), "Choose how often you pay."),
      kind: z.enum(["REGULAR", "THIRTEENTH_MONTH", "GOV_INCENTIVE"]).default("REGULAR"),
      incentiveCode: z.string().trim().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.startDate > d.endDate) return { error: "The period ends before it starts." };
  if (daysBetween(d.startDate, d.endDate).length > 62) return { error: "A pay period is at most 62 days." };
  if (d.payDate < d.endDate) return { error: "Pay day cannot be before the period ends." };
  const settings = await getOrgSettings(me.organizationId);
  if (d.kind !== "REGULAR" && settings.statutoryProfile !== "PHILIPPINES") return { error: "13th month and government bonus payrolls need the Philippine rules switched on in Pay setup." };
  if (d.kind === "GOV_INCENTIVE" && !d.incentiveCode) return { error: "Choose which government bonus or incentive this pays. Add its rule first if it is not listed." };
  // Regular payrolls must not overlap, or the same days would be paid twice. A 13th month or bonus run pays no days, so it may share dates.
  if (d.kind === "REGULAR") {
    const overlap = await prisma.payrollPeriod.findFirst({ where: { organizationId: me.organizationId, kind: "REGULAR", startDate: { lte: dbDate(d.endDate) }, endDate: { gte: dbDate(d.startDate) } } });
    if (overlap) return { error: `These dates overlap “${overlap.name}”. Overlapping periods would pay the same days twice.` };
  } else {
    const dup = await prisma.payrollPeriod.findFirst({ where: { organizationId: me.organizationId, kind: d.kind, incentiveCode: d.kind === "GOV_INCENTIVE" ? d.incentiveCode : null, payDate: { gte: dbDate(`${d.payDate.slice(0, 4)}-01-01`), lte: dbDate(`${d.payDate.slice(0, 4)}-12-31`) } } });
    if (dup) return { error: `“${dup.name}” already pays this in ${d.payDate.slice(0, 4)}. Paying it twice would double it.` };
  }

  const p = await prisma.payrollPeriod.create({
    data: { organizationId: me.organizationId, name: d.name, startDate: dbDate(d.startDate), endDate: dbDate(d.endDate), payDate: dbDate(d.payDate), periodsPerMonth: d.periodsPerMonth, kind: d.kind, incentiveCode: d.kind === "GOV_INCENTIVE" ? d.incentiveCode : null, yearEnd: form.get("yearEnd") === "on", createdById: me.id },
  });
  await audit(me.id, "payroll.period_created", "PayrollPeriod", p.id, { name: p.name }, me.organizationId);
  done();
  redirect(`/payroll/${p.id}`);
}

export async function calculate(periodId: string): Promise<FormState> {
  const me = await requireUser("/payroll");
  const r = await calculatePeriod(me, periodId);
  if ("error" in r) return { error: r.error };
  await audit(me.id, "payroll.calculated", "PayrollPeriod", periodId, { payslips: r.count, skipped: r.skipped.length }, me.organizationId);
  done(periodId);
  const skip = r.skipped.length ? ` Skipped ${r.skipped.length}: ${r.skipped.slice(0, 5).map((s) => `${s.name} (${s.reason})`).join(", ")}${r.skipped.length > 5 ? "…" : ""}.` : "";
  return { ok: `Calculated ${r.count} payslip${r.count === 1 ? "" : "s"}.${skip}` };
}

// Maker-checker: the person who calculated should not also approve. A Super Admin may, and it is recorded.
export async function approve(periodId: string): Promise<FormState> {
  const me = await requireUser("/payroll");
  const p = await prisma.payrollPeriod.findFirst({ where: { id: periodId, organizationId: me.organizationId } });
  if (!p) return { error: "Pay period not found." };
  if (p.status !== "CALCULATED") return { error: "Only a calculated payroll can be approved." };
  if (!p.calculatedById) return { error: "These are the live, automatic numbers. Press Calculate to confirm the final numbers, then a second person approves." };
  if (p.calculatedById === me.id && me.role.key !== ROLES.SUPER_ADMIN) return { error: "A second person must approve. You calculated this payroll." };
  await prisma.payrollPeriod.update({ where: { id: p.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: me.id } });
  await audit(me.id, "payroll.approved", "PayrollPeriod", p.id, { self: p.calculatedById === me.id }, me.organizationId);
  done(p.id);
  return { ok: "Approved. Finalize it to lock the numbers and release payslips." };
}

export async function finalize(periodId: string): Promise<FormState> {
  const me = await requireUser("/payroll");
  const p = await prisma.payrollPeriod.findFirst({ where: { id: periodId, organizationId: me.organizationId } });
  if (!p) return { error: "Pay period not found." };
  if (p.status !== "APPROVED") return { error: "Approve the payroll before finalizing it." };
  await prisma.payrollPeriod.update({ where: { id: p.id }, data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: me.id } });
  await audit(me.id, "payroll.finalized", "PayrollPeriod", p.id, undefined, me.organizationId);
  const slips = await prisma.payslip.findMany({ where: { periodId: p.id, organizationId: me.organizationId }, select: { id: true, inputs: true, employee: { select: { userId: true } } } });
  // Cash advance installments taken by this payroll become repayment records. Once only, even if finalize runs twice.
  const payments = slips.flatMap((s) => ((s.inputs as { cashAdvances?: { id: string; cents: number }[] } | null)?.cashAdvances ?? []).map((c) => ({ advanceId: c.id, payslipId: s.id, amountCents: c.cents, paidOn: p.payDate })));
  if (payments.length) await prisma.cashAdvancePayment.createMany({ data: payments, skipDuplicates: true });

  // Mark all included accepted incentives as PAID and link to their payslip
  for (const s of slips) {
    const incIds = (s.inputs as { incentiveIds?: string[] } | null)?.incentiveIds ?? [];
    if (incIds.length > 0) {
      await prisma.incentive.updateMany({
        where: { id: { in: incIds }, organizationId: me.organizationId, status: "ACCEPTED" },
        data: { status: "PAID", payslipId: s.id },
      });
    }
  }

  for (const s of slips) if (s.employee.userId) await notify(me.organizationId, [s.employee.userId], { title: `Your payslip for ${p.name} is ready`, href: `/payslips/${s.id}` }, me.id);
  done(p.id);
  return { ok: "Finalized. The numbers are locked and employees can see their payslips." };
}

export async function deletePeriod(periodId: string) {
  const me = await requireUser("/payroll");
  const p = await prisma.payrollPeriod.findFirst({ where: { id: periodId, organizationId: me.organizationId } });
  if (!p || p.status === "FINALIZED") return;
  await prisma.$transaction([
    prisma.payslip.deleteMany({ where: { periodId } }),
    prisma.payrollAdjustment.deleteMany({ where: { periodId } }),
    prisma.payrollPeriod.delete({ where: { id: periodId } }),
  ]);
  await audit(me.id, "payroll.period_deleted", "PayrollPeriod", periodId, { name: p.name }, me.organizationId);
  done();
  redirect("/payroll");
}

// One-off correction. Fixes to a finalized payroll go into the next period, never into the locked one.
export async function addAdjustment(periodId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const parsed = z
    .object({ employeeId: z.string().min(1, "Choose an employee."), kind: z.enum(["EARNING", "DEDUCTION"]), label: z.string().trim().min(2, "Name the adjustment.").max(60), reason: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(300) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const cents = parsePesos(form.get("amount"));
  if (!cents || cents <= 0) return { error: "Enter an amount in pesos, for example 250.00." };
  const [period, emp] = await Promise.all([
    prisma.payrollPeriod.findFirst({ where: { id: periodId, organizationId: me.organizationId } }),
    prisma.employee.findFirst({ where: { id: parsed.data.employeeId, organizationId: me.organizationId } }),
  ]);
  if (!period || !emp) return { error: "Pay period or employee not found." };
  if (period.status === "FINALIZED") return { error: "This payroll is finalized. Add the adjustment to the next period instead." };
  const a = await prisma.payrollAdjustment.create({
    data: { organizationId: me.organizationId, periodId, employeeId: emp.id, kind: parsed.data.kind, label: parsed.data.label, amountCents: cents, reason: parsed.data.reason, createdById: me.id },
  });
  // The numbers on screen no longer match, so it must be calculated again.
  if (period.status !== "DRAFT") await prisma.payrollPeriod.update({ where: { id: periodId }, data: { status: "DRAFT", approvedAt: null, approvedById: null } });
  await audit(me.id, "payroll.adjustment_added", "PayrollAdjustment", a.id, { employeeId: emp.id, kind: a.kind, cents }, me.organizationId);
  done(periodId);
  return { ok: "Adjustment added. Calculate again to include it." };
}

export async function removeAdjustment(id: string) {
  const me = await requireUser("/payroll");
  const a = await prisma.payrollAdjustment.findFirst({ where: { id, organizationId: me.organizationId }, include: { period: true } });
  if (!a || a.period.status === "FINALIZED") return;
  await prisma.payrollAdjustment.delete({ where: { id } });
  if (a.period.status !== "DRAFT") await prisma.payrollPeriod.update({ where: { id: a.periodId }, data: { status: "DRAFT", approvedAt: null, approvedById: null } });
  await audit(me.id, "payroll.adjustment_removed", "PayrollAdjustment", id, undefined, me.organizationId);
  done(a.periodId);
}

// People left out of one payroll (for example someone not eligible for a bonus). The payroll must be calculated again.
export async function setSkipped(periodId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const p = await prisma.payrollPeriod.findFirst({ where: { id: periodId, organizationId: me.organizationId } });
  if (!p) return { error: "Pay period not found." };
  if (p.status === "FINALIZED") return { error: "This payroll is finalized." };
  const ids = form.getAll("skip").map(String);
  const valid = (await prisma.employee.findMany({ where: { organizationId: me.organizationId, id: { in: ids } }, select: { id: true } })).map((e) => e.id);
  await prisma.payrollPeriod.update({ where: { id: p.id }, data: { skipEmployeeIds: valid, ...(p.status !== "DRAFT" ? { status: "DRAFT", approvedAt: null, approvedById: null } : {}) } });
  await audit(me.id, "payroll.skip_list_saved", "PayrollPeriod", p.id, { count: valid.length }, me.organizationId);
  done(p.id);
  return { ok: valid.length ? `${valid.length} left out. Calculate again.` : "Everyone is included. Calculate again." };
}
