// The one payroll calculator. Pure and deterministic: the same inputs always give the same payslip, to the centavo.
// Every line says how it was worked out, and the inputs are stored with the payslip, so any number can be explained later.
// All amounts are whole centavos. Rounding: each line is rounded half-up on its own, then lines are added.
import type { DtrDay } from "@/lib/dtr";
import { computePh, type PhInput, type TaxBreakdown } from "@/lib/ph/payroll-ph";

export type PayType = "MONTHLY" | "DAILY" | "HOURLY";
export type Factors = {
  workDaysPerMonth: number; hoursPerDay: number; otMultiplierBp: number; periodsPerMonth: number;
  daysPerYear?: number; // when set, a monthly salary's daily rate is monthly x 12 / daysPerYear (else / workDaysPerMonth)
  payByLoggedHours?: boolean; // monthly staff paid for logged hours (capped at hoursPerDay a day) instead of salary less absences
};
export type Component = {
  name: string; kind: "EARNING" | "DEDUCTION"; calc: "FIXED" | "PERCENT_OF_BASIC"; value: number; taxable: boolean;
  // Philippine profile only:
  taxClass?: "TAXABLE" | "EXEMPT" | "DE_MINIMIS" | "OTHER_BENEFIT"; deMinimisCode?: string | null; preTax?: boolean; inContributionBase?: boolean; mweExempt?: boolean;
};
export type Contribution = { name: string; employeeBp: number; employerBp: number; minBaseCents: number; maxBaseCents: number | null };
export type Bracket = { fromCents: number; rateBp: number; fixedCents: number };
export type Adjustment = { kind: "EARNING" | "DEDUCTION"; label: string; amountCents: number };

export type Attendance = {
  scheduledDays: number;
  presentDays: number; // complete days with a clock-in and a clock-out
  incompleteDays: number; // clocked in, never clocked out: not paid until HR fixes the record
  absentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lateMinutes: number;
  undertimeMinutes: number;
  workedMinutes: number;
  approvedOvertimeMinutes: number;
  regularMinutes?: number; // worked minutes counted for basic pay: each day capped at a normal day, overtime paid apart
};

// Minutes paid as basic pay. Older stored inputs have no regularMinutes: worked time less approved overtime.
export const regularMinutesOf = (a: Attendance) => a.regularMinutes ?? Math.max(0, a.workedMinutes - a.approvedOvertimeMinutes);

export type PayInput = {
  payType: PayType;
  rateCents: number;
  attendance: Attendance;
  factors: Factors;
  components: Component[];
  contributions: Contribution[];
  brackets: Bracket[];
  adjustments: Adjustment[];
  ph?: PhInput; // present when the organization runs the Philippine statutory profile
};

export type Line = { kind: "EARNING" | "DEDUCTION" | "EMPLOYER"; code: string; label: string; amountCents: number; detail?: string };
export type PayResult = { lines: Line[]; grossCents: number; deductionsCents: number; netCents: number; employerCostCents: number; warnings: string[]; tax?: TaxBreakdown };

const round = (n: number) => Math.round(n);
const peso = (c: number) => (c / 100).toFixed(2);
export const rate4 = (c: number) => (Math.floor(c * 100 + 1e-6) / 10000).toFixed(4);
export const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

// Turns the DTR rows of a period into the numbers payroll needs.
// Recovery of issue time. Time lost to an issue (weather, calamity, power, system…) is deducted on its day and owed;
// on a later day of the same period, minutes worked beyond the normal day that are not approved overtime pay it back at
// the regular rate, until nothing is owed. Pure; the one rule used by payroll, payslips, the profile and the Payroll tab.
type RecoveryRow = Pick<DtrDay, "day" | "status" | "workedMinutes" | "overtimeMinutes"> & { issueMinutes?: number };
export function recoveryCredit(rows: RecoveryRow[], approvedOvertime: Map<string, number>, dayCapMinutes: number): Map<string, number> {
  const out = new Map<string, number>();
  if (!Number.isFinite(dayCapMinutes)) return out;
  let owed = 0;
  for (const r of [...rows].sort((a, b) => (a.day < b.day ? -1 : 1))) {
    if (r.status !== "PRESENT") continue;
    const ot = Math.min(approvedOvertime.get(r.day) ?? 0, r.overtimeMinutes);
    const regular = Math.min(r.workedMinutes - ot, dayCapMinutes);
    const credit = Math.min(Math.max(0, r.workedMinutes - ot - dayCapMinutes), owed);
    if (credit > 0) {
      out.set(r.day, credit);
      owed -= credit;
    }
    owed += Math.min(r.issueMinutes ?? 0, Math.max(0, dayCapMinutes - regular)); // only the shortfall the issue caused
  }
  return out;
}

export function buildAttendance(
  rows: DtrDay[],
  paidLeave: Set<string>,
  unpaidLeave: Set<string>,
  approvedOvertime: Map<string, number>,
  dayCapMinutes = Number.POSITIVE_INFINITY, // a normal work day; logged time above it is paid only as approved overtime
): Attendance {
  const a: Attendance = { scheduledDays: 0, presentDays: 0, incompleteDays: 0, absentDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, lateMinutes: 0, undertimeMinutes: 0, workedMinutes: 0, approvedOvertimeMinutes: 0, regularMinutes: 0 };
  let regular = 0;
  const recovered = recoveryCredit(rows, approvedOvertime, dayCapMinutes);
  for (const r of rows) {
    const planned = !!r.shift || (!!r.flex && r.status !== "DAY_OFF");
    if (planned) a.scheduledDays += 1;
    if (r.status === "PRESENT") {
      a.presentDays += 1;
      a.lateMinutes += r.lateMinutes;
      a.undertimeMinutes += r.undertimeMinutes;
      a.workedMinutes += r.workedMinutes;
      // Approved overtime can never exceed what the DTR actually measured.
      const ot = Math.min(approvedOvertime.get(r.day) ?? 0, r.overtimeMinutes);
      a.approvedOvertimeMinutes += ot;
      regular += Math.min(r.workedMinutes - ot, dayCapMinutes) + (recovered.get(r.day) ?? 0);
    } else if (r.status === "INCOMPLETE") a.incompleteDays += 1;
    else if (r.status === "ABSENT") a.absentDays += 1;
    else if (r.status === "LEAVE" && planned) {
      if (paidLeave.has(r.day)) a.paidLeaveDays += 1;
      else if (unpaidLeave.has(r.day)) a.unpaidLeaveDays += 1;
    }
  }
  a.regularMinutes = regular;
  return a;
}

export function computePayslip(input: PayInput): PayResult {
  if (input.ph) return computePh(input);
  const { payType, rateCents, attendance: a, factors: f } = input;
  const warnings: string[] = [];
  const lines: Line[] = [];
  const earn = (code: string, label: string, amountCents: number, detail?: string) => lines.push({ kind: "EARNING", code, label, amountCents, detail });
  const ded = (code: string, label: string, amountCents: number, detail?: string) => lines.push({ kind: "DEDUCTION", code, label, amountCents, detail });

  // Rates derived from the one pay rate.
  const dailyRate = payType === "DAILY" ? rateCents : payType === "MONTHLY" ? (f.daysPerYear ? (rateCents * 12) / f.daysPerYear : rateCents / f.workDaysPerMonth) : rateCents * f.hoursPerDay;
  const byHours = payType === "MONTHLY" && !!f.payByLoggedHours;
  const hourlyRate = payType === "HOURLY" ? rateCents : dailyRate / f.hoursPerDay;
  const minuteRate = hourlyRate / 60;
  const otMult = f.otMultiplierBp / 10000;

  // Basic pay.
  let basic = 0;
  if (byHours) {
    // Paid for what was logged: regular minutes plus paid leave days at a full day each. One rounding, at the end.
    const minutes = regularMinutesOf(a) + a.paidLeaveDays * f.hoursPerDay * 60;
    basic = round((dailyRate * minutes) / (f.hoursPerDay * 60));
    earn("BASIC", "Basic pay (logged hours)", basic, `${hm(minutes)} × ${rate4(hourlyRate)} an hour (monthly ${peso(rateCents)} × 12 ÷ ${f.daysPerYear ?? f.workDaysPerMonth * 12} days = ${rate4(dailyRate)} a day ÷ ${f.hoursPerDay} h)${a.paidLeaveDays ? `, incl. ${a.paidLeaveDays} paid leave day${a.paidLeaveDays === 1 ? "" : "s"}` : ""}`);
  } else if (payType === "MONTHLY") {
    basic = round(rateCents / f.periodsPerMonth);
    earn("BASIC", "Basic pay", basic, `Monthly ${peso(rateCents)} ÷ ${f.periodsPerMonth} pay period${f.periodsPerMonth === 1 ? "" : "s"} a month`);
  } else if (payType === "DAILY") {
    const days = a.presentDays + a.paidLeaveDays;
    basic = round(dailyRate * days);
    earn("BASIC", "Basic pay", basic, `${days} paid day${days === 1 ? "" : "s"} (${a.presentDays} worked + ${a.paidLeaveDays} paid leave) × ${peso(dailyRate)}`);
  } else {
    const regularWorked = Math.max(0, a.workedMinutes - a.approvedOvertimeMinutes);
    const minutes = regularWorked + a.paidLeaveDays * f.hoursPerDay * 60;
    basic = round((hourlyRate * minutes) / 60);
    earn("BASIC", "Basic pay", basic, `${(minutes / 60).toFixed(2)} paid hours × ${peso(hourlyRate)}`);
  }

  // Overtime: approved minutes only.
  let overtime = 0;
  if (a.approvedOvertimeMinutes > 0) {
    overtime = round(minuteRate * a.approvedOvertimeMinutes * otMult);
    earn("OVERTIME", "Overtime", overtime, `${a.approvedOvertimeMinutes} approved min × ${peso(minuteRate)} per min × ${otMult.toFixed(2)}`);
  }

  // Taxable income starts as gross and loses anything that is not taxable.
  let nonTaxable = 0;
  let earningsExtra = 0;
  const earningComponents = input.components.filter((c) => c.kind === "EARNING");
  for (const c of earningComponents) {
    const amt = c.calc === "FIXED" ? c.value : round((basic * c.value) / 10000);
    earningsExtra += amt;
    if (!c.taxable) nonTaxable += amt;
    earn("COMPONENT", c.name, amt, c.calc === "FIXED" ? "Fixed amount" : `${(c.value / 100).toFixed(2)}% of basic pay`);
  }
  for (const adj of input.adjustments.filter((x) => x.kind === "EARNING")) {
    earningsExtra += adj.amountCents;
    earn("ADJUSTMENT", adj.label, adj.amountCents, "Adjustment");
  }
  const gross = basic + overtime + earningsExtra;

  // Time-based deductions. Monthly staff are paid in full, so absences and lost minutes come off; daily and hourly staff are simply not paid for them.
  let attendanceDeductions = 0;
  const minutesOff = (code: string, label: string, minutes: number) => {
    if (minutes <= 0) return;
    const amt = round(minuteRate * minutes);
    attendanceDeductions += amt;
    ded(code, label, amt, `${minutes} min × ${peso(minuteRate)} per min`);
  };
  if (payType === "MONTHLY" && !byHours) {
    if (a.absentDays > 0) {
      const amt = round(dailyRate * a.absentDays);
      attendanceDeductions += amt;
      ded("ABSENCE", "Absences", amt, `${a.absentDays} day${a.absentDays === 1 ? "" : "s"} × ${peso(dailyRate)}`);
    }
    if (a.unpaidLeaveDays > 0) {
      const amt = round(dailyRate * a.unpaidLeaveDays);
      attendanceDeductions += amt;
      ded("UNPAID_LEAVE", "Unpaid leave", amt, `${a.unpaidLeaveDays} day${a.unpaidLeaveDays === 1 ? "" : "s"} × ${peso(dailyRate)}`);
    }
  }
  if (payType !== "HOURLY" && !byHours) {
    minutesOff("LATE", "Late", a.lateMinutes);
    minutesOff("UNDERTIME", "Undertime", a.undertimeMinutes);
  }

  // Contributions are a share of basic pay, kept between the rule's lower and upper limit.
  let employeeContrib = 0;
  let employerContrib = 0;
  for (const c of input.contributions) {
    const base = Math.min(Math.max(basic, c.minBaseCents), c.maxBaseCents ?? Number.MAX_SAFE_INTEGER);
    const emp = round((base * c.employeeBp) / 10000);
    const er = round((base * c.employerBp) / 10000);
    employeeContrib += emp;
    employerContrib += er;
    if (emp > 0) ded("CONTRIBUTION", c.name, emp, `${(c.employeeBp / 100).toFixed(2)}% of ${peso(base)}`);
    if (er > 0) lines.push({ kind: "EMPLOYER", code: "EMPLOYER_CONTRIBUTION", label: `${c.name} (employer share)`, amountCents: er, detail: `${(c.employerBp / 100).toFixed(2)}% of ${peso(base)}` });
  }

  // Withholding tax from the brackets entered for this pay period.
  const taxable = gross - nonTaxable - attendanceDeductions - employeeContrib;
  let tax = 0;
  if (taxable > 0 && input.brackets.length) {
    const hit = [...input.brackets].filter((b) => b.fromCents <= taxable).sort((x, y) => y.fromCents - x.fromCents)[0];
    if (hit) {
      tax = hit.fixedCents + round(((taxable - hit.fromCents) * hit.rateBp) / 10000);
      if (tax > 0) ded("TAX", "Withholding tax", tax, `${peso(hit.fixedCents)} + ${(hit.rateBp / 100).toFixed(2)}% of the amount over ${peso(hit.fromCents)} (taxable ${peso(taxable)})`);
    }
  }

  let otherDeductions = 0;
  for (const c of input.components.filter((x) => x.kind === "DEDUCTION")) {
    const amt = c.calc === "FIXED" ? c.value : round((basic * c.value) / 10000);
    otherDeductions += amt;
    ded("COMPONENT", c.name, amt, c.calc === "FIXED" ? "Fixed amount" : `${(c.value / 100).toFixed(2)}% of basic pay`);
  }
  for (const adj of input.adjustments.filter((x) => x.kind === "DEDUCTION")) {
    otherDeductions += adj.amountCents;
    ded("ADJUSTMENT", adj.label, adj.amountCents, "Adjustment");
  }

  const deductions = attendanceDeductions + employeeContrib + tax + otherDeductions;
  const net = gross - deductions;
  if (net < 0) warnings.push("Net pay is below zero. Check the deductions.");
  if (a.incompleteDays > 0 && payType !== "MONTHLY") warnings.push(`${a.incompleteDays} day(s) have no clock-out and were not paid. Fix the DTR and recalculate.`);
  if (a.incompleteDays > 0 && byHours) warnings.push(`${a.incompleteDays} day(s) have no clock-out and were not paid. Fix the DTR and recalculate.`);
  else if (a.incompleteDays > 0 && payType === "MONTHLY") warnings.push(`${a.incompleteDays} day(s) have no clock-out. Monthly pay is not affected, but check the DTR.`);
  if (a.scheduledDays === 0 && payType !== "MONTHLY") warnings.push("No scheduled days in this period, so nothing could be paid.");

  return { lines, grossCents: gross, deductionsCents: deductions, netCents: net, employerCostCents: gross + employerContrib, warnings };
}
