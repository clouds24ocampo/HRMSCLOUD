// The Philippine payslip. Same shape as the manual calculator in payroll.ts; used when an organization runs the PHILIPPINES profile.
// Order follows the BIR model: gross pay, less exempt pay, less employee contributions = taxable pay -> withholding table -> net pay.
import type { Line, PayInput, PayResult } from "@/lib/payroll";
import type { Attendance } from "@/lib/payroll";
import {
  bracketTax, deMinimisSplit, monthlyShare, percentContribution, poolSplit, rates, round, sssContribution, thirteenthMonth, yearEndAdjustment,
  type DmUse,
} from "@/lib/ph/calc";
import { premiumPay, type PayDay } from "@/lib/ph/premium";
import type { Bracket, DeMinimisParams, Frequency, IncentiveParams, PercentParams, PoolParams, PremiumParams, Sector, SssParams } from "@/lib/ph/rules";

export type PhInput = {
  kind: "REGULAR" | "THIRTEENTH_MONTH" | "GOV_INCENTIVE";
  yearEnd: boolean;
  frequency: Frequency;
  periodsPerYear: number;
  lastOfMonth: boolean; // this period holds the month end
  contributionSchedule: "EVERY_PERIOD" | "LAST_PERIOD";
  payDate: string;
  sector: Sector;
  mwe: boolean;
  withholdingApplies: boolean;
  socialCovered: boolean;
  philhealthCovered: boolean;
  pagibigCovered: boolean;
  annualFactor: number | null; // days a year behind the daily rate; null = not set
  minWageDailyCents: number | null;
  rules: {
    sss: SssParams | null; gsis: PercentParams | null; philhealth: PercentParams | null; pagibig: PercentParams | null;
    table: Bracket[] | null; annual: Bracket[] | null; pool: PoolParams | null; premium: PremiumParams | null;
    deMinimis: Record<string, DeMinimisParams>; incentive: IncentiveParams | null;
  };
  serviceMonths: number; // for incentives
  ytd: { taxableCents: number; benefitsTaxableCents: number; benefitsExemptCents: number; taxWithheldCents: number; basicEarnedCents: number; deMinimis: DmUse[] };
  payDays: PayDay[];
};

export type TaxBreakdown = {
  taxableCents: number; taxWithheldCents: number; nonTaxableCents: number; mweExemptCents: number; mandatoryEeCents: number;
  benefitsExemptCents: number; benefitsTaxableCents: number; basicEarnedCents: number; deMinimisUsed: DmUse[];
};

const peso = (c: number) => (c / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (bp: number) => `${(bp / 100).toFixed(2).replace(/\.?0+$/, "")}%`;

// Absences on a holiday are not absences: the holiday is paid (monthly) or handled by holiday pay (daily, hourly).
export function holidayAdjustedAttendance(a: Attendance, rowsAbsentDays: string[], days: PayDay[]): Attendance {
  const covered = days.filter((d) => d.holiday && d.holiday !== "SPECIAL_WORKING" && rowsAbsentDays.includes(d.day)).length;
  return { ...a, absentDays: Math.max(0, a.absentDays - covered) };
}

export function computePh(input: PayInput): PayResult & { tax: TaxBreakdown } {
  const ph = input.ph!;
  const f = input.factors;
  const a = input.attendance;
  const warnings: string[] = [];
  const lines: Line[] = [];
  const earn = (code: string, label: string, amountCents: number, detail?: string) => lines.push({ kind: "EARNING", code, label, amountCents, detail });
  const ded = (code: string, label: string, amountCents: number, detail?: string) => lines.push({ kind: "DEDUCTION", code, label, amountCents, detail });
  const employer = (label: string, amountCents: number, detail?: string) => lines.push({ kind: "EMPLOYER", code: "EMPLOYER_CONTRIBUTION", label, amountCents, detail });

  const factor = ph.annualFactor ?? f.workDaysPerMonth * 12;
  if (ph.annualFactor === null) warnings.push("No yearly wage factor is set for this person, so the daily rate uses work days per month from Pay setup.");
  const { daily, hourly, monthly } = rates(input.payType, input.rateCents, factor, f.hoursPerDay);
  const dailyRounded = round(daily);
  if (ph.minWageDailyCents !== null && input.payType !== "HOURLY") {
    if (dailyRounded < ph.minWageDailyCents) warnings.push(`Daily rate ${peso(dailyRounded)} is below the minimum wage on file (${peso(ph.minWageDailyCents)}).`);
    else if (ph.mwe && dailyRounded > ph.minWageDailyCents) warnings.push(`Marked as a minimum wage earner, but the daily rate ${peso(dailyRounded)} is above the minimum wage on file (${peso(ph.minWageDailyCents)}).`);
  }
  if (ph.mwe && ph.minWageDailyCents === null) warnings.push("Marked as a minimum wage earner but no wage order is on file for this region, so it cannot be checked.");

  const t: TaxBreakdown = { taxableCents: 0, taxWithheldCents: 0, nonTaxableCents: 0, mweExemptCents: 0, mandatoryEeCents: 0, benefitsExemptCents: 0, benefitsTaxableCents: 0, basicEarnedCents: 0, deMinimisUsed: [] };
  let gross = 0;
  let taxableOther = 0; // taxable pay other than basic and premiums
  let taxableBasicAndPremium = 0;
  let poolAmount = 0;
  let attendanceDeductions = 0;
  let employeeContrib = 0;
  let employerContrib = 0;
  let preTaxDeductions = 0;
  let otherDeductions = 0;
  const special = ph.kind !== "REGULAR";
  let basic = 0;

  // ── Earnings
  if (ph.kind === "THIRTEENTH_MONTH") {
    const amt = thirteenthMonth(ph.ytd.basicEarnedCents);
    earn("THIRTEENTH_MONTH", "13th month pay", amt, `${peso(ph.ytd.basicEarnedCents)} basic pay earned this year ÷ 12`);
    gross += amt;
    poolAmount += amt;
    if (ph.ytd.basicEarnedCents === 0) warnings.push("No finalized regular payroll found for this year, so the 13th month is zero. Finalize the earlier payrolls first.");
  } else if (ph.kind === "GOV_INCENTIVE") {
    const r = ph.rules.incentive;
    if (!r) warnings.push("The incentive rule is not in force on the pay day.");
    else if (ph.sector !== "GOVERNMENT") warnings.push("Not a government employee: no incentive.");
    else if (ph.serviceMonths < r.minServiceMonths) warnings.push(`Not eligible: ${ph.serviceMonths} month(s) of service, ${r.minServiceMonths} needed by ${r.asOf}.`);
    else {
      const amt = round(monthly * r.months) + r.amountCents;
      earn("INCENTIVE", r.label, amt, `${r.months ? `${r.months} month(s) × ${peso(monthly)}` : ""}${r.months && r.amountCents ? " + " : ""}${r.amountCents ? peso(r.amountCents) : ""}`.trim());
      gross += amt;
      poolAmount += amt;
    }
  } else {
    // Basic pay.
    if (input.payType === "MONTHLY") {
      basic = round((input.rateCents * 12) / ph.periodsPerYear);
      earn("BASIC", "Basic pay", basic, `Monthly ${peso(input.rateCents)} × 12 ÷ ${ph.periodsPerYear} pay periods a year`);
    } else if (input.payType === "DAILY") {
      const days = a.presentDays + a.paidLeaveDays;
      basic = round(daily * days);
      earn("BASIC", "Basic pay", basic, `${days} paid day${days === 1 ? "" : "s"} (${a.presentDays} worked + ${a.paidLeaveDays} paid leave) × ${peso(dailyRounded)}`);
    } else {
      const worked = ph.payDays.reduce((n, d) => n + d.workedMinutes - d.otMinutes, 0);
      const minutes = Math.max(0, worked) + a.paidLeaveDays * f.hoursPerDay * 60;
      basic = round((hourly * minutes) / 60);
      earn("BASIC", "Basic pay", basic, `${(minutes / 60).toFixed(2)} paid hours × ${peso(round(hourly))}`);
    }
    gross += basic;

    // Premium pay on holidays, rest days, overtime and night hours.
    let premiumTotal = 0;
    const p = ph.rules.premium;
    if (p) {
      const r = premiumPay({ payType: input.payType, dailyCents: daily, hourlyCents: hourly, hoursPerDay: f.hoursPerDay, factor, days: ph.payDays, p, otFloorBp: f.otMultiplierBp });
      const add = (code: string, label: string, v: number, detail: string) => {
        if (v === 0) return;
        earn(code, label, v, detail);
        premiumTotal += v;
      };
      add("HOLIDAY_PAY", "Holiday premium", r.holidayCents, r.notes.holiday);
      add("REST_DAY_PAY", "Rest day pay", r.restDayCents, r.notes.restDay);
      add("OVERTIME", "Overtime", r.overtimeCents, r.notes.overtime);
      add("NIGHT_DIFF", "Night differential", r.nightCents, r.notes.night);
      add("HOLIDAY_UNWORKED", "Holiday pay (not worked)", r.unworkedHolidayCents, `${r.unworkedHolidayDays} day${r.unworkedHolidayDays === 1 ? "" : "s"} × ${peso(dailyRounded)}`);
      gross += premiumTotal;
      if (input.payType !== "MONTHLY") t.basicEarnedCents += r.unworkedHolidayCents; // paid regular holidays are part of a daily wage
    } else if (a.approvedOvertimeMinutes > 0) {
      warnings.push("No premium pay rule is in force, so overtime uses the plain overtime rate from Pay setup and holiday, rest day and night pay were not added.");
      const ot = round((hourly / 60) * a.approvedOvertimeMinutes * (f.otMultiplierBp / 10000));
      earn("OVERTIME", "Overtime", ot, `${a.approvedOvertimeMinutes} approved min`);
      premiumTotal += ot;
      gross += ot;
    }

    // Time-based deductions. Monthly staff are paid in full, so absences and lost minutes come off.
    const minutesOff = (code: string, label: string, minutes: number) => {
      if (minutes <= 0) return;
      const amt = round((hourly / 60) * minutes);
      attendanceDeductions += amt;
      ded(code, label, amt, `${minutes} min × ${peso(round(hourly / 60))} per min`);
    };
    if (input.payType === "MONTHLY") {
      if (a.absentDays > 0) {
        const amt = round(daily * a.absentDays);
        attendanceDeductions += amt;
        ded("ABSENCE", "Absences", amt, `${a.absentDays} day${a.absentDays === 1 ? "" : "s"} × ${peso(dailyRounded)}`);
      }
      if (a.unpaidLeaveDays > 0) {
        const amt = round(daily * a.unpaidLeaveDays);
        attendanceDeductions += amt;
        ded("UNPAID_LEAVE", "Unpaid leave", amt, `${a.unpaidLeaveDays} day${a.unpaidLeaveDays === 1 ? "" : "s"} × ${peso(dailyRounded)}`);
      }
    }
    if (input.payType !== "HOURLY") {
      minutesOff("LATE", "Late", a.lateMinutes);
      minutesOff("UNDERTIME", "Undertime", a.undertimeMinutes);
    }
    t.basicEarnedCents += basic - attendanceDeductions;
    if (ph.mwe) t.mweExemptCents += Math.max(0, basic - attendanceDeductions) + premiumTotal;
    else taxableBasicAndPremium = Math.max(0, basic - attendanceDeductions) + premiumTotal;
  }

  // ── Pay items and adjustments
  let extraBaseMonthly = 0;
  const used = [...ph.ytd.deMinimis];
  for (const c of input.components.filter((x) => x.kind === "EARNING" && !special)) {
    const amt = c.calc === "FIXED" ? c.value : round((basic * c.value) / 10000);
    earn("COMPONENT", c.name, amt, c.calc === "FIXED" ? "Fixed amount" : `${(c.value / 100).toFixed(2)}% of basic pay`);
    gross += amt;
    if (c.inContributionBase) extraBaseMonthly += round((amt * ph.periodsPerYear) / 12);
    const cls = c.taxClass ?? (c.taxable ? "TAXABLE" : "EXEMPT");
    if (cls === "EXEMPT") t.nonTaxableCents += amt;
    else if (cls === "OTHER_BENEFIT") poolAmount += amt;
    else if (cls === "DE_MINIMIS") {
      const rule = c.deMinimisCode ? ph.rules.deMinimis[c.deMinimisCode] : undefined;
      if (!rule) {
        warnings.push(`${c.name}: no de minimis rule${c.deMinimisCode ? ` “${c.deMinimisCode}”` : ""} in force on the pay day, so it was treated as taxable.`);
        taxableOther += amt;
      } else {
        const s = deMinimisSplit({ code: c.deMinimisCode!, amountCents: amt, rule, payDate: ph.payDate, used, dailyRateCents: dailyRounded });
        used.push({ code: c.deMinimisCode!, payDate: ph.payDate, exemptCents: s.exemptCents });
        t.deMinimisUsed.push({ code: c.deMinimisCode!, payDate: ph.payDate, exemptCents: s.exemptCents });
        t.nonTaxableCents += s.exemptCents;
        poolAmount += s.excessCents;
        if (s.excessCents > 0) warnings.push(`${c.name}: ${peso(s.excessCents)} is over the ${rule.label} ceiling and counts toward the yearly 13th month and other benefits exemption.`);
      }
    } else if (ph.mwe && c.mweExempt) t.mweExemptCents += amt;
    else taxableOther += amt;
  }
  for (const adj of input.adjustments.filter((x) => x.kind === "EARNING")) {
    earn("ADJUSTMENT", adj.label, adj.amountCents, "Adjustment");
    gross += adj.amountCents;
    taxableOther += adj.amountCents;
  }

  // ── Employee and employer contributions, worked out on the monthly pay and spread over the month's pay periods.
  // Nothing is taken from someone who earned nothing in the period (for example a daily-paid employee on leave without pay all week).
  if (!special && gross > 0) {
    const monthlyPay = monthly + extraBaseMonthly;
    const share = (m: number) => monthlyShare(m, { schedule: ph.contributionSchedule, frequency: ph.frequency, periodsPerYear: ph.periodsPerYear, lastOfMonth: ph.lastOfMonth });
    const note = ph.contributionSchedule === "LAST_PERIOD" ? (ph.lastOfMonth ? "whole month taken now" : "taken at month end") : ph.frequency === "MONTHLY" ? "monthly" : "this period's share";
    const need = (code: string) => warnings.push(`No ${code} rule is in force on the pay day, so that contribution was not computed. Install or update the rules on Pay setup.`);
    if (ph.socialCovered && ph.sector === "PRIVATE") {
      if (!ph.rules.sss) need("SSS");
      else {
        const r = sssContribution(monthlyPay, ph.rules.sss);
        const ee = share(r.employeeCents), er = share(r.employerCents), ec = share(r.ecCents);
        const d = `Salary credit ${peso(r.mscCents)} (pay ${peso(monthlyPay)}); monthly ${peso(r.employeeCents)}${r.mpfMscCents ? `, of which provident fund on ${peso(r.mpfMscCents)}` : ""}; ${note}`;
        if (ee > 0) ded("CONTRIBUTION", "SSS", ee, d);
        if (er > 0) employer("SSS (employer share)", er, d);
        if (ec > 0) employer("SSS EC (employer only)", ec, `Employees' compensation, salary credit ${peso(r.mscCents)}`);
        employeeContrib += ee;
        employerContrib += er + ec;
      }
    }
    const pct3 = (label: string, code: string, on: boolean, rule: PercentParams | null) => {
      if (!on) return;
      if (!rule) return need(code);
      const r = percentContribution(monthlyPay, rule);
      const ee = share(r.employeeCents), er = share(r.employerCents);
      const d = `${pct(r.employeeBp)} employee / ${pct(r.employerBp)} employer of ${peso(r.baseCents)}; monthly ${peso(r.employeeCents)}; ${note}`;
      if (ee > 0) ded("CONTRIBUTION", label, ee, d);
      if (er > 0) employer(`${label} (employer share)`, er, d);
      employeeContrib += ee;
      employerContrib += er;
    };
    pct3("GSIS", "GSIS", ph.socialCovered && ph.sector === "GOVERNMENT", ph.rules.gsis);
    pct3("PhilHealth", "PhilHealth", ph.philhealthCovered, ph.rules.philhealth);
    pct3("Pag-IBIG", "Pag-IBIG", ph.pagibigCovered, ph.rules.pagibig);
  }

  // ── Other deductions (loans, union dues). Pre-tax ones lower taxable pay.
  for (const c of input.components.filter((x) => x.kind === "DEDUCTION" && !special)) {
    const amt = c.calc === "FIXED" ? c.value : round((basic * c.value) / 10000);
    otherDeductions += amt;
    if (c.preTax) preTaxDeductions += amt;
    ded("COMPONENT", c.name, amt, `${c.calc === "FIXED" ? "Fixed amount" : `${(c.value / 100).toFixed(2)}% of basic pay`}${c.preTax ? " · before tax" : ""}`);
  }
  for (const adj of input.adjustments.filter((x) => x.kind === "DEDUCTION")) {
    otherDeductions += adj.amountCents;
    ded("ADJUSTMENT", adj.label, adj.amountCents, "Adjustment");
  }

  // ── The yearly exemption shared by 13th month pay and other benefits.
  if (poolAmount > 0) {
    if (!ph.rules.pool) {
      warnings.push("No yearly benefits exemption rule is in force, so 13th month and other benefits were treated as taxable.");
      t.benefitsTaxableCents = poolAmount;
    } else {
      const s = poolSplit(poolAmount, ph.rules.pool.ceilingCents, ph.ytd.benefitsExemptCents);
      t.benefitsExemptCents = s.exemptCents;
      t.benefitsTaxableCents = s.taxableCents;
    }
    t.nonTaxableCents += t.benefitsExemptCents;
  }

  // ── Withholding tax
  t.mandatoryEeCents = employeeContrib + preTaxDeductions;
  const base = Math.max(0, taxableBasicAndPremium + taxableOther - t.mandatoryEeCents);
  t.taxableCents = base;
  let tax = 0;
  if (!special && ph.withholdingApplies) {
    if (!ph.rules.table) warnings.push(`No ${ph.frequency.toLowerCase().replace("_", "-")} withholding table is in force on the pay day, so no tax was withheld. Install or update the rules on Pay setup.`);
    else {
      tax = bracketTax(ph.rules.table, base);
      if (tax > 0) ded("TAX", "Withholding tax", tax, `Taxable pay ${peso(base)} on the ${ph.frequency.toLowerCase().replace("_", "-")} table`);
    }
  }
  t.taxWithheldCents = tax;

  // ── Year-end adjustment (annualization)
  if (ph.yearEnd && ph.withholdingApplies) {
    if (!ph.rules.annual) warnings.push("No annual income tax table is in force, so the year-end adjustment was not computed.");
    else {
      const r = yearEndAdjustment(ph.rules.annual, ph.ytd, { taxableCents: base, benefitsTaxableCents: t.benefitsTaxableCents, taxWithheldCents: tax });
      if (r.adjustmentCents !== 0) ded("TAX_ADJUSTMENT", r.adjustmentCents > 0 ? "Year-end tax adjustment (more tax)" : "Year-end tax adjustment (refund)", r.adjustmentCents, `Tax on the year's ${peso(r.annualTaxableCents)} taxable pay is ${peso(r.annualTaxCents)}; already withheld ${peso(r.withheldCents)}`);
      t.taxWithheldCents += r.adjustmentCents;
    }
  } else if (t.benefitsTaxableCents > 0 && ph.withholdingApplies) {
    warnings.push(`${peso(t.benefitsTaxableCents)} is over the yearly exemption and is taxable. It is taxed only by the year-end adjustment: turn that on for the last payroll of the year.`);
  }

  const deductions = attendanceDeductions + employeeContrib + t.taxWithheldCents + otherDeductions;
  const net = gross - deductions;
  if (net < 0) warnings.push("Net pay is below zero. Check the deductions.");
  if (!special && a.incompleteDays > 0) warnings.push(input.payType === "MONTHLY" ? `${a.incompleteDays} day(s) have no clock-out. Monthly pay is not affected, but check the DTR.` : `${a.incompleteDays} day(s) have no clock-out and were not paid. Fix the DTR and recalculate.`);
  if (!special && a.scheduledDays === 0 && input.payType !== "MONTHLY") warnings.push("No scheduled days in this period, so nothing could be paid.");

  return { lines, grossCents: gross, deductionsCents: deductions, netCents: net, employerCostCents: gross + employerContrib, warnings, tax: t };
}
