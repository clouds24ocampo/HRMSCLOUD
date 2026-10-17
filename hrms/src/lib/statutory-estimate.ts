// Government-mandated contributions (SSS or GSIS, PhilHealth, Pag-IBIG) and withholding tax for each person's monthly salary.
// Shown to HR on Home whether or not they are taken off pay (OrgSettings.deductStatutory). Same arithmetic as the payroll:
// the functions in ph/calc.ts, with the organization's installed rules, or the built-in starter rules when none are installed.
import { prisma } from "@/lib/prisma";
import { PACK } from "@/lib/ph/pack";
import { bracketTax, percentContribution, rates, sssContribution } from "@/lib/ph/calc";
import { parseParams, pickRule, type RuleKind, type RuleRow, type Sector } from "@/lib/ph/rules";
import { dbDate, keyOfDbDate } from "@/lib/time";

export type Share = { ee: number; er: number };
export type GovEstimate = { social: Share & { label: "SSS" | "GSIS" }; philhealth: Share; pagibig: Share; taxCents: number; eeTotal: number; erTotal: number };
type Cover = { sector: Sector; social: boolean; philhealth: boolean; pagibig: boolean; withholding: boolean };
const ALL_ON: Cover = { sector: "PRIVATE", social: true, philhealth: true, pagibig: true, withholding: true };

// Pure: one month's contributions and tax for a monthly salary, with the rules in force on `day`.
export function estimateMonth(monthlyCents: number, rules: RuleRow[], day: string, c: Cover = ALL_ON): GovEstimate {
  const get = <K extends RuleKind>(code: string, kind: K) => {
    const r = pickRule(rules, code, day, c.sector);
    const p = r ? parseParams(kind, r.params) : null;
    return p?.ok ? p.params : null;
  };
  const zero = { ee: 0, er: 0 };
  let social: GovEstimate["social"] = { ...zero, label: c.sector === "GOVERNMENT" ? "GSIS" : "SSS" };
  if (c.social && c.sector === "PRIVATE") {
    const p = get("SSS", "SSS");
    if (p) {
      const r = sssContribution(monthlyCents, p);
      social = { label: "SSS", ee: r.employeeCents, er: r.employerCents + r.ecCents };
    }
  } else if (c.social) {
    const p = get("GSIS", "PERCENT_CONTRIBUTION");
    if (p) {
      const r = percentContribution(monthlyCents, p);
      social = { label: "GSIS", ee: r.employeeCents, er: r.employerCents };
    }
  }
  const pct = (code: string, on: boolean): Share => {
    const p = on ? get(code, "PERCENT_CONTRIBUTION") : null;
    if (!p) return zero;
    const r = percentContribution(monthlyCents, p);
    return { ee: r.employeeCents, er: r.employerCents };
  };
  const philhealth = pct("PHILHEALTH", c.philhealth);
  const pagibig = pct("PAGIBIG", c.pagibig);
  const contrib = social.ee + philhealth.ee + pagibig.ee;
  const table = c.withholding ? get("WT_MONTHLY", "WITHHOLDING_TABLE") : null;
  const taxCents = table ? bracketTax(table.brackets, Math.max(0, monthlyCents - contrib)) : 0;
  return { social, philhealth, pagibig, taxCents, eeTotal: contrib + taxCents, erTotal: social.er + philhealth.er + pagibig.er };
}

export const STARTER_RULES: RuleRow[] = PACK.map((r) => ({ id: r.code, code: r.code, kind: r.kind, sector: r.sector, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo ?? null, params: r.params }));

export async function governmentEstimates(organizationId: string, today: string, daysPerYear: number, hoursPerDay: number) {
  const [installed, comps, profiles, people] = await Promise.all([
    prisma.statutoryRule.findMany({ where: { organizationId } }),
    prisma.compensation.findMany({ where: { organizationId, effectiveFrom: { lte: dbDate(today) } }, orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }] }),
    prisma.employeeTaxProfile.findMany({ where: { organizationId, effectiveFrom: { lte: dbDate(today) } }, orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }] }),
    prisma.employee.findMany({ where: { organizationId, status: { not: "SEPARATED" } }, select: { id: true, firstName: true, lastName: true, employeeNo: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  const rules: RuleRow[] = installed.length
    ? installed.map((r) => ({ id: r.id, code: r.code, kind: r.kind, sector: r.sector, effectiveFrom: keyOfDbDate(r.effectiveFrom), effectiveTo: r.effectiveTo ? keyOfDbDate(r.effectiveTo) : null, params: r.params }))
    : STARTER_RULES;
  const latest = <T extends { employeeId: string }>(rows: T[], id: string) => rows.filter((r) => r.employeeId === id).pop();
  const rows = people.flatMap((e) => {
    const comp = latest(comps, e.id);
    if (!comp) return [];
    const monthlyCents = rates(comp.payType, comp.rateCents, daysPerYear, hoursPerDay).monthly;
    const p = latest(profiles, e.id);
    const est = estimateMonth(monthlyCents, rules, today, p ? { sector: p.sector, social: p.socialCovered, philhealth: p.philhealthCovered, pagibig: p.pagibigCovered, withholding: p.withholdingApplies && !p.mwe } : ALL_ON);
    return [{ id: e.id, name: `${e.firstName} ${e.lastName}`, employeeNo: e.employeeNo, monthlyCents, ...est }];
  });
  const totals = rows.reduce((t, r) => ({ ee: t.ee + r.eeTotal, er: t.er + r.erTotal, tax: t.tax + r.taxCents }), { ee: 0, er: 0, tax: 0 });
  return { rows, totals, starter: installed.length === 0 };
}
