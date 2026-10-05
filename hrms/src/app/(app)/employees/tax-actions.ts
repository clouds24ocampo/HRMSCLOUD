"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { parsePesos } from "@/lib/money";
import { dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const id = z.string().trim().max(30).optional();

async function hrEmployee(employeeId: string) {
  const me = await requireUser("/payroll"); // HR and Super Admin
  const e = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, select: { id: true, firstName: true, lastName: true } });
  return { me, e };
}

// A change starts on its date; earlier settings stay for the payslips that used them.
export async function saveTaxProfile(employeeId: string, _: FormState, form: FormData): Promise<FormState> {
  const { me, e } = await hrEmployee(employeeId);
  if (!e) return { error: "Employee not found." };
  const p = z
    .object({
      sector: z.enum(["PRIVATE", "GOVERNMENT"]), wageBasis: z.enum(["SIX_DAY_313", "FIVE_DAY_261", "ALL_DAYS_365", "CUSTOM"]), customFactor: z.coerce.number().int().optional(),
      wageRegion: z.string().trim().max(60).optional(), effectiveFrom: day, note: z.string().trim().max(200).optional(),
      tin: id, sssNo: id, philhealthNo: id, pagibigNo: id, gsisNo: id,
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (d.wageBasis === "CUSTOM" && !(d.customFactor && d.customFactor >= 200 && d.customFactor <= 366)) return { error: "For a custom basis, enter the days a year (between 200 and 366)." };
  const data = {
    sector: d.sector, mwe: form.get("mwe") === "on", wageBasis: d.wageBasis, customFactor: d.wageBasis === "CUSTOM" ? d.customFactor! : null, wageRegion: d.wageRegion || null,
    socialCovered: form.get("socialCovered") === "on", philhealthCovered: form.get("philhealthCovered") === "on", pagibigCovered: form.get("pagibigCovered") === "on", withholdingApplies: form.get("withholdingApplies") === "on",
    tin: d.tin || null, sssNo: d.sssNo || null, philhealthNo: d.philhealthNo || null, pagibigNo: d.pagibigNo || null, gsisNo: d.gsisNo || null, note: d.note || null,
  };
  const same = await prisma.employeeTaxProfile.findFirst({ where: { employeeId, organizationId: me.organizationId, effectiveFrom: dbDate(d.effectiveFrom) } });
  const row = same
    ? await prisma.employeeTaxProfile.update({ where: { id: same.id }, data })
    : await prisma.employeeTaxProfile.create({ data: { organizationId: me.organizationId, employeeId, effectiveFrom: dbDate(d.effectiveFrom), createdById: me.id, ...data } });
  await audit(me.id, "employee.tax_profile_saved", "EmployeeTaxProfile", row.id, { employeeId, sector: d.sector, mwe: data.mwe, from: d.effectiveFrom }, me.organizationId);
  revalidatePath(`/employees/${employeeId}`);
  return { ok: `Tax profile of ${e.firstName} ${e.lastName} saved from ${d.effectiveFrom}.` };
}

// What an earlier employer already withheld this year (from their BIR 2316), so annualization counts it.
export async function addPreviousEmployment(employeeId: string, _: FormState, form: FormData): Promise<FormState> {
  const { me, e } = await hrEmployee(employeeId);
  if (!e) return { error: "Employee not found." };
  const p = z.object({ year: z.coerce.number().int().min(2020).max(2100, "Enter the year, for example 2026."), employerName: z.string().trim().min(2, "Enter the earlier employer.").max(80), note: z.string().trim().max(200).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const money = (k: string, required = false) => {
    const raw = String(form.get(k) ?? "").trim();
    if (!raw) return required ? null : 0;
    const v = parsePesos(raw);
    return v === null ? null : v;
  };
  const [gross, taxable, nonTaxable, exempt, benTaxable, mandatory, withheld] = [money("gross", true), money("taxable", true), money("nonTaxable"), money("benefitsExempt"), money("benefitsTaxable"), money("mandatory"), money("withheld", true)];
  if ([gross, taxable, nonTaxable, exempt, benTaxable, mandatory, withheld].some((v) => v === null)) return { error: "Enter every amount in pesos, for example 150000.00. Gross, taxable and tax withheld are required." };
  const row = await prisma.previousEmployment.create({
    data: {
      organizationId: me.organizationId, employeeId, year: p.data.year, employerName: p.data.employerName, grossCents: gross!, taxableCents: taxable!, nonTaxableCents: nonTaxable!,
      benefitsExemptCents: exempt!, benefitsTaxableCents: benTaxable!, mandatoryCents: mandatory!, taxWithheldCents: withheld!, note: p.data.note || null,
    },
  });
  await audit(me.id, "employee.previous_employment_added", "PreviousEmployment", row.id, { employeeId, year: p.data.year, employer: p.data.employerName }, me.organizationId);
  revalidatePath(`/employees/${employeeId}`);
  return { ok: "Saved. It counts in this year's tax adjustment." };
}

export async function removePreviousEmployment(employeeId: string, rowId: string) {
  const { me, e } = await hrEmployee(employeeId);
  if (!e) return;
  const r = await prisma.previousEmployment.findFirst({ where: { id: rowId, employeeId, organizationId: me.organizationId } });
  if (!r) return;
  await prisma.previousEmployment.delete({ where: { id: rowId } });
  await audit(me.id, "employee.previous_employment_removed", "PreviousEmployment", rowId, { employeeId }, me.organizationId);
  revalidatePath(`/employees/${employeeId}`);
}
