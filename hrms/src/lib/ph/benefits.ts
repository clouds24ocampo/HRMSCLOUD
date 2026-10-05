// Estimates of agency benefits, so HR can plan advances and employer differentials. The agency decides the actual amount.
// Formulas follow the benefits guide in this project (SSS sickness and maternity, GSIS retirement, Civil Service terminal leave).
import { round } from "@/lib/ph/calc";

// Average daily salary credit: the six highest monthly salary credits in the 12 months before the semester, divided by 180.
export function adsc(mscCents: number[]): { adscCents: number; used: number[] } {
  const used = [...mscCents].sort((a, b) => b - a).slice(0, 6);
  return { adscCents: used.length === 0 ? 0 : round(used.reduce((n, x) => n + x, 0) / 180), used };
}

export const SICKNESS_MAX_DAYS_PER_YEAR = 120;
// Sickness: 90% of the daily salary credit for each compensable day, up to 120 days a calendar year.
export function sssSickness(mscCents: number[], days: number) {
  const { adscCents } = adsc(mscCents);
  const daily = round(adscCents * 0.9);
  const paid = Math.min(Math.max(0, Math.floor(days)), SICKNESS_MAX_DAYS_PER_YEAR);
  return { adscCents, dailyCents: daily, paidDays: paid, totalCents: daily * paid, cappedDays: days > SICKNESS_MAX_DAYS_PER_YEAR };
}

export const MATERNITY_DAYS = { LIVE_BIRTH: 105, SOLO_PARENT: 120, MISCARRIAGE: 60 } as const;
// Maternity: 100% of the daily salary credit. A private employer pays the difference to full pay.
export function sssMaternity(mscCents: number[], kind: keyof typeof MATERNITY_DAYS, dailySalaryCents: number) {
  const { adscCents } = adsc(mscCents);
  const days = MATERNITY_DAYS[kind];
  return { adscCents, days, sssCents: adscCents * days, employerDifferentialCents: Math.max(0, round(dailySalaryCents) - adscCents) * days, fullPayCents: round(dailySalaryCents) * days };
}

// GSIS old-age pension (RA 8291), 15 or more years of service.
export function gsisRetirement(avgMonthlyCompCents: number, yearsOfService: number) {
  if (yearsOfService < 15) return { eligible: false as const };
  const ramc = 70000 + avgMonthlyCompCents; // ₱700 + average monthly compensation
  const bmp = Math.min(round(avgMonthlyCompCents * 0.9), Math.max(round(ramc * 0.375), round(ramc * 0.025 * yearsOfService)));
  return { eligible: true as const, ramcCents: ramc, bmpCents: bmp, option1LumpSumCents: bmp * 60, option2CashCents: bmp * 18 };
}

export const TERMINAL_LEAVE_FACTOR = 0.0481927; // 1 / 20.75: a leave day expressed as a share of one month's salary
export const terminalLeave = (leaveDays: number, monthlySalaryCents: number) => round(leaveDays * monthlySalaryCents * TERMINAL_LEAVE_FACTOR);
