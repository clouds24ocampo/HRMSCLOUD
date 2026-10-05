import { describe, expect, it } from "vitest";
import { computePayslip, type Attendance, type PayInput } from "@/lib/payroll";
import type { PhInput } from "@/lib/ph/payroll-ph";
import { PACK, packFor } from "@/lib/ph/pack";
import { findOverlap, parseParams, pickRule, type Bracket, type DeMinimisParams, type PercentParams, type PremiumParams, type RuleRow, type SssParams, type TableParams } from "@/lib/ph/rules";
import { bracketTax, deMinimisSplit, holdsMonthEnd, monthlyShare, percentContribution, poolSplit, rates, sssContribution, suggestBasis, thirteenthMonth, yearEndAdjustment } from "@/lib/ph/calc";
import { buildPayDays, multiplierBp, nightMinutes, premiumPay, splitTail, workIntervals, type PayDay } from "@/lib/ph/premium";
import type { DtrDay, Session } from "@/lib/dtr";
import { adsc, gsisRetirement, sssMaternity, sssSickness, terminalLeave } from "@/lib/ph/benefits";
import { easter, standardHolidays } from "@/lib/ph/holidays";

const php = (p: number) => Math.round(p * 100);
const rows: RuleRow[] = PACK.map((r, i) => ({ id: String(i), code: r.code, kind: r.kind, sector: r.sector, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo ?? null, params: r.params }));
const rule = <T>(code: string, day = "2026-10-15", sector?: "PRIVATE" | "GOVERNMENT") => pickRule(rows, code, day, sector)!.params as T;
const table = (code: string) => rule<TableParams>(code).brackets;

const attendance = (o: Partial<Attendance> = {}): Attendance => ({ scheduledDays: 22, presentDays: 22, incompleteDays: 0, absentDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, lateMinutes: 0, undertimeMinutes: 0, workedMinutes: 22 * 480, approvedOvertimeMinutes: 0, ...o });

function ph(o: Partial<PhInput> = {}): PhInput {
  return {
    kind: "REGULAR", yearEnd: false, frequency: "MONTHLY", periodsPerYear: 12, lastOfMonth: true, contributionSchedule: "EVERY_PERIOD", payDate: "2026-10-31",
    sector: "PRIVATE", mwe: false, withholdingApplies: true, socialCovered: true, philhealthCovered: true, pagibigCovered: true, annualFactor: 261, minWageDailyCents: null,
    rules: {
      sss: rule<SssParams>("SSS", "2026-10-31", "PRIVATE"), gsis: null, philhealth: rule<PercentParams>("PHILHEALTH"), pagibig: rule<PercentParams>("PAGIBIG"),
      table: table("WT_MONTHLY"), annual: table("ANNUAL_TAX"), pool: rule("BENEFITS_POOL"), premium: rule<PremiumParams>("PREMIUMS"),
      deMinimis: Object.fromEntries(PACK.filter((r) => r.kind === "DE_MINIMIS").map((r) => [r.code, r.params as DeMinimisParams])), incentive: null,
    },
    serviceMonths: 12, ytd: { taxableCents: 0, benefitsTaxableCents: 0, benefitsExemptCents: 0, taxWithheldCents: 0, basicEarnedCents: 0, deMinimis: [] }, payDays: [], ...o,
  };
}
function slip(rateCents: number, o: Partial<PayInput> = {}, p: Partial<PhInput> = {}, periodsPerMonth = 1) {
  return computePayslip({
    payType: "MONTHLY", rateCents, attendance: attendance(), factors: { workDaysPerMonth: 22, hoursPerDay: 8, otMultiplierBp: 12500, periodsPerMonth },
    components: [], contributions: [], brackets: [], adjustments: [], ph: ph(p), ...o,
  });
}
const line = (r: ReturnType<typeof slip>, label: string) => r.lines.find((l) => l.label === label)?.amountCents ?? 0;

describe("the starter rule pack", () => {
  it("every row has valid parameters", () => {
    for (const r of PACK) {
      const res = parseParams(r.kind, r.params);
      expect(res.ok, `${r.code}: ${res.ok ? "" : res.error}`).toBe(true);
    }
  });
  it("has no overlapping versions of a rule", () => {
    for (const r of rows) expect(findOverlap(rows, r, r.id), r.code).toBeNull();
  });
  it("scopes by sector", () => {
    expect(packFor("PRIVATE").some((r) => r.code === "GSIS")).toBe(false);
    expect(packFor("GOVERNMENT").some((r) => r.code === "SSS")).toBe(false);
    expect(packFor("BOTH").some((r) => r.code === "SSS") && packFor("BOTH").some((r) => r.code === "GSIS")).toBe(true);
  });
  it("picks the version in force on the pay day", () => {
    expect(pickRule(rows, "DM_RICE", "2025-12-31")).toBeNull(); // RR 29-2025 starts January 6, 2026
    expect(pickRule(rows, "DM_RICE", "2026-01-06")).not.toBeNull();
    expect(pickRule(rows, "SSS", "2024-12-31", "PRIVATE")).toBeNull();
    const two: RuleRow[] = [
      { id: "a", code: "X", kind: "BENEFITS_POOL", sector: "ALL", effectiveFrom: "2020-01-01", effectiveTo: "2025-12-31", params: { ceilingCents: 1 } },
      { id: "b", code: "X", kind: "BENEFITS_POOL", sector: "ALL", effectiveFrom: "2026-01-01", effectiveTo: null, params: { ceilingCents: 2 } },
    ];
    expect(pickRule(two, "X", "2025-06-01")!.id).toBe("a");
    expect(pickRule(two, "X", "2026-06-01")!.id).toBe("b");
    expect(findOverlap(two, { code: "X", sector: "ALL", effectiveFrom: "2025-12-01", effectiveTo: null })).not.toBeNull();
  });
  it("tables are continuous: each fixed amount equals the tax at the start of its bracket", () => {
    for (const code of ["WT_WEEKLY", "WT_SEMI_MONTHLY", "WT_MONTHLY", "ANNUAL_TAX"]) {
      const b = table(code);
      for (let i = 1; i < b.length; i++) {
        const expected = b[i - 1].fixedCents + Math.round(((b[i].fromCents - b[i - 1].fromCents) * b[i - 1].rateBp) / 10000);
        expect(Math.abs(b[i].fixedCents - expected), `${code} bracket ${i}`).toBeLessThanOrEqual(100); // the BIR rounds its published boundaries to whole pesos
      }
    }
  });
  it("the monthly table agrees with the annual rates (x12) within a peso of rounding", () => {
    for (const monthly of [20000, 25000, 40000, 100000, 300000, 900000]) {
      const a = bracketTax(table("ANNUAL_TAX"), php(monthly * 12));
      const m = bracketTax(table("WT_MONTHLY"), php(monthly)) * 12;
      expect(Math.abs(a - m)).toBeLessThanOrEqual(php(30));
    }
  });
});

describe("withholding tax and contributions: the worked table in taxation.md", () => {
  // gross, SSS, PhilHealth, Pag-IBIG, tax, net (all pesos), copied from taxation.md section 3
  const cases: [number, number, number, number, number, number][] = [
    [15000, 750, 375, 200, 0, 13675],
    [20000, 1000, 500, 200, 0, 18300],
    [25000, 1250, 625, 200, 313.8, 22611.2],
    [30000, 1500, 750, 200, 1007.55, 26542.45],
    [40000, 1750, 1000, 200, 2618.4, 34431.6],
    [50000, 1750, 1250, 200, 4568.4, 42231.6],
    [75000, 1750, 1875, 200, 9668.8, 61506.2],
    [100000, 1750, 2500, 200, 15762.55, 79787.45],
    [150000, 1750, 2500, 200, 28262.55, 117287.45],
    [200000, 1750, 2500, 200, 42206.7, 153343.3],
    [500000, 1750, 2500, 200, 132206.7, 363343.3],
    [1000000, 1750, 2500, 200, 298650.85, 696899.15],
  ];
  it.each(cases)("₱%s a month", (gross, sss, phic, hdmf, tax, net) => {
    const r = slip(php(gross));
    expect(line(r, "SSS")).toBe(php(sss));
    expect(line(r, "PhilHealth")).toBe(php(phic));
    expect(line(r, "Pag-IBIG")).toBe(php(hdmf));
    expect(line(r, "Withholding tax")).toBe(php(tax));
    expect(r.netCents).toBe(php(net));
    expect(r.warnings).toEqual([]);
  });
  it("keeps employer shares out of the employee's pay and adds them to the employer cost", () => {
    const r = slip(php(25000));
    const er = r.lines.filter((l) => l.kind === "EMPLOYER");
    expect(er.map((l) => [l.label, l.amountCents])).toEqual([["SSS (employer share)", php(2500)], ["SSS EC (employer only)", php(30)], ["PhilHealth (employer share)", php(625)], ["Pag-IBIG (employer share)", php(200)]]);
    expect(r.employerCostCents).toBe(php(25000) + php(2500 + 30 + 625 + 200));
  });
});

describe("SSS", () => {
  const p = rule<SssParams>("SSS", "2026-10-31", "PRIVATE");
  it("rounds pay to the nearest ₱500 credit, kept between ₱5,000 and ₱35,000", () => {
    const msc = (pay: number) => sssContribution(php(pay), p).mscCents / 100;
    expect(msc(1000)).toBe(5000);
    expect(msc(5249.99)).toBe(5000);
    expect(msc(5250)).toBe(5500);
    expect(msc(24999)).toBe(25000);
    expect(msc(34749.99)).toBe(34500);
    expect(msc(34750)).toBe(35000);
    expect(msc(900000)).toBe(35000);
  });
  it("employee 5%, employer 10%, EC ₱10 or ₱30 by salary credit, MPF above ₱20,000", () => {
    const lo = sssContribution(php(10000), p);
    expect([lo.employeeCents, lo.employerCents, lo.ecCents]).toEqual([php(500), php(1000), php(10)]);
    const hi = sssContribution(php(35000), p);
    expect([hi.employeeCents, hi.employerCents, hi.ecCents, hi.mpfMscCents]).toEqual([php(1750), php(3500), php(30), php(15000)]);
    expect(sssContribution(php(14749), p).ecCents).toBe(php(10)); // salary credit 14,500
    expect(sssContribution(php(14750), p).ecCents).toBe(php(30)); // salary credit 15,000
  });
});

describe("PhilHealth, Pag-IBIG, GSIS", () => {
  const phic = rule<PercentParams>("PHILHEALTH");
  const hdmf = rule<PercentParams>("PAGIBIG");
  const gsis = rule<PercentParams>("GSIS", "2026-10-31", "GOVERNMENT");
  it("PhilHealth: 5% of basic pay between ₱10,000 and ₱100,000, split equally", () => {
    expect(percentContribution(php(8000), phic).employeeCents).toBe(php(250)); // floor ₱10,000 x 2.5%
    expect(percentContribution(php(30000), phic).employeeCents).toBe(php(750));
    expect(percentContribution(php(250000), phic).employeeCents).toBe(php(2500)); // ceiling ₱100,000
  });
  it("Pag-IBIG: 1% up to ₱1,500 of pay, 2% above, fund salary capped at ₱10,000", () => {
    expect(percentContribution(php(1500), hdmf).employeeCents).toBe(php(15));
    expect(percentContribution(php(1500), hdmf).employerCents).toBe(php(30));
    expect(percentContribution(php(5000), hdmf).employeeCents).toBe(php(100));
    expect(percentContribution(php(80000), hdmf).employeeCents).toBe(php(200));
  });
  it("GSIS: employee 9%, government 12% of the actual salary, no ceiling, and no SSS", () => {
    const r = slip(php(30000), {}, { sector: "GOVERNMENT", rules: { ...ph().rules, sss: null, gsis } });
    expect(line(r, "GSIS")).toBe(php(2700));
    expect(r.lines.find((l) => l.label === "GSIS (employer share)")!.amountCents).toBe(php(3600));
    expect(line(r, "SSS")).toBe(0);
    expect(line(r, "PhilHealth")).toBe(php(750));
    expect(line(r, "Pag-IBIG")).toBe(php(200));
  });
});

describe("wage factors", () => {
  it("313 / 261 / 365 give the daily rate in Payrollguidel.md", () => {
    expect(Math.round(rates("MONTHLY", php(20000), 313, 8).daily)).toBe(php(766.77));
    expect(Math.round(rates("MONTHLY", php(20000), 261, 8).daily)).toBe(php(919.54));
    expect(Math.round(rates("MONTHLY", php(30000), 313, 8).daily)).toBe(php(1150.16));
    expect(Math.round(rates("MONTHLY", php(30000), 313, 8).hourly)).toBe(php(143.77));
    expect(Math.round(rates("MONTHLY", php(30000), 365, 8).daily)).toBe(php(986.3));
  });
  it("daily and hourly pay convert to a monthly equivalent with the factor", () => {
    expect(rates("DAILY", php(500), 261, 8).monthly).toBe(php(10875));
    expect(rates("HOURLY", php(100), 313, 8).monthly).toBe(php(20866.67));
  });
  it("suggests a basis from the working week", () => {
    expect([suggestBasis(5), suggestBasis(6), suggestBasis(7)]).toEqual(["FIVE_DAY_261", "SIX_DAY_313", "ALL_DAYS_365"]);
  });
  it("the same monthly salary gives the same tax for a 5-day and a 6-day week; only the daily rate differs", () => {
    const five = slip(php(30000), {}, { annualFactor: 261 });
    const six = slip(php(30000), {}, { annualFactor: 313 });
    expect(line(five, "Withholding tax")).toBe(line(six, "Withholding tax"));
    const absentFive = slip(php(30000), { attendance: attendance({ absentDays: 1 }) }, { annualFactor: 261 });
    const absentSix = slip(php(30000), { attendance: attendance({ absentDays: 1 }) }, { annualFactor: 313 });
    expect(line(absentFive, "Absences")).toBe(php(1379.31));
    expect(line(absentSix, "Absences")).toBe(php(1150.16));
  });
  it("warns about minimum wage", () => {
    const below = slip(php(12000), {}, { annualFactor: 261, minWageDailyCents: php(645) });
    expect(below.warnings.join(" ")).toMatch(/below the minimum wage/);
    const mweAbove = slip(php(30000), {}, { mwe: true, minWageDailyCents: php(645) });
    expect(mweAbove.warnings.join(" ")).toMatch(/above the minimum wage/);
  });
});

describe("splitting contributions across pay periods", () => {
  it("semi-monthly: half now, the rest at month end, so the month adds up exactly", () => {
    const o = { schedule: "EVERY_PERIOD" as const, frequency: "SEMI_MONTHLY" as const, periodsPerYear: 24 };
    const a = monthlyShare(125001, { ...o, lastOfMonth: false });
    const b = monthlyShare(125001, { ...o, lastOfMonth: true });
    expect(a + b).toBe(125001);
  });
  it("month-end schedule takes everything once", () => {
    const o = { schedule: "LAST_PERIOD" as const, frequency: "SEMI_MONTHLY" as const, periodsPerYear: 24 };
    expect(monthlyShare(100000, { ...o, lastOfMonth: false })).toBe(0);
    expect(monthlyShare(100000, { ...o, lastOfMonth: true })).toBe(100000);
  });
  it("knows which period holds the month end", () => {
    expect(holdsMonthEnd("2026-10-01", "2026-10-15")).toBe(false);
    expect(holdsMonthEnd("2026-10-16", "2026-10-31")).toBe(true);
    expect(holdsMonthEnd("2026-10-01", "2026-10-31")).toBe(true);
    expect(holdsMonthEnd("2026-02-16", "2026-02-28")).toBe(true);
    expect(holdsMonthEnd("2026-10-26", "2026-11-10")).toBe(true);
  });
  it("a semi-monthly payslip uses the semi-monthly table on half the pay and half the contribution", () => {
    const first = slip(php(40000), {}, { frequency: "SEMI_MONTHLY", periodsPerYear: 24, lastOfMonth: false, rules: { ...ph().rules, table: table("WT_SEMI_MONTHLY") } }, 2);
    expect(line(first, "Basic pay")).toBe(php(20000));
    expect(line(first, "SSS")).toBe(php(875));
    expect(line(first, "PhilHealth")).toBe(php(500));
    expect(line(first, "Pag-IBIG")).toBe(php(100));
    // taxable 20,000 - 1,475 = 18,525; 937.50 + 20% of (18,525 - 16,667) = 1,309.10
    expect(line(first, "Withholding tax")).toBe(php(1309.1));
  });
});

describe("minimum wage earners and pay items", () => {
  it("MWE pay (basic, overtime) is not taxed, but other taxable pay is", () => {
    const plain = slip(php(15000), {}, { mwe: true });
    expect(line(plain, "Withholding tax")).toBe(0);
    const withCommission = slip(php(15000), { components: [{ name: "Commission", kind: "EARNING", calc: "FIXED", value: php(30000), taxable: true, taxClass: "TAXABLE" }] }, { mwe: true });
    // commission 30,000 less contributions (SSS 750 + PhilHealth 375 + Pag-IBIG 200 = 1,325) = 28,675; 15% over 20,833 = 1,176.30
    expect(line(withCommission, "Withholding tax")).toBe(php(1176.3));
    const hazard = slip(php(15000), { components: [{ name: "Hazard pay", kind: "EARNING", calc: "FIXED", value: php(30000), taxable: true, taxClass: "TAXABLE", mweExempt: true }] }, { mwe: true });
    expect(line(hazard, "Withholding tax")).toBe(0);
  });
  it("union dues taken before tax lower the taxable pay", () => {
    const base = slip(php(40000));
    const dues = slip(php(40000), { components: [{ name: "Union dues", kind: "DEDUCTION", calc: "FIXED", value: php(500), taxable: true, preTax: true }] });
    expect(line(base, "Withholding tax") - line(dues, "Withholding tax")).toBe(php(100)); // 20% of 500
  });
  it("a person marked as not subject to withholding pays no tax", () => {
    expect(line(slip(php(80000), {}, { withholdingApplies: false }), "Withholding tax")).toBe(0);
  });
  it("a missing rule is reported, never guessed", () => {
    const r = slip(php(40000), {}, { rules: { ...ph().rules, sss: null, table: null } });
    expect(r.warnings.some((w) => w.includes("No SSS rule"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("withholding table"))).toBe(true);
    expect(line(r, "Withholding tax")).toBe(0);
  });
});

describe("de minimis and the ₱90,000 yearly exemption", () => {
  const rice = rule<DeMinimisParams>("DM_RICE");
  it("rice subsidy: ₱2,500 a month is exempt, the excess is not", () => {
    const s = deMinimisSplit({ code: "DM_RICE", amountCents: php(3000), rule: rice, payDate: "2026-10-31", used: [], dailyRateCents: 0 });
    expect([s.exemptCents, s.excessCents]).toEqual([php(2500), php(500)]);
  });
  it("counts what was already paid in the same month, but not other months", () => {
    const used = [{ code: "DM_RICE", payDate: "2026-10-15", exemptCents: php(1250) }, { code: "DM_RICE", payDate: "2026-09-30", exemptCents: php(2500) }];
    const s = deMinimisSplit({ code: "DM_RICE", amountCents: php(1250), rule: rice, payDate: "2026-10-31", used, dailyRateCents: 0 });
    expect(s.exemptCents).toBe(php(1250));
    const again = deMinimisSplit({ code: "DM_RICE", amountCents: php(1250), rule: rice, payDate: "2026-10-31", used: [...used, { code: "DM_RICE", payDate: "2026-10-31", exemptCents: php(1250) }], dailyRateCents: 0 });
    expect(again.exemptCents).toBe(0);
  });
  it("medical allowance for dependents is per semester, uniform per year", () => {
    const med = rule<DeMinimisParams>("DM_MEDICAL_DEPENDENTS");
    const used = [{ code: "DM_MEDICAL_DEPENDENTS", payDate: "2026-03-31", exemptCents: php(2000) }];
    expect(deMinimisSplit({ code: "DM_MEDICAL_DEPENDENTS", amountCents: php(2000), rule: med, payDate: "2026-09-30", used, dailyRateCents: 0 }).exemptCents).toBe(php(2000));
    expect(deMinimisSplit({ code: "DM_MEDICAL_DEPENDENTS", amountCents: php(2000), rule: med, payDate: "2026-05-31", used, dailyRateCents: 0 }).exemptCents).toBe(0);
  });
  it("monetized leave is limited in days of pay", () => {
    const m = rule<DeMinimisParams>("DM_LEAVE_MONETIZED", "2026-10-31", "PRIVATE");
    const s = deMinimisSplit({ code: "DM_LEAVE_MONETIZED", amountCents: php(20000), rule: m, payDate: "2026-12-15", used: [], dailyRateCents: php(1000) });
    expect([s.ceilingCents, s.exemptCents, s.excessCents]).toEqual([php(12000), php(12000), php(8000)]);
  });
  it("the yearly pool: ₱90,000 is exempt, the rest is taxable", () => {
    expect(poolSplit(php(100000), php(90000), 0)).toEqual({ exemptCents: php(90000), taxableCents: php(10000) });
    expect(poolSplit(php(20000), php(90000), php(80000))).toEqual({ exemptCents: php(10000), taxableCents: php(10000) });
  });
  it("a payslip keeps de minimis inside the ceiling out of tax and sends the excess to the pool", () => {
    const r = slip(php(40000), { components: [{ name: "Rice", kind: "EARNING", calc: "FIXED", value: php(3000), taxable: true, taxClass: "DE_MINIMIS", deMinimisCode: "DM_RICE" }] });
    expect(r.tax!.nonTaxableCents).toBe(php(3000)); // 2,500 de minimis + 500 inside the ₱90,000 pool
    expect(r.tax!.benefitsExemptCents).toBe(php(500));
    expect(line(r, "Withholding tax")).toBe(line(slip(php(40000)), "Withholding tax"));
  });
});

describe("13th month and year-end adjustment", () => {
  it("13th month is one twelfth of the basic pay earned in the year", () => {
    expect(thirteenthMonth(php(480000))).toBe(php(40000));
  });
  it("a 13th month payroll pays it, keeps ₱90,000 exempt and flags the excess", () => {
    const r = slip(php(150000), {}, { kind: "THIRTEENTH_MONTH", ytd: { taxableCents: 0, benefitsTaxableCents: 0, benefitsExemptCents: 0, taxWithheldCents: 0, basicEarnedCents: php(1800000), deMinimis: [] } });
    expect(line(r, "13th month pay")).toBe(php(150000));
    expect(r.tax!.benefitsExemptCents).toBe(php(90000));
    expect(r.tax!.benefitsTaxableCents).toBe(php(60000));
    expect(r.warnings.join(" ")).toMatch(/year-end adjustment/);
    expect(line(r, "SSS")).toBe(0); // no contributions on a 13th month payroll
  });
  it("part of the exemption already used elsewhere in the year counts", () => {
    const r = slip(php(40000), {}, { kind: "THIRTEENTH_MONTH", ytd: { taxableCents: 0, benefitsTaxableCents: 0, benefitsExemptCents: php(70000), taxWithheldCents: 0, basicEarnedCents: php(480000), deMinimis: [] } });
    expect([r.tax!.benefitsExemptCents, r.tax!.benefitsTaxableCents]).toEqual([php(20000), php(20000)]);
  });
  it("year-end adjustment: more tax when under-withheld, refund when over-withheld", () => {
    const annual = table("ANNUAL_TAX");
    const under = yearEndAdjustment(annual, { taxableCents: php(500000), benefitsTaxableCents: 0, taxWithheldCents: php(20000) }, { taxableCents: php(100000), benefitsTaxableCents: 0, taxWithheldCents: php(5000) });
    // tax on 600,000 = 22,500 + 20% x 200,000 = 62,500; withheld 25,000
    expect([under.annualTaxCents, under.adjustmentCents]).toEqual([php(62500), php(37500)]);
    const over = yearEndAdjustment(annual, { taxableCents: php(200000), benefitsTaxableCents: 0, taxWithheldCents: php(30000) }, { taxableCents: 0, benefitsTaxableCents: 0, taxWithheldCents: 0 });
    expect(over.adjustmentCents).toBe(-php(30000)); // 200,000 is under the ₱250,000 threshold: everything comes back
  });
  it("a year-end payslip includes taxable benefits and the earlier employer's figures", () => {
    // 11 months already taxed 440,000 (withheld 20,000) plus 10,000 of taxable benefits; this month's taxable pay is added and the year is trued up.
    const ytd = { taxableCents: php(440000), benefitsTaxableCents: php(10000), benefitsExemptCents: php(90000), taxWithheldCents: php(20000), basicEarnedCents: 0, deMinimis: [] };
    const r = slip(php(46000), {}, { yearEnd: true, ytd });
    const taxableNow = r.tax!.taxableCents;
    const annualTaxable = php(440000) + php(10000) + taxableNow;
    const expectedAnnual = bracketTax(table("ANNUAL_TAX"), annualTaxable);
    const withholdingNow = line(r, "Withholding tax");
    expect(r.tax!.taxWithheldCents).toBe(expectedAnnual - php(20000)); // after the true-up the year's total withheld equals the annual tax
    expect(withholdingNow + (r.lines.find((l) => l.code === "TAX_ADJUSTMENT")?.amountCents ?? 0)).toBe(expectedAnnual - php(20000));
  });
});

describe("holiday, rest day, overtime and night pay", () => {
  const p = rule<PremiumParams>("PREMIUMS");
  const day = (o: Partial<PayDay> = {}): PayDay => ({ day: "2026-12-25", holiday: null, doubleHoliday: false, restDay: false, scheduled: true, workedMinutes: 480, otMinutes: 0, nightRegularMinutes: 0, nightOtMinutes: 0, onPaidLeave: false, holidayEligible: true, ...o });
  it("multipliers match the DOLE table", () => {
    const m = (o: Partial<PayDay>) => multiplierBp(day(o), p);
    expect(m({})).toBe(10000);
    expect(m({ restDay: true })).toBe(13000);
    expect(m({ holiday: "SPECIAL_NON_WORKING" })).toBe(13000);
    expect(m({ holiday: "SPECIAL_NON_WORKING", restDay: true })).toBe(15000);
    expect(m({ holiday: "REGULAR" })).toBe(20000);
    expect(m({ holiday: "REGULAR", restDay: true })).toBe(26000);
    expect(m({ holiday: "REGULAR", doubleHoliday: true })).toBe(30000);
    expect(m({ holiday: "REGULAR", doubleHoliday: true, restDay: true })).toBe(39000);
    expect(m({ holiday: "SPECIAL_WORKING" })).toBe(10000);
  });
  const run = (payType: "MONTHLY" | "DAILY" | "HOURLY", d: PayDay, factor = 261) =>
    premiumPay({ payType, dailyCents: php(1000), hourlyCents: php(125), hoursPerDay: 8, factor, days: [d], p, otFloorBp: 12500 });
  it("regular holiday worked 8 hours: a monthly employee gets the extra 100%, since the salary already covers the day", () => {
    expect(run("MONTHLY", day({ holiday: "REGULAR" })).holidayCents).toBe(php(1000));
  });
  it("special non-working day worked: +30%", () => {
    expect(run("MONTHLY", day({ holiday: "SPECIAL_NON_WORKING" })).holidayCents).toBe(php(300));
  });
  it("rest day worked: monthly staff on a 261 or 313 factor get the whole 130%, on 365 only the extra 30%", () => {
    expect(run("MONTHLY", day({ restDay: true, scheduled: false }), 313).restDayCents).toBe(php(1300));
    expect(run("MONTHLY", day({ restDay: true, scheduled: false }), 365).restDayCents).toBe(php(300));
  });
  it("daily-paid staff already got 100% in basic pay, so premium days add only the extra", () => {
    expect(run("DAILY", day({ restDay: true, scheduled: false })).restDayCents).toBe(php(300));
    expect(run("DAILY", day({ holiday: "REGULAR", restDay: true })).holidayCents).toBe(php(1600));
  });
  it("overtime: 125% on an ordinary day, 130% of the day's rate on a rest day or holiday", () => {
    expect(run("MONTHLY", day({ workedMinutes: 600, otMinutes: 120 })).overtimeCents).toBe(php(125 * 2 * 1.25));
    expect(run("MONTHLY", day({ restDay: true, workedMinutes: 600, otMinutes: 120 })).overtimeCents).toBe(php(125 * 2 * 1.3 * 1.3));
    expect(run("MONTHLY", day({ holiday: "REGULAR", workedMinutes: 600, otMinutes: 120 })).overtimeCents).toBe(php(125 * 2 * 2 * 1.3));
  });
  it("company overtime above the legal minimum is honored, never below it", () => {
    const high = premiumPay({ payType: "MONTHLY", dailyCents: php(1000), hourlyCents: php(125), hoursPerDay: 8, factor: 261, days: [day({ workedMinutes: 540, otMinutes: 60 })], p, otFloorBp: 15000 });
    expect(high.overtimeCents).toBe(php(125 * 1.5));
    const low = premiumPay({ payType: "MONTHLY", dailyCents: php(1000), hourlyCents: php(125), hoursPerDay: 8, factor: 261, days: [day({ workedMinutes: 540, otMinutes: 60 })], p, otFloorBp: 10000 });
    expect(low.overtimeCents).toBe(php(125 * 1.25));
  });
  it("night differential is 10% of the hourly rate for each night hour", () => {
    expect(run("MONTHLY", day({ nightRegularMinutes: 360 })).nightCents).toBe(php(125 * 6 * 0.1));
    expect(run("MONTHLY", day({ holiday: "REGULAR", nightRegularMinutes: 360 })).nightCents).toBe(php(125 * 2 * 6 * 0.1));
  });
  it("unworked regular holiday: paid to daily staff who were present the day before, not to others; monthly staff are already covered", () => {
    expect(run("DAILY", day({ holiday: "REGULAR", workedMinutes: 0 })).unworkedHolidayCents).toBe(php(1000));
    expect(run("DAILY", day({ holiday: "REGULAR", workedMinutes: 0, holidayEligible: false })).unworkedHolidayCents).toBe(0);
    expect(run("MONTHLY", day({ holiday: "REGULAR", workedMinutes: 0 })).unworkedHolidayCents).toBe(0);
  });
  it("unworked special non-working day: no work, no pay, unless the company policy pays it", () => {
    expect(run("DAILY", day({ holiday: "SPECIAL_NON_WORKING", workedMinutes: 0 })).unworkedHolidayCents).toBe(0);
    const policy = premiumPay({ payType: "DAILY", dailyCents: php(1000), hourlyCents: php(125), hoursPerDay: 8, factor: 261, days: [day({ holiday: "SPECIAL_NON_WORKING", workedMinutes: 0 })], p: { ...p, payUnworkedSpecialNonWorking: true }, otFloorBp: 12500 });
    expect(policy.unworkedHolidayCents).toBe(php(1000));
  });
  it("a payslip pays a worked regular holiday and does not dock a monthly employee for the unworked ones", () => {
    const days = [day({ holiday: "REGULAR" })];
    const r = slip(php(26100), { payType: "MONTHLY" }, { payDays: days, annualFactor: 261 });
    expect(line(r, "Holiday premium")).toBe(php(1200)); // 26,100 x 12 / 261 = 1,200 a day; the salary already pays 100%, the holiday adds another 100%
  });
});

describe("night hours from the actual clock times", () => {
  const tz = "Asia/Manila";
  const at = (s: string) => new Date(`${s}+08:00`);
  it("counts only the part between 10pm and 6am", () => {
    const spans = [{ start: at("2026-10-05T18:00:00"), end: at("2026-10-06T03:00:00") }];
    expect(nightMinutes(spans, tz, 22 * 60, 6 * 60)).toBe(5 * 60);
  });
  it("a whole night shift is 8 night hours", () => {
    const spans = [{ start: at("2026-10-05T22:00:00"), end: at("2026-10-06T06:00:00") }];
    expect(nightMinutes(spans, tz, 22 * 60, 6 * 60)).toBe(8 * 60);
  });
  it("a day shift has none; early morning hours do count", () => {
    expect(nightMinutes([{ start: at("2026-10-05T08:00:00"), end: at("2026-10-05T17:00:00") }], tz, 1320, 360)).toBe(0);
    expect(nightMinutes([{ start: at("2026-10-05T04:00:00"), end: at("2026-10-05T10:00:00") }], tz, 1320, 360)).toBe(120);
  });
  it("removes unpaid breaks, and the last overtime minutes are separate", () => {
    const s: Session = { inAt: at("2026-10-05T20:00:00"), outAt: at("2026-10-06T02:00:00"), pauses: [{ startAt: at("2026-10-05T23:00:00"), endAt: at("2026-10-06T00:00:00"), name: "Meal", typeId: null, paid: false, allowedMinutes: 60 }] };
    const spans = workIntervals([s]);
    expect(spans.length).toBe(2);
    const { regular, overtime } = splitTail(spans, 60);
    // worked: 20:00-23:00 and 00:00-02:00; the last hour (01:00-02:00) is overtime
    expect(overtime.reduce((n, x) => n + (x.end.getTime() - x.start.getTime()), 0)).toBe(60 * 60_000);
    expect(nightMinutes(regular, tz, 1320, 360)).toBe(2 * 60); // 22:00-23:00 and 00:00-01:00
    expect(nightMinutes(overtime, tz, 1320, 360)).toBe(60);
    expect(nightMinutes(spans, tz, 1320, 360)).toBe(3 * 60);
  });
});

describe("pay days from the DTR", () => {
  const tz = "Asia/Manila";
  const at = (s: string) => new Date(`${s}+08:00`);
  const row = (day: string, o: Partial<DtrDay> = {}): DtrDay => ({ day, status: "PRESENT", firstIn: null, lastOut: null, workedMinutes: 480, breakMinutes: 60, pauses: [], overLimitMinutes: 0, lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, shift: { startTime: "08:00", endTime: "17:00", breakMinutes: 60 }, ...o });
  it("marks rest days, holidays, and whether the day before was worked", () => {
    const p = rule<PremiumParams>("PREMIUMS");
    const days = buildPayDays({
      rows: [row("2026-12-23"), row("2026-12-24", { status: "ABSENT", workedMinutes: 0 }), row("2026-12-25", { status: "ABSENT", workedMinutes: 0 }), row("2026-12-26", { shift: null, status: "PRESENT" })],
      holidays: new Map([["2026-12-25", ["REGULAR" as const]]]), dayOff: new Set(["2026-12-26"]), paidLeave: new Set(), approvedOvertime: new Map(), sessionsByDay: new Map(), tz, premium: p,
    });
    expect(days[2]).toMatchObject({ holiday: "REGULAR", holidayEligible: false }); // absent the day before
    expect(days[3]).toMatchObject({ restDay: true, scheduled: false });
    expect(days[0].holidayEligible).toBe(true);
  });
  it("caps approved overtime at what was measured, and puts it on rest days too", () => {
    const p = rule<PremiumParams>("PREMIUMS");
    const sessions = new Map([["2026-10-06", [{ inAt: at("2026-10-06T08:00:00"), outAt: at("2026-10-06T19:00:00"), pauses: [] }]]]);
    const days = buildPayDays({
      rows: [row("2026-10-06", { workedMinutes: 660, overtimeMinutes: 120 })], holidays: new Map(), dayOff: new Set(), paidLeave: new Set(),
      approvedOvertime: new Map([["2026-10-06", 300]]), sessionsByDay: sessions, tz, premium: p,
    });
    expect(days[0].otMinutes).toBe(120);
  });
});

describe("government incentives", () => {
  it("year-end bonus is a month of basic pay plus the cash gift, for those with enough service", () => {
    const rules = { ...ph().rules, incentive: { label: "Year-end bonus and cash gift", months: 1, amountCents: php(5000), minServiceMonths: 4, asOf: "10-31" } };
    const ok = slip(php(30000), {}, { kind: "GOV_INCENTIVE", sector: "GOVERNMENT", rules, serviceMonths: 10 });
    expect(line(ok, "Year-end bonus and cash gift")).toBe(php(35000));
    expect(ok.tax!.benefitsExemptCents).toBe(php(35000));
    const newHire = slip(php(30000), {}, { kind: "GOV_INCENTIVE", sector: "GOVERNMENT", rules, serviceMonths: 2 });
    expect(newHire.grossCents).toBe(0);
    expect(newHire.warnings.join(" ")).toMatch(/Not eligible/);
    const priv = slip(php(30000), {}, { kind: "GOV_INCENTIVE", sector: "PRIVATE", rules, serviceMonths: 10 });
    expect(priv.grossCents).toBe(0);
  });
});

describe("the manual payroll is untouched", () => {
  it("without a Philippine profile the old calculator runs", () => {
    const r = computePayslip({
      payType: "MONTHLY", rateCents: php(20000), attendance: attendance(), factors: { workDaysPerMonth: 22, hoursPerDay: 8, otMultiplierBp: 12500, periodsPerMonth: 2 },
      components: [], contributions: [], brackets: [] as Bracket[], adjustments: [],
    });
    expect(r.grossCents).toBe(php(10000));
    expect(r.tax).toBeUndefined();
  });
});

describe("holidays fixed by law", () => {
  it("Easter and Holy Week", () => {
    expect([easter(2024), easter(2025), easter(2026)]).toEqual(["2024-03-31", "2025-04-20", "2026-04-05"]);
    const h = standardHolidays(2026);
    expect(h.find((x) => x.name === "Good Friday")).toMatchObject({ date: "2026-04-03", type: "REGULAR" });
    expect(h.find((x) => x.name === "Maundy Thursday")!.date).toBe("2026-04-02");
    expect(h.find((x) => x.name === "Black Saturday")).toMatchObject({ date: "2026-04-04", type: "SPECIAL_NON_WORKING" });
  });
  it("National Heroes Day is the last Monday of August", () => {
    expect(standardHolidays(2026).find((x) => x.name === "National Heroes Day")!.date).toBe("2026-08-31");
    expect(standardHolidays(2025).find((x) => x.name === "National Heroes Day")!.date).toBe("2025-08-25");
  });
  it("lists 15 holidays, regular and special", () => {
    const h = standardHolidays(2026);
    expect(h.length).toBe(15);
    expect(h.filter((x) => x.type === "REGULAR").length).toBe(10); // Eid'l Fitr and Eid'l Adha are proclaimed each year
  });
});

describe("benefit estimates", () => {
  it("SSS sickness: 90% of the average daily salary credit, up to 120 days", () => {
    const r = sssSickness(Array(6).fill(php(25000)), 10);
    expect([r.adscCents, r.dailyCents, r.totalCents]).toEqual([php(833.33), php(750), php(7500)]);
    expect(sssSickness(Array(6).fill(php(25000)), 200)).toMatchObject({ paidDays: 120, cappedDays: true });
  });
  it("uses only the six highest credits", () => {
    expect(adsc([php(5000), php(25000), php(25000), php(25000), php(25000), php(25000), php(25000), php(10000)]).adscCents).toBe(php(833.33));
  });
  it("SSS maternity: 105 days at the daily credit, the employer pays the difference to full pay", () => {
    const r = sssMaternity(Array(6).fill(php(25000)), "LIVE_BIRTH", php(1150));
    expect([r.days, r.sssCents, r.employerDifferentialCents]).toEqual([105, php(833.33) * 105, php(316.67) * 105]);
    expect(sssMaternity(Array(6).fill(php(25000)), "SOLO_PARENT", php(1150)).days).toBe(120);
    expect(sssMaternity(Array(6).fill(php(25000)), "MISCARRIAGE", php(1150)).days).toBe(60);
  });
  it("GSIS retirement: pension, 5-year lump sum and cash option", () => {
    const r = gsisRetirement(php(40000), 25);
    expect(r).toMatchObject({ eligible: true, ramcCents: php(40700), bmpCents: php(25437.5) });
    if (r.eligible) expect([r.option1LumpSumCents, r.option2CashCents]).toEqual([php(25437.5) * 60, php(25437.5) * 18]);
    expect(gsisRetirement(php(40000), 14).eligible).toBe(false);
    const capped = gsisRetirement(php(40000), 40);
    if (capped.eligible) expect(capped.bmpCents).toBe(php(36000)); // never above 90% of the average monthly compensation
  });
  it("terminal leave: credits x monthly salary x 0.0481927", () => {
    expect(terminalLeave(120, php(40000))).toBe(php(231324.96));
  });
});
