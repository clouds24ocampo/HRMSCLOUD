// Statutory rules as data. Nothing here is a rate: the rates live in StatutoryRule rows (see pack.ts for the starter set),
// each with a start date, so a change in law is a new row and old payrolls stay explainable.
import { z } from "zod";

export type Sector = "PRIVATE" | "GOVERNMENT";
export type Frequency = "DAILY" | "WEEKLY" | "SEMI_MONTHLY" | "MONTHLY";

const cents = z.number().int().min(0);
const bp = z.number().int().min(0).max(1_000_000);

export const bracketSchema = z.object({ fromCents: cents, fixedCents: cents, rateBp: bp });
export type Bracket = z.infer<typeof bracketSchema>;

const bracketsSchema = z
  .array(bracketSchema)
  .min(1, "Add at least one bracket.")
  .refine((b) => b.every((x, i) => i === 0 || x.fromCents > b[i - 1].fromCents), "Brackets must start higher each time.")
  .refine((b) => b[0].fromCents === 0, "The first bracket starts at 0.");

export const sssSchema = z.object({
  employeeBp: bp, // share of the monthly salary credit paid by the employee
  employerBp: bp,
  minMscCents: cents,
  maxMscCents: cents,
  stepCents: z.number().int().min(1),
  mpfFromCents: cents, // salary credit above this goes to the provident fund (MPF); the total does not change
  ecThresholdCents: cents, // employees' compensation, paid by the employer only
  ecLowCents: cents,
  ecHighCents: cents,
});
export type SssParams = z.infer<typeof sssSchema>;

const tier = z.object({ upToCents: cents.nullable(), employeeBp: bp, employerBp: bp });
export const percentSchema = z.object({
  tiers: z.array(tier).min(1).refine((t) => t.every((x, i) => (i === t.length - 1 ? x.upToCents === null : x.upToCents !== null && (i === 0 || x.upToCents! > t[i - 1].upToCents!))), "Tiers go up in order and the last one has no limit."),
  floorBaseCents: cents, // pay below this is treated as this
  ceilingBaseCents: cents.nullable(), // pay above this is treated as this
});
export type PercentParams = z.infer<typeof percentSchema>;

export const tableSchema = z.object({ frequency: z.enum(["DAILY", "WEEKLY", "SEMI_MONTHLY", "MONTHLY", "ANNUAL"]), brackets: bracketsSchema });
export type TableParams = z.infer<typeof tableSchema>;

export const deMinimisSchema = z.object({
  label: z.string().min(2),
  per: z.enum(["MONTH", "SEMESTER", "YEAR"]),
  unit: z.enum(["PESO", "DAYS"]).default("PESO"), // DAYS: ceilingCents is a number of days of pay, not centavos
  ceilingCents: z.number().int().min(0),
});
export type DeMinimisParams = z.infer<typeof deMinimisSchema>;

export const poolSchema = z.object({ ceilingCents: cents });
export type PoolParams = z.infer<typeof poolSchema>;

export const premiumSchema = z.object({
  // Multipliers are basis points of the hourly rate for the first normal hours on that kind of day (10000 = 100%).
  ordinaryBp: bp,
  restDayBp: bp,
  specialNonWorkingBp: bp,
  specialNonWorkingRestDayBp: bp,
  regularHolidayBp: bp,
  regularHolidayRestDayBp: bp,
  doubleHolidayBp: bp,
  doubleHolidayRestDayBp: bp,
  specialWorkingBp: bp,
  overtimeOrdinaryBp: bp, // overtime on an ordinary day: share of hourly rate
  overtimeOnPremiumBp: bp, // overtime on a rest day or holiday: this share of that day's hourly rate
  nightDiffBp: bp, // extra share of the applicable hourly rate for night hours
  nightStartMinute: z.number().int().min(0).max(1439),
  nightEndMinute: z.number().int().min(0).max(1439),
  // Company policy (labor law leaves these to the employer or the contract): is an unworked special non-working day paid?
  payUnworkedSpecialNonWorking: z.boolean(),
});
export type PremiumParams = z.infer<typeof premiumSchema>;

export const incentiveSchema = z.object({
  label: z.string().min(2),
  months: z.number().min(0).max(24).default(0), // months of basic salary
  amountCents: cents.default(0), // plus this fixed amount (a cash gift, for example)
  minServiceMonths: z.number().int().min(0).max(60),
  asOf: z.string().regex(/^\d{2}-\d{2}$/, "Use MM-DD, for example 05-15."), // service is counted up to this day of the pay year
});
export type IncentiveParams = z.infer<typeof incentiveSchema>;

export type RuleKind = "SSS" | "PERCENT_CONTRIBUTION" | "WITHHOLDING_TABLE" | "ANNUAL_TAX_TABLE" | "DE_MINIMIS" | "BENEFITS_POOL" | "PREMIUM_PAY" | "INCENTIVE";

const SCHEMAS = {
  SSS: sssSchema, PERCENT_CONTRIBUTION: percentSchema, WITHHOLDING_TABLE: tableSchema, ANNUAL_TAX_TABLE: tableSchema,
  DE_MINIMIS: deMinimisSchema, BENEFITS_POOL: poolSchema, PREMIUM_PAY: premiumSchema, INCENTIVE: incentiveSchema,
} as const;

export type ParamsOf = {
  SSS: SssParams; PERCENT_CONTRIBUTION: PercentParams; WITHHOLDING_TABLE: TableParams; ANNUAL_TAX_TABLE: TableParams;
  DE_MINIMIS: DeMinimisParams; BENEFITS_POOL: PoolParams; PREMIUM_PAY: PremiumParams; INCENTIVE: IncentiveParams;
};

export function parseParams<K extends RuleKind>(kind: K, value: unknown): { ok: true; params: ParamsOf[K] } | { ok: false; error: string } {
  const r = SCHEMAS[kind].safeParse(value);
  if (r.success) return { ok: true, params: r.data as ParamsOf[K] };
  const i = r.error.issues[0];
  return { ok: false, error: `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}` };
}

export type RuleRow = { id: string; code: string; kind: RuleKind; sector: "ALL" | Sector; effectiveFrom: string; effectiveTo: string | null; params: unknown; name?: string; legalBasis?: string };

// The rule in force on a day: latest start on or before it, not yet ended. A sector-specific rule beats an ALL rule on the same start date.
export function pickRule(rules: RuleRow[], code: string, day: string, sector?: Sector): RuleRow | null {
  const hits = rules
    .filter((r) => r.code === code && r.effectiveFrom <= day && (!r.effectiveTo || r.effectiveTo >= day) && (r.sector === "ALL" || !sector || r.sector === sector))
    .sort((a, b) => (a.effectiveFrom === b.effectiveFrom ? Number(b.sector !== "ALL") - Number(a.sector !== "ALL") : a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  return hits[0] ?? null;
}

// Same code, same sector, overlapping dates: ambiguous. Returns the clashing row, if any.
export function findOverlap(rules: RuleRow[], candidate: { code: string; sector: "ALL" | Sector; effectiveFrom: string; effectiveTo: string | null }, ignoreId?: string): RuleRow | null {
  const endA = candidate.effectiveTo ?? "9999-12-31";
  return (
    rules.find((r) => r.id !== ignoreId && r.code === candidate.code && r.sector === candidate.sector && r.effectiveFrom <= endA && (r.effectiveTo ?? "9999-12-31") >= candidate.effectiveFrom) ?? null
  );
}
