// Pure Philippine payroll arithmetic. Every function takes its rates as arguments (from dated StatutoryRule rows).
// Money is whole centavos; each result is rounded half-up on its own.
import type { Bracket, DeMinimisParams, Frequency, PercentParams, SssParams, TableParams } from "@/lib/ph/rules";

// Whole centavos, half rounded up. Every Philippine result is rounded with this on its own.
export const round = (n: number) => Math.round(n);

// ───────────── Wage factors (NWPC/DOLE equivalent-monthly-rate factors) ─────────────

export type WageBasis = "SIX_DAY_313" | "FIVE_DAY_261" | "ALL_DAYS_365" | "CUSTOM";
// Text shown to HR for each wage basis.
export const WAGE_BASIS_LABEL: Record<WageBasis, string> = {
  SIX_DAY_313: "6-day week (rest day not paid): 313 days a year",
  FIVE_DAY_261: "5-day week (Saturday and Sunday not paid): 261 days a year",
  ALL_DAYS_365: "Paid every calendar day: 365 days a year",
  CUSTOM: "Custom number of days a year",
};
// Paid days per year for a wage basis; null when CUSTOM is chosen without a value between 200 and 366.
export const annualFactor = (basis: WageBasis, custom?: number | null): number | null =>
  basis === "SIX_DAY_313" ? 313 : basis === "FIVE_DAY_261" ? 261 : basis === "ALL_DAYS_365" ? 365 : custom && custom >= 200 && custom <= 366 ? custom : null;

// A starting suggestion from the regular schedule; HR can always set it by hand.
export const suggestBasis = (workDaysPerWeek: number): WageBasis => (workDaysPerWeek >= 7 ? "ALL_DAYS_365" : workDaysPerWeek === 6 ? "SIX_DAY_313" : "FIVE_DAY_261");

export type PayType = "MONTHLY" | "DAILY" | "HOURLY";
// Daily, hourly and monthly rates (centavos) derived from the one pay rate and the wage factor.
export function rates(payType: PayType, rateCents: number, factor: number, hoursPerDay: number) {
  const daily = payType === "DAILY" ? rateCents : payType === "MONTHLY" ? (rateCents * 12) / factor : rateCents * hoursPerDay;
  const hourly = payType === "HOURLY" ? rateCents : daily / hoursPerDay;
  const monthly = payType === "MONTHLY" ? rateCents : round((daily * factor) / 12);
  return { daily, hourly, monthly };
}

// ───────────── Contributions ─────────────

export type SssResult = { mscCents: number; employeeCents: number; employerCents: number; ecCents: number; regularMscCents: number; mpfMscCents: number };
// Monthly salary credit: pay rounded to the nearest step (half a step rounds up), kept between the minimum and maximum credit.
export function sssContribution(monthlyPayCents: number, p: SssParams): SssResult {
  const stepped = Math.floor((monthlyPayCents + p.stepCents / 2) / p.stepCents) * p.stepCents;
  const msc = Math.min(p.maxMscCents, Math.max(p.minMscCents, stepped));
  const mpf = Math.max(0, msc - p.mpfFromCents);
  return {
    mscCents: msc,
    employeeCents: round((msc * p.employeeBp) / 10000),
    employerCents: round((msc * p.employerBp) / 10000),
    ecCents: msc >= p.ecThresholdCents ? p.ecHighCents : p.ecLowCents,
    regularMscCents: msc - mpf,
    mpfMscCents: mpf,
  };
}

export type PercentResult = { baseCents: number; employeeCents: number; employerCents: number; employeeBp: number; employerBp: number };
// PhilHealth/Pag-IBIG style contribution: a percentage of pay held between a floor and ceiling base, using the tier that covers that base.
export function percentContribution(monthlyPayCents: number, p: PercentParams): PercentResult {
  const base = Math.min(p.ceilingBaseCents ?? Number.MAX_SAFE_INTEGER, Math.max(p.floorBaseCents, monthlyPayCents));
  const t = p.tiers.find((x) => x.upToCents === null || base <= x.upToCents) ?? p.tiers[p.tiers.length - 1];
  return { baseCents: base, employeeBp: t.employeeBp, employerBp: t.employerBp, employeeCents: round((base * t.employeeBp) / 10000), employerCents: round((base * t.employerBp) / 10000) };
}

// How much of a monthly amount belongs to this pay period.
export function monthlyShare(monthlyCents: number, o: { schedule: "EVERY_PERIOD" | "LAST_PERIOD"; frequency: Frequency; periodsPerYear: number; lastOfMonth: boolean }): number {
  if (o.schedule === "LAST_PERIOD") return o.lastOfMonth ? monthlyCents : 0;
  if (o.frequency === "MONTHLY") return monthlyCents;
  if (o.frequency === "SEMI_MONTHLY") return o.lastOfMonth ? monthlyCents - Math.floor(monthlyCents / 2) : Math.floor(monthlyCents / 2);
  return round((monthlyCents * 12) / o.periodsPerYear);
}

// ───────────── Withholding tax ─────────────

// tax = fixed + rate × (pay − bracket start), using the highest bracket reached.
export function bracketTax(brackets: Bracket[], taxableCents: number): number {
  if (taxableCents <= 0) return 0;
  const hit = [...brackets].filter((b) => b.fromCents <= taxableCents).sort((a, b) => b.fromCents - a.fromCents)[0];
  return hit ? hit.fixedCents + round(((taxableCents - hit.fromCents) * hit.rateBp) / 10000) : 0;
}

// Pay frequency from how many periods fall in a month; a single-day period is DAILY.
export const frequencyOf = (periodsPerMonth: number, singleDay: boolean): Frequency => (singleDay ? "DAILY" : periodsPerMonth === 1 ? "MONTHLY" : periodsPerMonth === 2 ? "SEMI_MONTHLY" : "WEEKLY");
// Pay periods in a year for a frequency; DAILY uses the annual factor (paid days).
export const periodsPerYearOf = (f: Frequency, annualFactorDays: number) => (f === "MONTHLY" ? 12 : f === "SEMI_MONTHLY" ? 24 : f === "WEEKLY" ? 52 : annualFactorDays);
// Code of the withholding-tax table for a frequency, as stored in StatutoryRule.
export const tableCodeOf = (f: Frequency) => `WT_${f}`;

// ───────────── De minimis and the yearly benefits exemption ─────────────

export type DmUse = { code: string; payDate: string; exemptCents: number };
const inWindow = (per: DeMinimisParams["per"], a: string, b: string) => {
  const [ya, ma] = [a.slice(0, 4), Number(a.slice(5, 7))];
  const [yb, mb] = [b.slice(0, 4), Number(b.slice(5, 7))];
  if (ya !== yb) return false;
  return per === "YEAR" ? true : per === "MONTH" ? ma === mb : (ma <= 6) === (mb <= 6);
};

// Splits an amount into the part inside the ceiling for its window (month, semester or year) and the excess.
export function deMinimisSplit(o: { code: string; amountCents: number; rule: DeMinimisParams; payDate: string; used: DmUse[]; dailyRateCents: number }) {
  const ceiling = o.rule.unit === "DAYS" ? round(o.rule.ceilingCents * o.dailyRateCents) : o.rule.ceilingCents;
  const spent = o.used.filter((u) => u.code === o.code && inWindow(o.rule.per, u.payDate, o.payDate)).reduce((n, u) => n + u.exemptCents, 0);
  const exempt = Math.max(0, Math.min(o.amountCents, ceiling - spent));
  return { exemptCents: exempt, excessCents: o.amountCents - exempt, ceilingCents: ceiling, spentCents: spent };
}

// The yearly ceiling shared by 13th month pay and other benefits.
export function poolSplit(poolCents: number, ceilingCents: number, alreadyExemptCents: number) {
  const exempt = Math.max(0, Math.min(poolCents, ceilingCents - alreadyExemptCents));
  return { exemptCents: exempt, taxableCents: poolCents - exempt };
}

// ───────────── 13th month and year-end ─────────────

// PD 851: one twelfth of the basic salary actually earned in the calendar year.
export const thirteenthMonth = (basicEarnedYearCents: number) => round(basicEarnedYearCents / 12);

export type Ytd = { taxableCents: number; benefitsTaxableCents: number; taxWithheldCents: number };
// Annualization: tax on the whole year's taxable pay, less everything already withheld. Positive = withhold more, negative = refund.
export function yearEndAdjustment(annual: TableParams["brackets"], ytd: Ytd, current: { taxableCents: number; benefitsTaxableCents: number; taxWithheldCents: number }) {
  const annualTaxable = ytd.taxableCents + ytd.benefitsTaxableCents + current.taxableCents + current.benefitsTaxableCents;
  const annualTax = bracketTax(annual, annualTaxable);
  const withheld = ytd.taxWithheldCents + current.taxWithheldCents;
  return { annualTaxableCents: annualTaxable, annualTaxCents: annualTax, withheldCents: withheld, adjustmentCents: annualTax - withheld };
}

// Does this period contain the last day of its start month? (used to place monthly contributions)
export function holdsMonthEnd(startDay: string, endDay: string): boolean {
  const y = Number(startDay.slice(0, 4));
  const m = Number(startDay.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return startDay <= last && last <= endDay;
}
