// Cash advance repayment. Pure: dates and amounts in, the installment plan out.
// Installments are equal; the last one takes the leftover centavos so the plan always adds up to the amount exactly.
// The plan starts with the cut-off after the one the advance was approved in, and each cut-off of the plan takes one
// installment. A payroll period takes the installments whose cut-off starts inside it, so recalculating never doubles one.
import { addDays } from "@/lib/time";
import { cutoffFor, type Cutoff } from "@/lib/cutoffs";

export const MAX_INSTALLMENTS = 12;

export function firstRepaymentCutoff(approvedDay: string): Cutoff {
  return cutoffFor(addDays(cutoffFor(approvedDay).end, 1));
}

export function installmentPlan(amountCents: number, installments: number, firstCutoffStart: string): { cutoff: Cutoff; cents: number }[] {
  const n = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(installments)));
  const each = Math.floor(amountCents / n);
  const plan: { cutoff: Cutoff; cents: number }[] = [];
  let c = cutoffFor(firstCutoffStart);
  for (let i = 0; i < n; i++) {
    plan.push({ cutoff: c, cents: i === n - 1 ? amountCents - each * (n - 1) : each });
    c = cutoffFor(addDays(c.end, 1));
  }
  return plan;
}

// What a payroll period from `start` to `end` deducts for one advance.
export function dueInPeriod(plan: { cutoff: Cutoff; cents: number }[], start: string, end: string): number {
  return plan.filter((p) => p.cutoff.start >= start && p.cutoff.start <= end).reduce((n, p) => n + p.cents, 0);
}
