// Remittance and BIR figures, summed from finalized payslips. The payslip already stores every number, so nothing is recomputed here.
import { prisma } from "@/lib/prisma";
import { bracketTax } from "@/lib/ph/calc";
import { parseParams, pickRule, type RuleRow } from "@/lib/ph/rules";
import { dbDate, keyOfDbDate } from "@/lib/time";

export type Agency = "SSS" | "GSIS" | "PHILHEALTH" | "PAGIBIG";
export const AGENCY_LABEL: Record<Agency, string> = { SSS: "SSS", GSIS: "GSIS", PHILHEALTH: "PhilHealth", PAGIBIG: "Pag-IBIG" };
// Payslip line labels written by the Philippine calculator.
const LINE: Record<string, { agency: Agency; part: "employee" | "employer" | "ec" }> = {
  SSS: { agency: "SSS", part: "employee" }, "SSS (employer share)": { agency: "SSS", part: "employer" }, "SSS EC (employer only)": { agency: "SSS", part: "ec" },
  GSIS: { agency: "GSIS", part: "employee" }, "GSIS (employer share)": { agency: "GSIS", part: "employer" },
  PhilHealth: { agency: "PHILHEALTH", part: "employee" }, "PhilHealth (employer share)": { agency: "PHILHEALTH", part: "employer" },
  "Pag-IBIG": { agency: "PAGIBIG", part: "employee" }, "Pag-IBIG (employer share)": { agency: "PAGIBIG", part: "employer" },
};

export type RemitRow = { employeeId: string; employeeNo: string; name: string; idNo: string; tin: string; employeeCents: number; employerCents: number; ecCents: number };

export function sumRemittance(
  slips: { employeeId: string; employeeNo: string; employeeName: string; lines: { label: string; amountCents: number }[] }[],
  ids: Map<string, { sssNo?: string | null; gsisNo?: string | null; philhealthNo?: string | null; pagibigNo?: string | null; tin?: string | null }>,
): Record<Agency, RemitRow[]> {
  const out: Record<Agency, Map<string, RemitRow>> = { SSS: new Map(), GSIS: new Map(), PHILHEALTH: new Map(), PAGIBIG: new Map() };
  for (const s of slips) {
    for (const l of s.lines) {
      const m = LINE[l.label];
      if (!m || l.amountCents === 0) continue;
      const p = ids.get(s.employeeId);
      const idNo = (m.agency === "SSS" ? p?.sssNo : m.agency === "GSIS" ? p?.gsisNo : m.agency === "PHILHEALTH" ? p?.philhealthNo : p?.pagibigNo) ?? "";
      const row = out[m.agency].get(s.employeeId) ?? { employeeId: s.employeeId, employeeNo: s.employeeNo, name: s.employeeName, idNo, tin: p?.tin ?? "", employeeCents: 0, employerCents: 0, ecCents: 0 };
      if (m.part === "employee") row.employeeCents += l.amountCents;
      else if (m.part === "employer") row.employerCents += l.amountCents;
      else row.ecCents += l.amountCents;
      out[m.agency].set(s.employeeId, row);
    }
  }
  const sorted = (m: Map<string, RemitRow>) => [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { SSS: sorted(out.SSS), GSIS: sorted(out.GSIS), PHILHEALTH: sorted(out.PHILHEALTH), PAGIBIG: sorted(out.PAGIBIG) };
}

export type Summary1601 = {
  employees: number; grossCents: number; mweExemptCents: number; benefitsExemptCents: number; otherNonTaxableCents: number; mandatoryCents: number;
  taxableCents: number; benefitsTaxableCents: number; taxWithheldCents: number; netCents: number;
};
export function sum1601(slips: { grossCents: number; netCents: number; taxableCents: number; taxWithheldCents: number; nonTaxableCents: number; mweExemptCents: number; mandatoryEeCents: number; benefitsExemptCents: number; benefitsTaxableCents: number }[], employees: number): Summary1601 {
  const t = (f: (s: (typeof slips)[number]) => number) => slips.reduce((n, s) => n + f(s), 0);
  return {
    employees, grossCents: t((s) => s.grossCents), mweExemptCents: t((s) => s.mweExemptCents), benefitsExemptCents: t((s) => s.benefitsExemptCents),
    otherNonTaxableCents: t((s) => s.nonTaxableCents) - t((s) => s.benefitsExemptCents), mandatoryCents: t((s) => s.mandatoryEeCents),
    taxableCents: t((s) => s.taxableCents), benefitsTaxableCents: t((s) => s.benefitsTaxableCents), taxWithheldCents: t((s) => s.taxWithheldCents), netCents: t((s) => s.netCents),
  };
}

export async function loadMonth(orgId: string, month: string) {
  const from = dbDate(`${month}-01`);
  const to = dbDate(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10));
  const periods = await prisma.payrollPeriod.findMany({ where: { organizationId: orgId, payDate: { gte: from, lte: to } }, select: { id: true, name: true, status: true } });
  const finalized = periods.filter((p) => p.status === "FINALIZED");
  const slips = await prisma.payslip.findMany({
    where: { organizationId: orgId, periodId: { in: finalized.map((p) => p.id) } },
    select: { employeeId: true, employeeNo: true, employeeName: true, grossCents: true, netCents: true, taxableCents: true, taxWithheldCents: true, nonTaxableCents: true, mweExemptCents: true, mandatoryEeCents: true, benefitsExemptCents: true, benefitsTaxableCents: true, lines: { select: { label: true, amountCents: true } } },
  });
  const profiles = await prisma.employeeTaxProfile.findMany({ where: { organizationId: orgId }, orderBy: { effectiveFrom: "asc" } });
  const ids = new Map<string, { sssNo?: string | null; gsisNo?: string | null; philhealthNo?: string | null; pagibigNo?: string | null; tin?: string | null }>();
  for (const p of profiles) ids.set(p.employeeId, p); // the latest one wins
  return { periods, notFinal: periods.filter((p) => p.status !== "FINALIZED"), slips, ids, remit: sumRemittance(slips, ids), summary: sum1601(slips, new Set(slips.map((s) => s.employeeId)).size) };
}

export type Annual = {
  employeeId: string; employeeNo: string; name: string; tin: string;
  grossCents: number; mweExemptCents: number; benefitsExemptCents: number; otherNonTaxableCents: number; mandatoryCents: number;
  taxableCents: number; benefitsTaxableCents: number; taxDueCents: number | null; taxWithheldCents: number;
  previousEmployerCents: { name: string; taxableCents: number; taxWithheldCents: number; grossCents: number }[];
};

export async function loadYear(orgId: string, year: number, onlyEmployee?: string): Promise<{ rows: Annual[]; notFinal: string[]; hasAnnualRule: boolean }> {
  const yStart = dbDate(`${year}-01-01`);
  const yEnd = dbDate(`${year}-12-31`);
  const [slips, prev, rules, periods, profiles, emps] = await Promise.all([
    prisma.payslip.findMany({
      where: { organizationId: orgId, ...(onlyEmployee ? { employeeId: onlyEmployee } : {}), period: { status: "FINALIZED", payDate: { gte: yStart, lte: yEnd } } },
      select: { employeeId: true, grossCents: true, taxableCents: true, taxWithheldCents: true, nonTaxableCents: true, mweExemptCents: true, mandatoryEeCents: true, benefitsExemptCents: true, benefitsTaxableCents: true },
    }),
    prisma.previousEmployment.findMany({ where: { organizationId: orgId, year, ...(onlyEmployee ? { employeeId: onlyEmployee } : {}) } }),
    prisma.statutoryRule.findMany({ where: { organizationId: orgId, code: "ANNUAL_TAX" } }),
    prisma.payrollPeriod.findMany({ where: { organizationId: orgId, status: { not: "FINALIZED" }, payDate: { gte: yStart, lte: yEnd } }, select: { name: true } }),
    prisma.employeeTaxProfile.findMany({ where: { organizationId: orgId }, orderBy: { effectiveFrom: "asc" } }),
    prisma.employee.findMany({ where: { organizationId: orgId, ...(onlyEmployee ? { id: onlyEmployee } : {}) }, select: { id: true, employeeNo: true, firstName: true, lastName: true } }),
  ]);
  const rows: RuleRow[] = rules.map((r) => ({ id: r.id, code: r.code, kind: r.kind, sector: r.sector, effectiveFrom: keyOfDbDate(r.effectiveFrom), effectiveTo: r.effectiveTo ? keyOfDbDate(r.effectiveTo) : null, params: r.params }));
  const rule = pickRule(rows, "ANNUAL_TAX", `${year}-12-31`);
  const parsed = rule ? parseParams("ANNUAL_TAX_TABLE", rule.params) : null;
  const table = parsed?.ok ? parsed.params.brackets : null;
  const tin = new Map(profiles.map((p) => [p.employeeId, p.tin ?? ""]));
  const out: Annual[] = [];
  for (const e of emps) {
    const mine = slips.filter((s) => s.employeeId === e.id);
    const before = prev.filter((p) => p.employeeId === e.id);
    if (mine.length === 0 && before.length === 0) continue;
    const t = (f: (s: (typeof mine)[number]) => number) => mine.reduce((n, s) => n + f(s), 0);
    const taxable = t((s) => s.taxableCents) + before.reduce((n, p) => n + p.taxableCents, 0);
    const benTaxable = t((s) => s.benefitsTaxableCents) + before.reduce((n, p) => n + p.benefitsTaxableCents, 0);
    out.push({
      employeeId: e.id, employeeNo: e.employeeNo, name: `${e.lastName}, ${e.firstName}`, tin: tin.get(e.id) ?? "",
      grossCents: t((s) => s.grossCents), mweExemptCents: t((s) => s.mweExemptCents), benefitsExemptCents: t((s) => s.benefitsExemptCents) + before.reduce((n, p) => n + p.benefitsExemptCents, 0),
      otherNonTaxableCents: t((s) => s.nonTaxableCents) - t((s) => s.benefitsExemptCents), mandatoryCents: t((s) => s.mandatoryEeCents) + before.reduce((n, p) => n + p.mandatoryCents, 0),
      taxableCents: taxable, benefitsTaxableCents: benTaxable, taxDueCents: table ? bracketTax(table, taxable + benTaxable) : null,
      taxWithheldCents: t((s) => s.taxWithheldCents) + before.reduce((n, p) => n + p.taxWithheldCents, 0),
      previousEmployerCents: before.map((p) => ({ name: p.employerName, taxableCents: p.taxableCents, taxWithheldCents: p.taxWithheldCents, grossCents: p.grossCents })),
    });
  }
  return { rows: out.sort((a, b) => a.name.localeCompare(b.name)), notFinal: periods.map((p) => p.name), hasAnnualRule: !!table };
}
