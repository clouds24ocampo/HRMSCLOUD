// Starter set of Philippine statutory rules, copied into an organization when HR installs it. After that they are the organization's
// own dated rows: edit, end or replace them when the law changes. Figures come from the taxation, payroll and benefits guides in this
// project and were spot-checked against the BIR's Annex E (RR 11-2018), the SSS 2025 schedule and RR 29-2025.
// Anything not listed here (annual PEI/SRI authorizations, wage orders, holidays) is entered by the organization, because it changes every year.
import type { RuleKind } from "@/lib/ph/rules";

export const PACK_VERSION = "PH-2026.10";
export const PACK_AS_OF = "2026-10-04";

export type PackRow = {
  code: string; kind: RuleKind; agency: string; sector: "ALL" | "PRIVATE" | "GOVERNMENT"; name: string;
  params: unknown; effectiveFrom: string; effectiveTo?: string | null; legalBasis: string; note?: string;
};

const php = (pesos: number) => Math.round(pesos * 100);
const br = (rows: [number, number, number][]) => rows.map(([from, fixed, rateBp]) => ({ fromCents: php(from), fixedCents: php(fixed), rateBp }));
const WT = "BIR Revised Withholding Tax Table, Annex E of RR 11-2018 (effective January 1, 2023 onwards, TRAIN Law RA 10963)";

export const PACK: PackRow[] = [
  // ── Social insurance
  {
    code: "SSS", kind: "SSS", agency: "SSS", sector: "PRIVATE", name: "SSS contribution", effectiveFrom: "2025-01-01",
    params: { employeeBp: 500, employerBp: 1000, minMscCents: php(5000), maxMscCents: php(35000), stepCents: php(500), mpfFromCents: php(20000), ecThresholdCents: php(15000), ecLowCents: php(10), ecHighCents: php(30) },
    legalBasis: "RA 11199 (Social Security Act of 2018): 15% of the monthly salary credit (employee 5%, employer 10%), credit ₱5,000 to ₱35,000; EC ₱10 below ₱15,000 and ₱30 from ₱15,000, paid by the employer.",
    note: "Salary credit above ₱20,000 goes to the Mandatory Provident Fund (MPF). The total contribution is the same.",
  },
  {
    code: "GSIS", kind: "PERCENT_CONTRIBUTION", agency: "GSIS", sector: "GOVERNMENT", name: "GSIS contribution", effectiveFrom: "1997-06-11",
    params: { tiers: [{ upToCents: null, employeeBp: 900, employerBp: 1200 }], floorBaseCents: 0, ceilingBaseCents: null },
    legalBasis: "RA 8291: employee 9%, government agency 12% of the actual monthly salary.",
  },
  {
    code: "PHILHEALTH", kind: "PERCENT_CONTRIBUTION", agency: "PHILHEALTH", sector: "ALL", name: "PhilHealth premium", effectiveFrom: "2024-01-01",
    params: { tiers: [{ upToCents: null, employeeBp: 250, employerBp: 250 }], floorBaseCents: php(10000), ceilingBaseCents: php(100000) },
    legalBasis: "Universal Health Care Act (RA 11223) and the PhilHealth premium advisory: 5% of monthly basic salary, ₱10,000 floor, ₱100,000 ceiling, shared equally.",
    note: "Basic salary excludes overtime, allowances, 13th month pay and bonuses. Absences and undertime do not lower it.",
  },
  {
    code: "PAGIBIG", kind: "PERCENT_CONTRIBUTION", agency: "PAGIBIG", sector: "ALL", name: "Pag-IBIG savings", effectiveFrom: "2024-02-01",
    params: { tiers: [{ upToCents: php(1500), employeeBp: 100, employerBp: 200 }, { upToCents: null, employeeBp: 200, employerBp: 200 }], floorBaseCents: 0, ceilingBaseCents: php(10000) },
    legalBasis: "HDMF (Pag-IBIG) Circular No. 460: maximum fund salary ₱10,000. Employee 1% up to ₱1,500 of pay and 2% above; employer 2%.",
  },
  // ── Income tax
  { code: "WT_DAILY", kind: "WITHHOLDING_TABLE", agency: "BIR", sector: "ALL", name: "Withholding tax, daily pay", effectiveFrom: "2023-01-01", legalBasis: WT,
    params: { frequency: "DAILY", brackets: br([[0, 0, 0], [685, 0, 1500], [1096, 61.65, 2000], [2192, 280.85, 2500], [5479, 1102.6, 3000], [21918, 6034.3, 3500]]) } },
  { code: "WT_WEEKLY", kind: "WITHHOLDING_TABLE", agency: "BIR", sector: "ALL", name: "Withholding tax, weekly pay", effectiveFrom: "2023-01-01", legalBasis: WT,
    params: { frequency: "WEEKLY", brackets: br([[0, 0, 0], [4808, 0, 1500], [7692, 432.6, 2000], [15385, 1971.2, 2500], [38462, 7740.45, 3000], [153846, 42355.65, 3500]]) } },
  { code: "WT_SEMI_MONTHLY", kind: "WITHHOLDING_TABLE", agency: "BIR", sector: "ALL", name: "Withholding tax, semi-monthly pay", effectiveFrom: "2023-01-01", legalBasis: WT,
    params: { frequency: "SEMI_MONTHLY", brackets: br([[0, 0, 0], [10417, 0, 1500], [16667, 937.5, 2000], [33333, 4270.7, 2500], [83333, 16770.7, 3000], [333333, 91770.7, 3500]]) } },
  { code: "WT_MONTHLY", kind: "WITHHOLDING_TABLE", agency: "BIR", sector: "ALL", name: "Withholding tax, monthly pay", effectiveFrom: "2023-01-01", legalBasis: WT,
    params: { frequency: "MONTHLY", brackets: br([[0, 0, 0], [20833, 0, 1500], [33333, 1875, 2000], [66667, 8541.8, 2500], [166667, 33541.8, 3000], [666667, 183541.8, 3500]]) } },
  { code: "ANNUAL_TAX", kind: "ANNUAL_TAX_TABLE", agency: "BIR", sector: "ALL", name: "Annual income tax rates", effectiveFrom: "2023-01-01",
    legalBasis: "NIRC as amended by the TRAIN Law (RA 10963), graduated rates for 2023 onwards. Used by the year-end adjustment.",
    params: { frequency: "ANNUAL", brackets: br([[0, 0, 0], [250000, 0, 1500], [400000, 22500, 2000], [800000, 102500, 2500], [2000000, 402500, 3000], [8000000, 2202500, 3500]]) } },
  { code: "BENEFITS_POOL", kind: "BENEFITS_POOL", agency: "BIR", sector: "ALL", name: "13th month pay and other benefits exemption", effectiveFrom: "2018-01-01",
    params: { ceilingCents: php(90000) }, legalBasis: "TRAIN Law (RA 10963): 13th month pay and other benefits are exempt up to ₱90,000 a year; the excess is taxable." },
  // ── De minimis benefits (RR 29-2025, effective January 6, 2026)
  ...(
    [
      ["DM_RICE", "Rice subsidy", "MONTH", 2500, "ALL"], ["DM_LAUNDRY", "Laundry allowance", "MONTH", 400, "ALL"],
      ["DM_MEDICAL_DEPENDENTS", "Medical cash allowance to dependents", "SEMESTER", 2000, "ALL"], ["DM_UNIFORM", "Uniform and clothing allowance", "YEAR", 8000, "ALL"],
      ["DM_MEDICAL_ASSISTANCE", "Actual medical assistance", "YEAR", 12000, "ALL"], ["DM_GIFTS", "Christmas and major anniversary gifts", "YEAR", 6000, "ALL"],
      ["DM_ACHIEVEMENT", "Employee achievement award", "YEAR", 12000, "ALL"], ["DM_CBA_PRODUCTIVITY", "CBA and productivity incentive", "YEAR", 12000, "ALL"],
    ] as [string, string, "MONTH" | "SEMESTER" | "YEAR", number, "ALL"][]
  ).map<PackRow>(([code, label, per, pesos, sector]) => ({
    code, kind: "DE_MINIMIS", agency: "BIR", sector, name: label, effectiveFrom: "2026-01-06",
    params: { label, per, unit: "PESO", ceilingCents: php(pesos) },
    legalBasis: "BIR Revenue Regulations No. 29-2025 (effective January 6, 2026). Within the ceiling it is not taxable; the excess counts toward the ₱90,000 exemption.",
  })),
  {
    code: "DM_LEAVE_MONETIZED", kind: "DE_MINIMIS", agency: "BIR", sector: "PRIVATE", name: "Monetized unused vacation leave", effectiveFrom: "2026-01-06",
    params: { label: "Monetized unused vacation leave", per: "YEAR", unit: "DAYS", ceilingCents: 12 },
    legalBasis: "BIR Revenue Regulations No. 29-2025: up to 12 days of unused vacation leave a year for private employees (ceiling is in days of pay, not pesos).",
  },
  // ── Labor standards: premium pay
  {
    code: "PREMIUMS", kind: "PREMIUM_PAY", agency: "DOLE", sector: "ALL", name: "Holiday, rest day, overtime and night pay", effectiveFrom: "1974-11-01",
    params: {
      ordinaryBp: 10000, restDayBp: 13000, specialNonWorkingBp: 13000, specialNonWorkingRestDayBp: 15000, regularHolidayBp: 20000, regularHolidayRestDayBp: 26000,
      doubleHolidayBp: 30000, doubleHolidayRestDayBp: 39000, specialWorkingBp: 10000, overtimeOrdinaryBp: 12500, overtimeOnPremiumBp: 13000,
      nightDiffBp: 1000, nightStartMinute: 22 * 60, nightEndMinute: 6 * 60, payUnworkedSpecialNonWorking: false,
    },
    legalBasis: "Labor Code arts. 86 (night shift differential, 10%), 87 (overtime, +25% on an ordinary day, +30% on a rest day or holiday), 91 to 94 (rest day and holiday pay).",
    note: "Unworked special non-working days are not paid for daily and hourly staff (no work, no pay) unless company policy says so. Turn that on here if you pay them.",
  },
  // ── Government incentives (DBM). PEI, SRI and similar are authorized year by year: add them when authorized.
  {
    code: "GOV_MIDYEAR", kind: "INCENTIVE", agency: "DBM", sector: "GOVERNMENT", name: "Mid-year bonus", effectiveFrom: "2026-01-01",
    params: { label: "Mid-year bonus", months: 1, amountCents: 0, minServiceMonths: 4, asOf: "05-15" },
    legalBasis: "DBM rules: one month of basic salary for personnel with the required service on the cut-off date.", note: "Confirm the service requirement against the current DBM circular each year.",
  },
  {
    code: "GOV_YEAREND", kind: "INCENTIVE", agency: "DBM", sector: "GOVERNMENT", name: "Year-end bonus and cash gift", effectiveFrom: "2026-01-01",
    params: { label: "Year-end bonus and cash gift", months: 1, amountCents: php(5000), minServiceMonths: 4, asOf: "10-31" },
    legalBasis: "DBM 2026 General Provisions: one month of basic salary plus a ₱5,000 cash gift.", note: "Confirm the service requirement against the current DBM circular each year.",
  },
];

export const packFor = (scope: "PRIVATE" | "GOVERNMENT" | "BOTH") => PACK.filter((r) => scope === "BOTH" || r.sector === "ALL" || r.sector === scope);

// What this build does not compute. Shown to HR so nobody assumes it is covered.
export const NOT_COVERED = [
  "Daily meal allowance for overtime or night work (de minimis, a share of the minimum wage per day): enter it as a taxable pay item, or add it as a fixed exempt item if your practitioner confirms the limit.",
  "Annual government incentives such as PEI and SRI: add a rule for the year when it is authorized (code GOV_PEI or GOV_SRI).",
  "Regional wage orders and the holiday calendar: they change every year, so you enter them (Pay setup → Wage orders, Holidays).",
  "SSS, PhilHealth, Pag-IBIG and GSIS benefit claims (sickness, maternity, retirement, loans): these are paid by the agencies. Loan repayments are entered as pay deductions.",
  "Separation pay, terminal leave pay, retirement pay and final pay: use adjustments after your practitioner confirms the amounts.",
  "Special groups with their own rules (teachers, uniformed personnel, job-order and contract-of-service workers, GOCCs): set their coverage flags on the employee's tax profile.",
];
