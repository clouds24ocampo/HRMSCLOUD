import { describe, expect, it } from "vitest";
import { buildDtr, restDayViolations, type DtrDay, type Punch } from "./dtr";
import { buildAttendance, computePayslip, type Attendance, type PayInput } from "./payroll";
import { cutoffFor, previousCutoff } from "./cutoffs";
import { formatRate, payForMinutes } from "./money";
import { missing201, REQUIRED_201 } from "./file201";
import { rates } from "./ph/calc";
import { daysBetween, zonedTimeToUtc } from "./time";

const TZ = "Asia/Manila";
const at = (day: string, hm: string) => zonedTimeToUtc(day, Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)), TZ);
const p = (type: Punch["type"], d: string, hm: string): Punch => ({ type, at: at(d, hm) });

// The worked example from the business: ₱10,000 a month, 313 days a year, 8 hours a day.
describe("salary rates (monthly × 12 ÷ 313)", () => {
  const r = rates("MONTHLY", 1_000_000, 313, 8);
  it("daily and hourly rates match the hand calculation to 4 decimals", () => {
    expect(formatRate(r.daily)).toBe("₱383.3865");
    expect(formatRate(r.hourly)).toBe("₱47.9233");
    expect(formatRate((r.hourly * 7))).toBe("₱335.4632");
  });
  it("pays 7 logged hours as ₱335.46 (rounded once, to the centavo)", () => {
    expect(payForMinutes(1_000_000, 7 * 60, 313, 8)).toBe(33_546);
    expect(payForMinutes(1_000_000, 8 * 60, 313, 8)).toBe(38_339);
  });
});

describe("monthly salary paid by logged hours", () => {
  const factors = { workDaysPerMonth: 22, hoursPerDay: 8, otMultiplierBp: 12500, periodsPerMonth: 2, daysPerYear: 313, payByLoggedHours: true };
  const att = (o: Partial<Attendance>): Attendance => ({ scheduledDays: 1, presentDays: 1, incompleteDays: 0, absentDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, lateMinutes: 0, undertimeMinutes: 0, workedMinutes: 420, approvedOvertimeMinutes: 0, regularMinutes: 420, ...o });
  const input = (a: Attendance): PayInput => ({ payType: "MONTHLY", rateCents: 1_000_000, attendance: a, factors, components: [], contributions: [], brackets: [], adjustments: [] });

  it("one 7-hour day pays ₱335.46 with no separate late or undertime deduction", () => {
    const r = computePayslip(input(att({ undertimeMinutes: 60, lateMinutes: 15 })));
    expect(r.grossCents).toBe(33_546);
    expect(r.netCents).toBe(33_546);
    expect(r.lines.some((l) => l.code === "LATE" || l.code === "UNDERTIME" || l.code === "ABSENCE")).toBe(false);
  });
  it("13 full days (a 1–15 cut-off, Sundays off) pay 13 × daily rate", () => {
    const r = computePayslip(input(att({ presentDays: 13, workedMinutes: 13 * 480, regularMinutes: 13 * 480, absentDays: 2 })));
    expect(r.grossCents).toBe(payForMinutes(1_000_000, 13 * 480, 313, 8)); // 4,984.03
    expect(r.grossCents).toBe(498_403);
  });
  it("approved overtime is paid on top at the overtime rate; unapproved extra time is not", () => {
    const r = computePayslip(input(att({ workedMinutes: 600, regularMinutes: 480, approvedOvertimeMinutes: 60 })));
    const ot = r.lines.find((l) => l.code === "OVERTIME")!;
    expect(ot.amountCents).toBe(Math.round((1_000_000 * 12) / 313 / 8 / 60 * 60 * 1.25)); // 59.90
    expect(r.grossCents).toBe(38_339 + ot.amountCents);
  });
  it("government deductions are left off when none are passed in", () => {
    expect(computePayslip(input(att({}))).deductionsCents).toBe(0);
  });
});

describe("buildAttendance caps a day at the normal hours", () => {
  const row = (o: Partial<DtrDay>): DtrDay => ({ day: "2026-10-05", status: "PRESENT", firstIn: null, lastOut: null, workedMinutes: 0, workedSeconds: 0, breakMinutes: 0, breakSeconds: 0, issueMinutes: 0, issueSeconds: 0, productiveMinutes: 0, productiveSeconds: 0, grossSeconds: 0, productivityRate: 0, pauses: [], overLimitMinutes: 0, lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, shift: null, flex: true, ...o });
  it("counts worked minutes up to 8 h a day and leaves the rest to approved overtime", () => {
    const rows = [row({ workedMinutes: 600, overtimeMinutes: 120 }), row({ day: "2026-10-06", workedMinutes: 420 }), row({ day: "2026-10-07", status: "DAY_OFF" })];
    const a = buildAttendance(rows, new Set(), new Set(), new Map([["2026-10-05", 60]]), 480);
    expect(a.approvedOvertimeMinutes).toBe(60);
    expect(a.regularMinutes).toBe(480 + 420);
    expect(a.scheduledDays).toBe(2); // a flexible day off is not a planned day
  });
});

describe("flexible schedule DTR", () => {
  const days = daysBetween("2026-10-05", "2026-10-07");
  const run = (punches: Punch[]) => buildDtr({ days, punches, schedule: new Map(), leaveDays: new Set(), today: "2026-10-10", tz: TZ, graceMinutes: 10, flexMinutes: 480 });
  it("is never late; under 8 h is undertime, over 8 h is an overtime candidate; a day without punches is a day off", () => {
    const rows = run([p("IN", "2026-10-05", "11:00"), p("OUT", "2026-10-05", "17:00"), p("IN", "2026-10-06", "06:00"), p("OUT", "2026-10-06", "16:00")]);
    expect(rows[0]).toMatchObject({ status: "PRESENT", lateMinutes: 0, workedMinutes: 360, undertimeMinutes: 120, overtimeMinutes: 0, flex: true });
    expect(rows[1]).toMatchObject({ workedMinutes: 600, undertimeMinutes: 0, overtimeMinutes: 120 });
    expect(rows[2].status).toBe("DAY_OFF");
  });
  it("flags the 7th worked day in a row (at least one day off a week)", () => {
    const week = daysBetween("2026-10-05", "2026-10-12");
    const punches = week.slice(0, 7).flatMap((d) => [p("IN", d, "08:00"), p("OUT", d, "16:00")]);
    const rows = buildDtr({ days: week, punches, schedule: new Map(), leaveDays: new Set(), today: "2026-10-20", tz: TZ, graceMinutes: 10, flexMinutes: 480 });
    expect(restDayViolations(rows)).toEqual(["2026-10-11"]);
    expect(restDayViolations(rows.slice(0, 6))).toEqual([]);
  });
});

describe("semi-monthly cut-offs", () => {
  it("1–15 is paid on the month's last day; 16–end on the 15th of the next month", () => {
    expect(cutoffFor("2026-10-01")).toEqual({ name: "Oct 1–15, 2026", start: "2026-10-01", end: "2026-10-15", payDate: "2026-10-31" });
    expect(cutoffFor("2026-10-15").end).toBe("2026-10-15");
    expect(cutoffFor("2026-10-16")).toEqual({ name: "Oct 16–31, 2026", start: "2026-10-16", end: "2026-10-31", payDate: "2026-11-15" });
    expect(cutoffFor("2026-11-20").payDate).toBe("2026-12-15");
    expect(cutoffFor("2026-11-03").payDate).toBe("2026-11-30");
    expect(cutoffFor("2026-12-31").payDate).toBe("2027-01-15");
    expect(cutoffFor("2028-02-10").payDate).toBe("2028-02-29");
  });
  it("cut-offs never overlap and leave no gap", () => {
    for (const d of daysBetween("2026-01-01", "2027-12-31")) {
      const c = cutoffFor(d);
      expect(d >= c.start && d <= c.end).toBe(true);
      expect(previousCutoff(d).end < c.start).toBe(true);
    }
    expect(previousCutoff("2026-01-05").start).toBe("2025-12-16");
  });
});

describe("201 file", () => {
  it("lists what is still missing", () => {
    expect(missing201([])).toEqual(REQUIRED_201);
    expect(missing201(REQUIRED_201)).toEqual([]);
    expect(missing201(["NBI Clearance"])).not.toContain("NBI Clearance");
  });
});

describe("government contributions estimate (starter rules)", () => {
  it("₱10,000 a month: SSS 5%, PhilHealth 2.5%, Pag-IBIG 2% capped at ₱200, no tax", async () => {
    const { estimateMonth, STARTER_RULES } = await import("./statutory-estimate");
    const e = estimateMonth(1_000_000, STARTER_RULES, "2026-10-17");
    expect(e.social).toMatchObject({ label: "SSS", ee: 50_000 });
    expect(e.philhealth.ee).toBe(25_000);
    expect(e.pagibig.ee).toBe(20_000);
    expect(e.taxCents).toBe(0);
    expect(e.eeTotal).toBe(95_000);
  });
  it("a high salary pays withholding tax on pay after contributions", async () => {
    const { estimateMonth, STARTER_RULES } = await import("./statutory-estimate");
    expect(estimateMonth(5_000_000, STARTER_RULES, "2026-10-17").taxCents).toBeGreaterThan(0);
  });
});

describe("automatic time-out 30 minutes after a full day", () => {
  it("times out at 8 h 30 m of work; an unpaid meal pushes it later; approved overtime extends it", async () => {
    const { autoTimeoutAt, reachesWorkAt } = await import("./auto-timeout");
    const inAt = at("2026-10-05", "08:00");
    const plain = { inAt, outAt: null, pauses: [] };
    expect(autoTimeoutAt(plain, at("2026-10-05", "16:29"), 510)).toBeNull();
    expect(autoTimeoutAt(plain, at("2026-10-05", "16:31"), 510)?.toISOString()).toBe(at("2026-10-05", "16:30").toISOString());
    const meal = { inAt, outAt: null, pauses: [{ startAt: at("2026-10-05", "12:00"), endAt: at("2026-10-05", "13:00"), name: "Meal", typeId: "m", paid: false, allowedMinutes: 60, category: "BREAK" as const }] };
    expect(reachesWorkAt(meal, 510)?.toISOString()).toBe(at("2026-10-05", "17:30").toISOString());
    expect(autoTimeoutAt(plain, at("2026-10-05", "18:00"), 510 + 60)?.toISOString()).toBe(at("2026-10-05", "17:30").toISOString());
    // Still on an unpaid pause: work is not growing, so no time-out yet.
    const onMeal = { inAt, outAt: null, pauses: [{ startAt: at("2026-10-05", "12:00"), endAt: null, name: "Meal", typeId: "m", paid: false, allowedMinutes: 60, category: "BREAK" as const }] };
    expect(autoTimeoutAt(onMeal, at("2026-10-05", "18:00"), 510)).toBeNull();
    expect(autoTimeoutAt({ inAt, outAt: at("2026-10-05", "17:00"), pauses: [] }, at("2026-10-06", "08:00"), 510)).toBeNull();
  });
});

describe("issue time is deducted, then recovered on a later day of the cut-off", () => {
  it("a 2-hour rain stop is owed and paid back by extra time worked the next day, at the regular rate", async () => {
    const { recoveryCredit, buildAttendance } = await import("./payroll");
    const row = (o: Partial<DtrDay>): DtrDay => ({ day: "2026-10-05", status: "PRESENT", firstIn: null, lastOut: null, workedMinutes: 0, workedSeconds: 0, breakMinutes: 0, breakSeconds: 0, issueMinutes: 0, issueSeconds: 0, productiveMinutes: 0, productiveSeconds: 0, grossSeconds: 0, productivityRate: 0, pauses: [], overLimitMinutes: 0, lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, shift: null, flex: true, ...o });
    const rows = [
      row({ day: "2026-10-05", workedMinutes: 360, issueMinutes: 120, undertimeMinutes: 120 }), // 6 h worked, 2 h lost to rain
      row({ day: "2026-10-06", workedMinutes: 570, overtimeMinutes: 90 }), // 9 h 30 m: 1 h 30 m extra pays back part of the debt
      row({ day: "2026-10-07", workedMinutes: 540, overtimeMinutes: 60 }), // 1 h extra: 30 m left to recover, 30 m stays unpaid
    ];
    const credit = recoveryCredit(rows, new Map(), 480);
    expect([...credit]).toEqual([["2026-10-06", 90], ["2026-10-07", 30]]);
    const a = buildAttendance(rows, new Set(), new Set(), new Map(), 480);
    expect(a.regularMinutes).toBe(360 + 480 + 90 + 480 + 30); // 24 h: exactly 3 full days, nothing more
  });
  it("only issue time is recoverable, and not before it happens", async () => {
    const { recoveryCredit } = await import("./payroll");
    const row = (o: Partial<DtrDay>) => ({ day: "2026-10-05", status: "PRESENT" as const, workedMinutes: 480, overtimeMinutes: 0, issueMinutes: 0, ...o });
    // Extra time first, rain later: nothing to recover yet on the first day.
    expect([...recoveryCredit([row({ workedMinutes: 600, overtimeMinutes: 120 }), row({ day: "2026-10-06", workedMinutes: 420, issueMinutes: 60 })], new Map(), 480)]).toEqual([]);
    // Plain undertime (no issue) is not owed back.
    expect([...recoveryCredit([row({ workedMinutes: 420 }), row({ day: "2026-10-06", workedMinutes: 540, overtimeMinutes: 60 })], new Map(), 480)]).toEqual([]);
  });
});
