"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { parsePercent, parsePesos } from "@/lib/money";
import { getOrgSettings } from "@/lib/settings";
import type { FormState } from "@/app/login/actions";

const done = () => revalidatePath("/payroll/setup");
const name = z.string().trim().min(2, "Enter a name.").max(60);

export async function saveFactors(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const parsed = z
    .object({
      workDaysPerMonth: z.coerce.number().int().min(1).max(31, "Work days per month is between 1 and 31."),
      hoursPerDay: z.coerce.number().int().min(1).max(24, "Hours per day is between 1 and 24."),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const mult = parsePercent(String(form.get("otMultiplierPct") ?? ""));
  if (mult === null || mult < 10000) return { error: "Overtime rate is a percentage of normal pay, at least 100." };
  await getOrgSettings(me.organizationId);
  await prisma.orgSettings.update({ where: { organizationId: me.organizationId }, data: { ...parsed.data, otMultiplierBp: mult } });
  await audit(me.id, "payroll.factors_saved", "OrgSettings", undefined, { ...parsed.data, otMultiplierBp: mult }, me.organizationId);
  done();
  return { ok: "Saved. It applies the next time a payroll is calculated." };
}

export async function addComponent(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const parsed = z.object({ name, kind: z.enum(["EARNING", "DEDUCTION"]), calc: z.enum(["FIXED", "PERCENT_OF_BASIC"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const raw = String(form.get("value") ?? "");
  const value = parsed.data.calc === "FIXED" ? parsePesos(raw) : parsePercent(raw);
  if (value === null || value <= 0) return { error: parsed.data.calc === "FIXED" ? "Enter an amount in pesos, for example 1000.00." : "Enter a percentage, for example 10 or 2.5." };
  if (await prisma.payComponent.findUnique({ where: { organizationId_name: { organizationId: me.organizationId, name: parsed.data.name } } })) return { error: "A pay item with this name already exists." };
  // "Counts as taxable pay" is the everyday switch. The special treatments below it are for the Philippine rules.
  const treatment = String(form.get("treatment") ?? "");
  const code = String(form.get("deMinimisCode") ?? "").trim();
  if (treatment === "DE_MINIMIS" && !code) return { error: "Pick which de minimis benefit this pays." };
  const taxClass = treatment === "DE_MINIMIS" ? "DE_MINIMIS" : treatment === "OTHER_BENEFIT" ? "OTHER_BENEFIT" : form.get("taxable") === "on" ? "TAXABLE" : "EXEMPT";
  const c = await prisma.payComponent.create({
    data: {
      organizationId: me.organizationId, ...parsed.data, value, taxClass, deMinimisCode: taxClass === "DE_MINIMIS" ? code : null,
      preTax: parsed.data.kind === "DEDUCTION" && form.get("preTax") === "on",
      inContributionBase: parsed.data.kind === "EARNING" && form.get("inContributionBase") === "on",
      mweExempt: parsed.data.kind === "EARNING" && form.get("mweExempt") === "on",
    },
  });
  await audit(me.id, "payroll.component_created", "PayComponent", c.id, { name: c.name, kind: c.kind }, me.organizationId);
  done();
  return { ok: `${c.name} added. Assign it to people from their profile.` };
}

export async function setComponentArchived(id: string, archived: boolean) {
  const me = await requireUser("/payroll");
  const c = await prisma.payComponent.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!c) return;
  await prisma.payComponent.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(me.id, archived ? "payroll.component_archived" : "payroll.component_restored", "PayComponent", id, { name: c.name }, me.organizationId);
  done();
}

export async function addContribution(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const n = name.safeParse(form.get("name"));
  if (!n.success) return { error: n.error.issues[0].message };
  const employeeBp = parsePercent(String(form.get("employeePct") ?? ""));
  const employerBp = parsePercent(String(form.get("employerPct") ?? ""));
  if (employeeBp === null || employerBp === null) return { error: "Enter the employee and employer share as percentages, for example 4.5." };
  const minBase = form.get("minBase") ? parsePesos(form.get("minBase")) : 0;
  const maxRaw = String(form.get("maxBase") ?? "").trim();
  const maxBase = maxRaw ? parsePesos(maxRaw) : null;
  if (minBase === null || (maxRaw && maxBase === null)) return { error: "Limits must be amounts in pesos." };
  if (maxBase !== null && maxBase < minBase) return { error: "The upper limit is below the lower limit." };
  if (await prisma.contributionRule.findUnique({ where: { organizationId_name: { organizationId: me.organizationId, name: n.data } } })) return { error: "A contribution with this name already exists." };
  const c = await prisma.contributionRule.create({ data: { organizationId: me.organizationId, name: n.data, employeeBp, employerBp, minBaseCents: minBase, maxBaseCents: maxBase } });
  await audit(me.id, "payroll.contribution_created", "ContributionRule", c.id, { name: c.name, employeeBp, employerBp }, me.organizationId);
  done();
  return { ok: `${c.name} added.` };
}

export async function setContributionArchived(id: string, archived: boolean) {
  const me = await requireUser("/payroll");
  const c = await prisma.contributionRule.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!c) return;
  await prisma.contributionRule.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(me.id, archived ? "payroll.contribution_archived" : "payroll.contribution_restored", "ContributionRule", id, { name: c.name }, me.organizationId);
  done();
}

export async function addBracket(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const from = parsePesos(String(form.get("from") ?? ""));
  const rate = parsePercent(String(form.get("ratePct") ?? ""));
  const fixed = form.get("fixed") ? parsePesos(form.get("fixed")) : 0;
  if (from === null) return { error: "Enter where the bracket starts, in pesos (0 for the first one)." };
  if (rate === null) return { error: "Enter the rate as a percentage, for example 20." };
  if (fixed === null) return { error: "The fixed amount must be in pesos." };
  const b = await prisma.taxBracket.create({ data: { organizationId: me.organizationId, fromCents: from, rateBp: rate, fixedCents: fixed } });
  await audit(me.id, "payroll.bracket_created", "TaxBracket", b.id, { from, rate, fixed }, me.organizationId);
  done();
  return { ok: "Bracket added." };
}

export async function removeBracket(id: string) {
  const me = await requireUser("/payroll");
  const b = await prisma.taxBracket.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!b) return;
  await prisma.taxBracket.delete({ where: { id } });
  await audit(me.id, "payroll.bracket_removed", "TaxBracket", id, undefined, me.organizationId);
  done();
}

export async function savePhSettings(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const parsed = z.object({ statutoryProfile: z.enum(["MANUAL", "PHILIPPINES"]), contributionSchedule: z.enum(["EVERY_PERIOD", "LAST_PERIOD"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Choose how payroll gets its rates." };
  if (parsed.data.statutoryProfile === "PHILIPPINES" && (await prisma.statutoryRule.count({ where: { organizationId: me.organizationId } })) === 0) {
    return { error: "Install the Philippine rules first (Philippine rules page), then switch this on." };
  }
  await getOrgSettings(me.organizationId);
  await prisma.orgSettings.update({ where: { organizationId: me.organizationId }, data: parsed.data });
  await audit(me.id, "payroll.profile_saved", "OrgSettings", undefined, parsed.data, me.organizationId);
  done();
  return { ok: "Saved. It applies the next time a payroll is calculated." };
}
