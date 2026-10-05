// Gathers every input for a pay period and stores the result as payslips. The arithmetic itself lives in payroll.ts (manual rates)
// and ph/payroll-ph.ts (Philippine statutory rules).
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { loadDtr } from "@/lib/dtr-data";
import { getMyEmployee } from "@/lib/employees";
import { buildAttendance, computePayslip, type Attendance, type PayInput } from "@/lib/payroll";
import { annualFactor, frequencyOf, holdsMonthEnd, periodsPerYearOf, suggestBasis, tableCodeOf, type DmUse } from "@/lib/ph/calc";
import { holidayAdjustedAttendance, type PhInput } from "@/lib/ph/payroll-ph";
import { buildPayDays, type HolidayKind } from "@/lib/ph/premium";
import { parseParams, pickRule, type DeMinimisParams, type ParamsOf, type RuleKind, type RuleRow, type Sector } from "@/lib/ph/rules";
import { getOrgSettings } from "@/lib/settings";
import type { Actor } from "@/lib/scope";
import { daysBetween, keyOfDbDate } from "@/lib/time";

export type Skipped = { name: string; reason: string };

const monthsBetween = (fromDay: string, toDay: string) => {
  const [y1, m1, d1] = fromDay.split("-").map(Number);
  const [y2, m2, d2] = toDay.split("-").map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
};

export async function calculatePeriod(me: Actor, periodId: string): Promise<{ count: number; skipped: Skipped[] } | { error: string }> {
  const period = await prisma.payrollPeriod.findFirst({ where: { id: periodId, organizationId: me.organizationId } });
  if (!period) return { error: "Pay period not found." };
  if (period.status === "FINALIZED") return { error: "This payroll is finalized and cannot change." };

  const orgId = me.organizationId;
  const from = keyOfDbDate(period.startDate);
  const to = keyOfDbDate(period.endDate);
  const payDay = keyOfDbDate(period.payDate);
  const payYear = Number(payDay.slice(0, 4));
  const days = daysBetween(from, to);
  const settings = await getOrgSettings(orgId);
  const isPh = settings.statutoryProfile === "PHILIPPINES";
  const special = period.kind !== "REGULAR";
  const mine = await getMyEmployee(me, settings.timezone);
  const factors = { workDaysPerMonth: settings.workDaysPerMonth, hoursPerDay: settings.hoursPerDay, otMultiplierBp: settings.otMultiplierBp, periodsPerMonth: period.periodsPerMonth };

  const ruleRows = isPh ? await prisma.statutoryRule.findMany({ where: { organizationId: orgId } }) : [];
  if (isPh && ruleRows.length === 0) return { error: "Philippine payroll is switched on but no rules are installed. Open Pay setup, Philippine rules, and install them first." };
  const rules: RuleRow[] = ruleRows.map((r) => ({ id: r.id, code: r.code, kind: r.kind, sector: r.sector, effectiveFrom: keyOfDbDate(r.effectiveFrom), effectiveTo: r.effectiveTo ? keyOfDbDate(r.effectiveTo) : null, params: r.params }));
  const params = <K extends RuleKind>(code: string, kind: K, sector?: Sector): ParamsOf[K] | null => {
    const r = pickRule(rules, code, payDay, sector);
    if (!r) return null;
    const p = parseParams(kind, r.params);
    return p.ok ? p.params : null;
  };
  const yearStart = `${payYear}-01-01`;

  const [employees, contributions, brackets, comps, adjustments, leave, overtime, assigned, profiles, wageOrders, holidays, regulars, ytdSlips, previous, unfinalized] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId: orgId, status: { not: "SEPARATED" }, hireDate: { lte: period.endDate } },
      select: { id: true, employeeNo: true, firstName: true, lastName: true, hireDate: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.contributionRule.findMany({ where: { organizationId: orgId, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.taxBracket.findMany({ where: { organizationId: orgId }, orderBy: { fromCents: "asc" } }),
    prisma.compensation.findMany({ where: { organizationId: orgId, effectiveFrom: { lte: period.endDate } }, orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }] }),
    prisma.payrollAdjustment.findMany({ where: { organizationId: orgId, periodId } }),
    prisma.leaveRequest.findMany({
      where: { organizationId: orgId, status: "APPROVED", startDate: { lte: period.endDate }, endDate: { gte: period.startDate } },
      select: { employeeId: true, startDate: true, endDate: true, leaveType: { select: { paid: true } } },
    }),
    prisma.overtimeRequest.findMany({
      where: { organizationId: orgId, status: "APPROVED", date: { gte: period.startDate, lte: period.endDate } },
      select: { employeeId: true, date: true, minutes: true },
    }),
    prisma.employeeComponent.findMany({
      where: { organizationId: orgId, active: true, component: { archivedAt: null } },
      include: { component: true },
    }),
    isPh ? prisma.employeeTaxProfile.findMany({ where: { organizationId: orgId, effectiveFrom: { lte: period.endDate } }, orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }] }) : [],
    isPh ? prisma.wageOrder.findMany({ where: { organizationId: orgId, effectiveFrom: { lte: period.payDate } } }) : [],
    isPh ? prisma.holiday.findMany({ where: { organizationId: orgId, date: { gte: period.startDate, lte: period.endDate } } }) : [],
    isPh ? prisma.regularSchedule.findMany({ where: { organizationId: orgId, effectiveFrom: { lte: period.endDate } }, orderBy: { effectiveFrom: "asc" }, select: { employeeId: true, workDays: true } }) : [],
    isPh
      ? prisma.payslip.findMany({
          where: { organizationId: orgId, periodId: { not: periodId }, period: { status: "FINALIZED", payDate: { gte: new Date(`${yearStart}T00:00:00Z`), lte: period.payDate } } },
          select: { employeeId: true, taxableCents: true, benefitsTaxableCents: true, benefitsExemptCents: true, taxWithheldCents: true, basicEarnedCents: true, inputs: true, period: { select: { payDate: true, startDate: true, kind: true } } },
        })
      : [],
    isPh ? prisma.previousEmployment.findMany({ where: { organizationId: orgId, year: payYear } }) : [],
    isPh ? prisma.payrollPeriod.findMany({ where: { organizationId: orgId, id: { not: periodId }, status: { not: "FINALIZED" }, payDate: { gte: new Date(`${yearStart}T00:00:00Z`), lte: period.payDate } }, select: { name: true } }) : [],
  ]);

  const premium = isPh ? params("PREMIUMS", "PREMIUM_PAY") : null;
  const incentive = isPh && period.incentiveCode ? params(period.incentiveCode, "INCENTIVE", "GOVERNMENT") : null;
  const holidayMap = new Map<string, HolidayKind[]>();
  for (const h of holidays) holidayMap.set(keyOfDbDate(h.date), [...(holidayMap.get(keyOfDbDate(h.date)) ?? []), h.type]);
  const deMinimis: Record<string, DeMinimisParams> = {};
  if (isPh) for (const code of new Set(rules.filter((r) => r.kind === "DE_MINIMIS").map((r) => r.code))) {
    const p = params(code, "DE_MINIMIS");
    if (p) deMinimis[code] = p;
  }
  const frequency = frequencyOf(period.periodsPerMonth, from === to);

  const skipped: Skipped[] = [];
  const slips: { data: Prisma.PayslipUncheckedCreateInput; lines: Prisma.PayslipLineCreateManyPayslipInput[] }[] = [];
  const earlier = unfinalized.length ? `Earlier payroll${unfinalized.length === 1 ? "" : "s"} this year not finalized (${unfinalized.map((u) => u.name).join(", ")}): year-to-date totals, the 13th month and the year-end adjustment may be understated.` : null;

  for (const e of employees) {
    const name = `${e.firstName} ${e.lastName}`;
    if (period.skipEmployeeIds.includes(e.id)) {
      skipped.push({ name, reason: "Left out of this payroll" });
      continue;
    }
    const comp = [...comps].filter((c) => c.employeeId === e.id).pop(); // latest effective on or before the period end
    if (!comp) {
      // A 13th month needs no pay rate, only pay earned earlier this year.
      const earned = period.kind === "THIRTEENTH_MONTH" ? ytdSlips.filter((s) => s.employeeId === e.id).reduce((n, s) => n + s.basicEarnedCents, 0) : 0;
      if (earned === 0) {
        skipped.push({ name, reason: period.kind === "THIRTEENTH_MONTH" ? "No pay on record this year" : "No pay rate set" });
        continue;
      }
    }

    // Philippine inputs
    let ph: PhInput | undefined;
    let sector: Sector = "PRIVATE";
    const extraWarnings: string[] = [];
    let attendance: Attendance;
    let sessionsInfo: Awaited<ReturnType<typeof loadDtr>> = null;
    if (!special) {
      sessionsInfo = await loadDtr(me, mine.id, e.id, from, to, settings.timezone, settings.graceMinutes);
      if (!sessionsInfo) continue;
    }
    const inRange = (d: string) => d >= from && d <= to;
    const paidLeave = new Set<string>();
    const unpaidLeave = new Set<string>();
    for (const l of leave.filter((x) => x.employeeId === e.id)) {
      for (const d of daysBetween(keyOfDbDate(l.startDate), keyOfDbDate(l.endDate)).filter(inRange)) (l.leaveType.paid ? paidLeave : unpaidLeave).add(d);
    }
    const ot = new Map<string, number>();
    for (const o of overtime.filter((x) => x.employeeId === e.id)) ot.set(keyOfDbDate(o.date), o.minutes);
    attendance = sessionsInfo
      ? buildAttendance(sessionsInfo.rows, paidLeave, unpaidLeave, ot)
      : { scheduledDays: 0, presentDays: 0, incompleteDays: 0, absentDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, lateMinutes: 0, undertimeMinutes: 0, workedMinutes: 0, approvedOvertimeMinutes: 0 };

    if (isPh) {
      const profile = [...profiles].filter((p) => p.employeeId === e.id).pop();
      sector = profile?.sector ?? "PRIVATE";
      if (period.kind === "GOV_INCENTIVE" && sector !== "GOVERNMENT") {
        skipped.push({ name, reason: "Not a government employee" });
        continue;
      }
      if (!profile) extraWarnings.push("No tax profile: treated as a private employee, not a minimum wage earner, with every contribution applying. Set the profile on the employee's page.");
      const lastRegular = [...regulars].filter((r) => r.employeeId === e.id).pop();
      const basis = profile?.wageBasis ?? suggestBasis(lastRegular?.workDays.length ?? 5);
      const factor = annualFactor(basis, profile?.customFactor);
      const region = profile?.wageRegion?.trim().toLowerCase();
      const wage = region ? [...wageOrders].filter((w) => w.region.trim().toLowerCase() === region && (!w.effectiveTo || w.effectiveTo >= period.payDate)).sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()).pop() : undefined;
      const f = frequency;
      const ppy = periodsPerYearOf(f, factor ?? settings.workDaysPerMonth * 12);
      const mine12 = ytdSlips.filter((s) => s.employeeId === e.id);
      const prev = previous.filter((p) => p.employeeId === e.id);
      const sum = (pick: (s: (typeof mine12)[number]) => number) => mine12.reduce((n, s) => n + pick(s), 0);
      const dmUsed: DmUse[] = mine12.flatMap((s) => (((s.inputs as { tax?: { deMinimisUsed?: DmUse[] } } | null)?.tax?.deMinimisUsed ?? []) as DmUse[]));
      const asOf = incentive ? `${payYear}-${incentive.asOf}` : payDay;
      const payDays = sessionsInfo && premium
        ? buildPayDays({ rows: sessionsInfo.rows, holidays: holidayMap, dayOff: sessionsInfo.dayOff, paidLeave, approvedOvertime: ot, sessionsByDay: sessionsInfo.sessionsByDay, tz: settings.timezone, premium })
        : [];
      if (sessionsInfo) attendance = holidayAdjustedAttendance(attendance, sessionsInfo.rows.filter((r) => r.status === "ABSENT").map((r) => r.day), payDays);
      ph = {
        kind: period.kind, yearEnd: period.yearEnd, frequency: f, periodsPerYear: ppy, lastOfMonth: holdsMonthEnd(from, to), contributionSchedule: settings.contributionSchedule, payDate: payDay,
        sector, mwe: profile?.mwe ?? false, withholdingApplies: profile?.withholdingApplies ?? true,
        socialCovered: profile?.socialCovered ?? true, philhealthCovered: profile?.philhealthCovered ?? true, pagibigCovered: profile?.pagibigCovered ?? true,
        annualFactor: factor, minWageDailyCents: wage?.dailyMinimumCents ?? null,
        rules: {
          sss: params("SSS", "SSS", sector), gsis: params("GSIS", "PERCENT_CONTRIBUTION", sector),
          philhealth: params("PHILHEALTH", "PERCENT_CONTRIBUTION", sector), pagibig: params("PAGIBIG", "PERCENT_CONTRIBUTION", sector),
          table: params(tableCodeOf(f), "WITHHOLDING_TABLE")?.brackets ?? null,
          annual: params("ANNUAL_TAX", "ANNUAL_TAX_TABLE")?.brackets ?? null,
          pool: params("BENEFITS_POOL", "BENEFITS_POOL"), premium, deMinimis, incentive,
        },
        serviceMonths: monthsBetween(keyOfDbDate(e.hireDate), asOf),
        ytd: {
          taxableCents: sum((s) => s.taxableCents) + prev.reduce((n, p) => n + p.taxableCents, 0),
          benefitsTaxableCents: sum((s) => s.benefitsTaxableCents) + prev.reduce((n, p) => n + p.benefitsTaxableCents, 0),
          benefitsExemptCents: sum((s) => s.benefitsExemptCents) + prev.reduce((n, p) => n + p.benefitsExemptCents, 0),
          taxWithheldCents: sum((s) => s.taxWithheldCents) + prev.reduce((n, p) => n + p.taxWithheldCents, 0),
          basicEarnedCents: sum((s) => s.basicEarnedCents),
          deMinimis: dmUsed,
        },
        payDays,
      };
      if (earlier) extraWarnings.push(earlier);
    }

    const input: PayInput = {
      payType: comp?.payType ?? "MONTHLY",
      rateCents: comp?.rateCents ?? 0,
      attendance,
      factors,
      components: assigned
        .filter((a) => a.employeeId === e.id)
        .map((a) => ({
          name: a.component.name, kind: a.component.kind, calc: a.component.calc, value: a.valueOverride ?? a.component.value,
          taxable: a.component.taxClass === "TAXABLE" || a.component.taxClass === "OTHER_BENEFIT",
          taxClass: a.component.taxClass, deMinimisCode: a.component.deMinimisCode, preTax: a.component.preTax, inContributionBase: a.component.inContributionBase, mweExempt: a.component.mweExempt,
        })),
      contributions: isPh ? [] : contributions.map((c) => ({ name: c.name, employeeBp: c.employeeBp, employerBp: c.employerBp, minBaseCents: c.minBaseCents, maxBaseCents: c.maxBaseCents })),
      brackets: isPh ? [] : brackets.map((b) => ({ fromCents: b.fromCents, rateBp: b.rateBp, fixedCents: b.fixedCents })),
      adjustments: adjustments.filter((a) => a.employeeId === e.id).map((a) => ({ kind: a.kind, label: a.label, amountCents: a.amountCents })),
      ph,
    };
    const result = computePayslip(input);
    const warnings = [...extraWarnings, ...result.warnings];
    const t = result.tax;
    slips.push({
      data: {
        organizationId: orgId, periodId, employeeId: e.id, employeeNo: e.employeeNo, employeeName: name,
        grossCents: result.grossCents, deductionsCents: result.deductionsCents, netCents: result.netCents, employerCostCents: result.employerCostCents,
        taxableCents: t?.taxableCents ?? 0, taxWithheldCents: t?.taxWithheldCents ?? 0, nonTaxableCents: t?.nonTaxableCents ?? 0, mweExemptCents: t?.mweExemptCents ?? 0,
        mandatoryEeCents: t?.mandatoryEeCents ?? 0, benefitsExemptCents: t?.benefitsExemptCents ?? 0, benefitsTaxableCents: t?.benefitsTaxableCents ?? 0, basicEarnedCents: t?.basicEarnedCents ?? 0,
        inputs: { ...input, warnings, days: days.length, tax: t } as unknown as Prisma.InputJsonValue,
      },
      lines: result.lines.map((l, i) => ({ kind: l.kind, code: l.code, label: l.label, amountCents: l.amountCents, detail: l.detail ?? null, sortOrder: i })),
    });
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.payslip.deleteMany({ where: { periodId, organizationId: orgId } }); // lines go with them
      for (const s of slips) await tx.payslip.create({ data: { ...s.data, lines: { createMany: { data: s.lines } } } });
      await tx.payrollPeriod.update({
        where: { id: periodId },
        data: { status: "CALCULATED", calculatedAt: new Date(), calculatedById: me.id, approvedAt: null, approvedById: null },
      });
    },
    { timeout: 60_000 },
  );
  return { count: slips.length, skipped };
}
