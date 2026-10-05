import { describe, expect, it } from "vitest";
import type { DtrDay } from "./dtr";
import { buildAttendance, computePayslip, type Attendance, type PayInput } from "./payroll";
import { formatMoney, parsePercent, parsePesos } from "./money";

// Factors: 22 work days a month, 8 hours a day, overtime 1.25x, paid twice a month.
// Monthly 22,000.00 -> period basic 11,000.00, daily rate 1,000.00, minute rate 2.0833...
const factors = { workDaysPerMonth: 22, hoursPerDay: 8, otMultiplierBp: 12500, periodsPerMonth: 2 };
const none: Attendance = { scheduledDays: 11, presentDays: 11, incompleteDays: 0, absentDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, lateMinutes: 0, undertimeMinutes: 0, workedMinutes: 11 * 480, approvedOvertimeMinutes: 0 };
const base = (over: Partial<PayInput> = {}): PayInput => ({ payType: "MONTHLY", rateCents: 2_200_000, attendance: none, factors, components: [], contributions: [], brackets: [], adjustments: [], ...over });
const line = (r: ReturnType<typeof computePayslip>, code: string, label?: string) => r.lines.find((l) => l.code === code && (!label || l.label === label));

describe("monthly pay", () => {
  it("pays half the monthly rate with perfect attendance", () => {
    const r = computePayslip(base());
    expect(r.grossCents).toBe(1_100_000);
    expect(r.netCents).toBe(1_100_000);
    expect(r.deductionsCents).toBe(0);
  });

  it("takes absences, late and undertime off, and adds approved overtime", () => {
    const r = computePayslip(base({ attendance: { ...none, absentDays: 1, lateMinutes: 30, undertimeMinutes: 15, approvedOvertimeMinutes: 60 } }));
    expect(line(r, "ABSENCE")?.amountCents).toBe(100_000); // 1 day x 1,000.00
    expect(line(r, "LATE")?.amountCents).toBe(6_250); // 30 min x 2.0833
    expect(line(r, "UNDERTIME")?.amountCents).toBe(3_125);
    expect(line(r, "OVERTIME")?.amountCents).toBe(15_625); // 60 min x 2.0833 x 1.25
    expect(r.grossCents).toBe(1_115_625);
    expect(r.deductionsCents).toBe(109_375);
    expect(r.netCents).toBe(1_006_250);
  });

  it("takes unpaid leave off but not paid leave", () => {
    const r = computePayslip(base({ attendance: { ...none, paidLeaveDays: 1, unpaidLeaveDays: 2 } }));
    expect(line(r, "UNPAID_LEAVE")?.amountCents).toBe(200_000);
    expect(r.netCents).toBe(900_000);
  });
});

describe("daily and hourly pay", () => {
  it("daily: pays worked and paid-leave days, not absences, and takes lost minutes off", () => {
    const r = computePayslip(base({ payType: "DAILY", rateCents: 100_000, attendance: { ...none, presentDays: 10, paidLeaveDays: 1, absentDays: 2, lateMinutes: 20 } }));
    expect(line(r, "BASIC")?.amountCents).toBe(1_100_000); // 11 days
    expect(line(r, "ABSENCE")).toBeUndefined(); // an unpaid absence is simply not paid
    expect(line(r, "LATE")?.amountCents).toBe(4_167); // 20 x 208.33 centavos per minute... rounds from 4166.67
    expect(r.netCents).toBe(1_095_833);
  });

  it("hourly: pays worked hours, splits out overtime, never deducts lateness", () => {
    const r = computePayslip(base({ payType: "HOURLY", rateCents: 12_500, attendance: { ...none, workedMinutes: 4_800, approvedOvertimeMinutes: 120, lateMinutes: 45 } }));
    expect(line(r, "BASIC")?.amountCents).toBe(975_000); // 78 regular hours x 125.00
    expect(line(r, "OVERTIME")?.amountCents).toBe(31_250); // 2 h x 125.00 x 1.25
    expect(line(r, "LATE")).toBeUndefined();
    expect(r.grossCents).toBe(1_006_250);
  });
});

describe("allowances, deductions and adjustments", () => {
  it("adds earnings, subtracts deductions, supports a percent of basic", () => {
    const r = computePayslip(
      base({
        components: [
          { name: "Transport", kind: "EARNING", calc: "FIXED", value: 100_000, taxable: false },
          { name: "Performance bonus", kind: "EARNING", calc: "PERCENT_OF_BASIC", value: 1000, taxable: true },
          { name: "Company loan", kind: "DEDUCTION", calc: "FIXED", value: 50_000, taxable: true },
        ],
      }),
    );
    expect(r.grossCents).toBe(1_310_000); // 11,000 + 1,000 + 10% of 11,000
    expect(r.deductionsCents).toBe(50_000);
    expect(r.netCents).toBe(1_260_000);
  });

  it("applies one-off adjustments in both directions", () => {
    const r = computePayslip(base({ adjustments: [{ kind: "EARNING", label: "Correction: underpaid last period", amountCents: 25_000 }, { kind: "DEDUCTION", label: "Uniform", amountCents: 10_000 }] }));
    expect(r.grossCents).toBe(1_125_000);
    expect(r.netCents).toBe(1_115_000);
  });
});

describe("contributions and tax", () => {
  it("splits contributions between employee and employer", () => {
    const r = computePayslip(base({ contributions: [{ name: "Pension", employeeBp: 450, employerBp: 950, minBaseCents: 0, maxBaseCents: null }] }));
    expect(line(r, "CONTRIBUTION")?.amountCents).toBe(49_500); // 4.5% of 11,000.00
    expect(line(r, "EMPLOYER_CONTRIBUTION")?.amountCents).toBe(104_500);
    expect(r.netCents).toBe(1_050_500);
    expect(r.employerCostCents).toBe(1_100_000 + 104_500); // the employer share never reduces pay but is a cost
  });

  it("keeps the base between the lower and upper limit", () => {
    const capped = computePayslip(base({ contributions: [{ name: "Capped", employeeBp: 200, employerBp: 0, minBaseCents: 0, maxBaseCents: 1_000_000 }] }));
    expect(line(capped, "CONTRIBUTION")?.amountCents).toBe(20_000); // 2% of the 10,000.00 cap, not of 11,000.00
    const floored = computePayslip(base({ contributions: [{ name: "Floored", employeeBp: 200, employerBp: 0, minBaseCents: 1_500_000, maxBaseCents: null }] }));
    expect(line(floored, "CONTRIBUTION")?.amountCents).toBe(30_000);
  });

  it("rounds half-up, line by line", () => {
    const r = computePayslip(base({ payType: "DAILY", rateCents: 10_100, attendance: { ...none, presentDays: 1 }, contributions: [{ name: "Half", employeeBp: 50, employerBp: 0, minBaseCents: 0, maxBaseCents: null }] }));
    expect(line(r, "BASIC")?.amountCents).toBe(10_100);
    expect(line(r, "CONTRIBUTION")?.amountCents).toBe(51); // 50.5 -> 51
  });

  it("withholds tax from the bracket reached, on taxable pay only", () => {
    const brackets = [{ fromCents: 0, rateBp: 0, fixedCents: 0 }, { fromCents: 1_000_000, rateBp: 2000, fixedCents: 0 }];
    const r = computePayslip(base({ brackets }));
    expect(line(r, "TAX")?.amountCents).toBe(20_000); // 20% of the 1,000.00 over 10,000.00
    // A non-taxable allowance does not raise the tax.
    const withAllowance = computePayslip(base({ brackets, components: [{ name: "Transport", kind: "EARNING", calc: "FIXED", value: 100_000, taxable: false }] }));
    expect(line(withAllowance, "TAX")?.amountCents).toBe(20_000);
    expect(withAllowance.netCents).toBe(1_100_000 + 100_000 - 20_000);
  });

  it("taxes less when contributions and absences lower the taxable amount", () => {
    const brackets = [{ fromCents: 0, rateBp: 1000, fixedCents: 0 }];
    const r = computePayslip(base({ brackets, contributions: [{ name: "Pension", employeeBp: 1000, employerBp: 0, minBaseCents: 0, maxBaseCents: null }], attendance: { ...none, absentDays: 1 } }));
    // gross 1,100,000 - absence 100,000 - contribution 110,000 = 890,000 taxable; 10% = 89,000
    expect(line(r, "TAX")?.amountCents).toBe(89_000);
  });

  it("pays no tax without brackets or on zero taxable pay", () => {
    expect(line(computePayslip(base()), "TAX")).toBeUndefined();
    const brackets = [{ fromCents: 0, rateBp: 1000, fixedCents: 5000 }];
    expect(line(computePayslip(base({ rateCents: 0, brackets })), "TAX")).toBeUndefined();
  });
});

describe("integrity", () => {
  it("is deterministic and its lines add up to the totals", () => {
    const input = base({
      attendance: { ...none, absentDays: 1, lateMinutes: 12, approvedOvertimeMinutes: 90 },
      components: [{ name: "Meal", kind: "EARNING", calc: "FIXED", value: 55_555, taxable: true }, { name: "Loan", kind: "DEDUCTION", calc: "PERCENT_OF_BASIC", value: 333, taxable: true }],
      contributions: [{ name: "A", employeeBp: 275, employerBp: 600, minBaseCents: 0, maxBaseCents: null }],
      brackets: [{ fromCents: 500_000, rateBp: 1500, fixedCents: 1_000 }],
    });
    const a = computePayslip(input);
    expect(computePayslip(input)).toEqual(a);
    const earnings = a.lines.filter((l) => l.kind === "EARNING").reduce((n, l) => n + l.amountCents, 0);
    const deductions = a.lines.filter((l) => l.kind === "DEDUCTION").reduce((n, l) => n + l.amountCents, 0);
    expect(earnings).toBe(a.grossCents);
    expect(deductions).toBe(a.deductionsCents);
    expect(a.netCents).toBe(a.grossCents - a.deductionsCents);
    expect(a.lines.every((l) => Number.isInteger(l.amountCents))).toBe(true);
    expect(a.lines.every((l) => l.detail)).toBe(true); // every line explains itself
  });

  it("warns when net pay is below zero or days have no clock-out", () => {
    const neg = computePayslip(base({ components: [{ name: "Big loan", kind: "DEDUCTION", calc: "FIXED", value: 2_000_000, taxable: true }] }));
    expect(neg.netCents).toBeLessThan(0);
    expect(neg.warnings.join(" ")).toMatch(/below zero/);
    const open = computePayslip(base({ payType: "DAILY", rateCents: 100_000, attendance: { ...none, presentDays: 3, incompleteDays: 1 } }));
    expect(open.warnings.join(" ")).toMatch(/no clock-out/);
    expect(line(open, "BASIC")?.amountCents).toBe(300_000); // the open day is not paid
  });
});

describe("buildAttendance", () => {
  const shift = { startTime: "08:00", endTime: "17:00", breakMinutes: 60 };
  const row = (day: string, status: DtrDay["status"], over: Partial<DtrDay> = {}): DtrDay => ({
    day, status, firstIn: null, lastOut: null, workedMinutes: 0, breakMinutes: 0, pauses: [], overLimitMinutes: 0, lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, shift, ...over,
  });
  it("counts days by what happened and caps approved overtime at what was measured", () => {
    const a = buildAttendance(
      [
        row("2026-10-05", "PRESENT", { workedMinutes: 480, lateMinutes: 10, overtimeMinutes: 60 }),
        row("2026-10-06", "PRESENT", { workedMinutes: 500, undertimeMinutes: 5, overtimeMinutes: 30 }),
        row("2026-10-07", "ABSENT"),
        row("2026-10-08", "LEAVE"),
        row("2026-10-09", "LEAVE"),
        row("2026-10-10", "INCOMPLETE"),
        row("2026-10-11", "DAY_OFF", { shift: null }),
        row("2026-10-12", "LEAVE", { shift: null }), // leave on an unscheduled day costs nothing
      ],
      new Set(["2026-10-08", "2026-10-12"]),
      new Set(["2026-10-09"]),
      new Map([["2026-10-05", 120], ["2026-10-06", 30]]), // approved 120 but only 60 was measured
    );
    expect(a).toMatchObject({ scheduledDays: 6, presentDays: 2, absentDays: 1, paidLeaveDays: 1, unpaidLeaveDays: 1, incompleteDays: 1, lateMinutes: 10, undertimeMinutes: 5, workedMinutes: 980, approvedOvertimeMinutes: 90 });
  });
});

describe("money helpers", () => {
  it("reads pesos and percentages strictly", () => {
    expect(parsePesos("1,234.50")).toBe(123_450);
    expect(parsePesos("₱ 99")).toBe(9_900);
    expect(parsePesos("12.345")).toBeNull();
    expect(parsePesos("-5")).toBeNull();
    expect(parsePesos("abc")).toBeNull();
    expect(parsePesos("99999999999")).toBeNull();
    expect(parsePercent("4.5")).toBe(450);
    expect(parsePercent("12.5%")).toBe(1250);
    expect(parsePercent("-1")).toBeNull();
    expect(formatMoney(123_450)).toContain("1,234.50");
  });
});
