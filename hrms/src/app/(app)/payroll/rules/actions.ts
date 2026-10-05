"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { parsePesos } from "@/lib/money";
import { leavePresetsFor } from "@/lib/ph/leaves";
import { PACK_VERSION, packFor } from "@/lib/ph/pack";
import { findOverlap, parseParams, type RuleKind, type RuleRow } from "@/lib/ph/rules";
import { addDays, dbDate, keyOfDbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const done = () => {
  revalidatePath("/payroll/rules");
  revalidatePath("/payroll/setup");
};
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const scope = z.enum(["PRIVATE", "GOVERNMENT", "BOTH"]);
const KINDS = ["SSS", "PERCENT_CONTRIBUTION", "WITHHOLDING_TABLE", "ANNUAL_TAX_TABLE", "DE_MINIMIS", "BENEFITS_POOL", "PREMIUM_PAY", "INCENTIVE"] as const;

const toRow = (r: { id: string; code: string; kind: RuleKind; sector: "ALL" | "PRIVATE" | "GOVERNMENT"; effectiveFrom: Date; effectiveTo: Date | null; params: unknown }): RuleRow => ({
  id: r.id, code: r.code, kind: r.kind, sector: r.sector, effectiveFrom: keyOfDbDate(r.effectiveFrom), effectiveTo: r.effectiveTo ? keyOfDbDate(r.effectiveTo) : null, params: r.params,
});

// Copies the starter set into this organization. Rows that already exist (same code, sector and dates) are left alone.
export async function installPack(which: "PRIVATE" | "GOVERNMENT" | "BOTH"): Promise<FormState> {
  const me = await requireUser("/payroll");
  const s = scope.safeParse(which);
  if (!s.success) return { error: "Choose private, government or both." };
  const existing = (await prisma.statutoryRule.findMany({ where: { organizationId: me.organizationId } })).map(toRow);
  let added = 0;
  let skipped = 0;
  for (const r of packFor(s.data)) {
    const candidate = { code: r.code, sector: r.sector, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo ?? null };
    if (findOverlap(existing, candidate)) {
      skipped += 1;
      continue;
    }
    const parsed = parseParams(r.kind, r.params);
    if (!parsed.ok) return { error: `Starter rule ${r.code} is invalid: ${parsed.error}` };
    const row = await prisma.statutoryRule.create({
      data: {
        organizationId: me.organizationId, agency: r.agency, code: r.code, kind: r.kind, sector: r.sector, name: r.name, params: parsed.params as object,
        effectiveFrom: dbDate(r.effectiveFrom), effectiveTo: r.effectiveTo ? dbDate(r.effectiveTo) : null, legalBasis: r.legalBasis, note: r.note ?? null, packVersion: PACK_VERSION, createdById: me.id,
      },
    });
    existing.push(toRow(row));
    added += 1;
  }
  await audit(me.id, "payroll.rules_installed", "StatutoryRule", undefined, { scope: s.data, added, skipped, pack: PACK_VERSION }, me.organizationId);
  done();
  return { ok: `${added} rule${added === 1 ? "" : "s"} added${skipped ? `, ${skipped} already there` : ""}. Version ${PACK_VERSION}.` };
}

export async function addRuleVersion(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const p = z
    .object({
      code: z.string().trim().regex(/^[A-Z0-9_]{2,40}$/, "The code uses capital letters, digits and underscores, for example DM_RICE."),
      kind: z.enum(KINDS, "Choose what kind of rule this is."),
      sector: z.enum(["ALL", "PRIVATE", "GOVERNMENT"]),
      name: z.string().trim().min(3, "Give the rule a name.").max(80),
      effectiveFrom: day,
      effectiveTo: z.string().optional(),
      legalBasis: z.string().trim().min(5, "Say where this comes from (law, circular or contract).").max(400),
      note: z.string().trim().max(400).optional(),
      params: z.string().min(2, "Enter the parameters."),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const to = d.effectiveTo ? day.safeParse(d.effectiveTo) : null;
  if (to && !to.success) return { error: "The end date is not a date." };
  if (to?.success && to.data < d.effectiveFrom) return { error: "The end date is before the start date." };
  let json: unknown;
  try {
    json = JSON.parse(d.params);
  } catch {
    return { error: "The parameters are not valid JSON. Copy the current ones and change only the numbers." };
  }
  const checked = parseParams(d.kind as RuleKind, json);
  if (!checked.ok) return { error: `Parameters: ${checked.error}` };

  const sameCode = await prisma.statutoryRule.findMany({ where: { organizationId: me.organizationId, code: d.code } });
  if (sameCode.some((r) => r.kind !== d.kind)) return { error: `${d.code} is already used for a different kind of rule.` };
  const rows = sameCode.map(toRow);
  const candidate = { code: d.code, sector: d.sector, effectiveFrom: d.effectiveFrom, effectiveTo: to?.success ? to.data : null };
  const clash = findOverlap(rows, candidate);
  if (clash) {
    // A new version that starts after the old one ends it the day before, so the old payrolls keep their old rule.
    if (clash.effectiveFrom < d.effectiveFrom && (!clash.effectiveTo || clash.effectiveTo >= d.effectiveFrom) && !candidate.effectiveTo) {
      const others = rows.filter((r) => r.id !== clash.id);
      const after = others.find((r) => r.sector === d.sector && r.effectiveFrom > d.effectiveFrom);
      if (after) return { error: `A later version starting ${after.effectiveFrom} already exists. Give this one an end date.` };
      await prisma.statutoryRule.update({ where: { id: clash.id }, data: { effectiveTo: dbDate(addDays(d.effectiveFrom, -1)) } });
    } else return { error: `This overlaps a version of ${d.code} that runs from ${clash.effectiveFrom}${clash.effectiveTo ? ` to ${clash.effectiveTo}` : ""}. Change the dates.` };
  }
  const r = await prisma.statutoryRule.create({
    data: {
      organizationId: me.organizationId, agency: String(form.get("agency") ?? "COMPANY").slice(0, 20) || "COMPANY", code: d.code, kind: d.kind, sector: d.sector, name: d.name,
      params: checked.params as object, effectiveFrom: dbDate(d.effectiveFrom), effectiveTo: candidate.effectiveTo ? dbDate(candidate.effectiveTo) : null, legalBasis: d.legalBasis, note: d.note || null, createdById: me.id,
    },
  });
  await audit(me.id, "payroll.rule_added", "StatutoryRule", r.id, { code: d.code, from: d.effectiveFrom }, me.organizationId);
  done();
  return { ok: `${d.code} saved, in force from ${d.effectiveFrom}${clash ? ". The earlier version now ends the day before." : "."}` };
}

export async function endRule(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const to = day.safeParse(form.get("effectiveTo"));
  if (!to.success) return { error: "Choose the last day this version applies." };
  const r = await prisma.statutoryRule.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!r) return { error: "Rule not found." };
  if (to.data < keyOfDbDate(r.effectiveFrom)) return { error: "That is before the rule started." };
  await prisma.statutoryRule.update({ where: { id }, data: { effectiveTo: dbDate(to.data) } });
  await audit(me.id, "payroll.rule_ended", "StatutoryRule", id, { code: r.code, to: to.data }, me.organizationId);
  done();
  return { ok: "Saved." };
}

export async function removeRule(id: string) {
  const me = await requireUser("/payroll");
  const r = await prisma.statutoryRule.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!r) return;
  await prisma.statutoryRule.delete({ where: { id } });
  await audit(me.id, "payroll.rule_removed", "StatutoryRule", id, { code: r.code, from: keyOfDbDate(r.effectiveFrom) }, me.organizationId);
  done();
}

export async function addWageOrder(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const p = z
    .object({ region: z.string().trim().min(2, "Enter the region, for example NCR.").max(60), orderNo: z.string().trim().min(1, "Enter the wage order number.").max(40), sector: z.string().trim().max(60).optional(), effectiveFrom: day, effectiveTo: z.string().optional() })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const rate = parsePesos(form.get("daily"));
  if (!rate || rate <= 0) return { error: "Enter the daily minimum wage in pesos, for example 695.00." };
  if (p.data.effectiveTo && p.data.effectiveTo < p.data.effectiveFrom) return { error: "The end date is before the start date." };
  const w = await prisma.wageOrder.create({
    data: { organizationId: me.organizationId, region: p.data.region, orderNo: p.data.orderNo, sector: p.data.sector || null, dailyMinimumCents: rate, effectiveFrom: dbDate(p.data.effectiveFrom), effectiveTo: p.data.effectiveTo ? dbDate(p.data.effectiveTo) : null },
  });
  await audit(me.id, "payroll.wage_order_added", "WageOrder", w.id, { region: w.region, orderNo: w.orderNo, rate }, me.organizationId);
  done();
  return { ok: `${w.region} wage order ${w.orderNo} saved.` };
}

export async function removeWageOrder(id: string) {
  const me = await requireUser("/payroll");
  const w = await prisma.wageOrder.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!w) return;
  await prisma.wageOrder.delete({ where: { id } });
  await audit(me.id, "payroll.wage_order_removed", "WageOrder", id, { region: w.region }, me.organizationId);
  done();
}

export async function installLeaves(which: "PRIVATE" | "GOVERNMENT" | "BOTH"): Promise<FormState> {
  const me = await requireUser("/payroll");
  const s = scope.safeParse(which);
  if (!s.success) return { error: "Choose private, government or both." };
  const have = new Set((await prisma.leaveType.findMany({ where: { organizationId: me.organizationId }, select: { name: true } })).map((l) => l.name));
  const add = leavePresetsFor(s.data).filter((l) => !have.has(l.name));
  if (add.length) await prisma.leaveType.createMany({ data: add.map((l) => ({ organizationId: me.organizationId, name: l.name, annualDays: l.annualDays, paid: l.paid })) });
  await audit(me.id, "leave.statutory_types_installed", "LeaveType", undefined, { scope: s.data, added: add.length }, me.organizationId);
  revalidatePath("/leave");
  revalidatePath("/payroll/rules");
  return { ok: add.length ? `Added ${add.length} leave type${add.length === 1 ? "" : "s"}: ${add.map((l) => l.name).join(", ")}.` : "Those leave types already exist." };
}
