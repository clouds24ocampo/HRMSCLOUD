import { describe, expect, it } from "vitest";
import { dueInPeriod, firstRepaymentCutoff, installmentPlan } from "./cash-advance";

describe("cash advance repayment plan", () => {
  it("starts the cut-off after approval", () => {
    expect(firstRepaymentCutoff("2026-10-07").start).toBe("2026-10-16");
    expect(firstRepaymentCutoff("2026-10-20").start).toBe("2026-11-01");
    expect(firstRepaymentCutoff("2026-12-31").start).toBe("2027-01-01");
  });
  it("splits ₱10,000 over 3 cut-offs exactly: 3,333.33 + 3,333.33 + 3,333.34", () => {
    const plan = installmentPlan(1_000_000, 3, "2026-10-16");
    expect(plan.map((p) => [p.cutoff.start, p.cents])).toEqual([["2026-10-16", 333_333], ["2026-11-01", 333_333], ["2026-11-16", 333_334]]);
    expect(plan.reduce((n, p) => n + p.cents, 0)).toBe(1_000_000);
  });
  it("each payroll period takes only its own installment, however often it is recalculated", () => {
    const plan = installmentPlan(1_000_000, 3, "2026-10-16");
    expect(dueInPeriod(plan, "2026-10-01", "2026-10-15")).toBe(0);
    expect(dueInPeriod(plan, "2026-10-16", "2026-10-31")).toBe(333_333);
    expect(dueInPeriod(plan, "2026-11-16", "2026-11-30")).toBe(333_334);
    expect(dueInPeriod(plan, "2026-12-01", "2026-12-15")).toBe(0);
    expect(dueInPeriod(plan, "2026-10-01", "2026-11-30")).toBe(1_000_000); // a monthly hand-made period takes both halves
  });
});
