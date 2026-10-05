// The one payroll calculator. Pure and deterministic: the same inputs always give the same payslip, to the centavo.
// Every line says how it was worked out, and the inputs are stored with the payslip, so any number can be explained later.
// All amounts are whole centavos. Rounding: each line is rounded half-up on its own, then lines are added.
import type { DtrDay } from "@/lib/dtr";
import { computePh, type PhInput, type TaxBreakdown } from "@/lib/ph/payroll-ph";

export type PayType = "MONTHLY" | "DAILY" | "HOURLY";
export type Factors = { workDaysPerMonth: number; hoursPerDay: number; otMultiplierBp: number; periodsPerMonth: number };
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
};

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

// Turns the DTR rows of a period into the numbers payroll needs.
export function buildAttendance(
  rows: DtrDay[],
  paidLeave: Set<string>,
  unpaidLeave: Set<string>,
  approvedOvertime: Map<string, number>,
): Attendance {
  const a: Attendance = { scheduledDays: 0, presentDays: 0, incompleteDays: 0, absentDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, lateMinutes: 0, undertimeMinutes: 0, workedMinutes: 0, approvedOvertimeMinutes: 0 };
  for (const r of rows) {
    if (r.shift) a.scheduledDays += 1;
    if (r.status === "PRESENT") {
      a.presentDays += 1;
      a.lateMinutes += r.lateMinutes;
      a.undertimeMinutes += r.undertimeMinutes;
      a.workedMinutes += r.workedMinutes;
      // Approved overtime can never exceed what the DTR actually measured.
      a.approvedOvertimeMinutes += Math.min(approvedOvertime.get(r.day) ?? 0, r.overtimeMinutes);
    } else if (r.status === "INCOMPLETE") a.incompleteDays += 1;
    else if (r.status === "ABSENT") a.absentDays += 1;
    else if (r.status === "LEAVE" && r.shift) {
      if (paidLeave.has(r.day)) a.paidLeaveDays += 1;
      else if (unpaidLeave.has(r.day)) a.unpaidLeaveDays += 1;
    }
  }
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
  const dailyRate = payType === "DAILY" ? rateCents : payType === "MONTHLY" ? rateCents / f.workDaysPerMonth : rateCents * f.hoursPerDay;
  const hourlyRate = payType === "HOURLY" ? rateCents : dailyRate / f.hoursPerDay;
  const minuteRate = hourlyRate / 60;
  const otMult = f.otMultiplierBp / 10000;

  // Basic pay.
  let basic = 0;
  if (payType === "MONTHLY") {
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
  if (payType === "MONTHLY") {
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
  if (payType !== "HOURLY") {
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
  if (a.incompleteDays > 0 && payType === "MONTHLY") warnings.push(`${a.incompleteDays} day(s) have no clock-out. Monthly pay is not affected, but check the DTR.`);
  if (a.scheduledDays === 0 && payType !== "MONTHLY") warnings.push("No scheduled days in this period, so nothing could be paid.");

  return { lines, grossCents: gross, deductionsCents: deductions, netCents: net, employerCostCents: gross + employerContrib, warnings };
}
