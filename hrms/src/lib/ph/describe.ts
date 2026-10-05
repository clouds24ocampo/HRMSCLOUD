// One-line plain-language summaries of a rule's parameters, for the rules page.
import { parseParams, type DeMinimisParams, type IncentiveParams, type PercentParams, type PoolParams, type PremiumParams, type RuleKind, type SssParams, type TableParams } from "@/lib/ph/rules";

const peso = (c: number) => `₱${(c / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const pct = (bp: number) => `${(bp / 100).toFixed(2).replace(/\.?0+$/, "")}%`;

export function describeRule(kind: RuleKind, raw: unknown): string {
  const r = parseParams(kind, raw);
  if (!r.ok) return `Invalid: ${r.error}`;
  switch (kind) {
    case "SSS": {
      const x = r.params as SssParams;
      return `Employee ${pct(x.employeeBp)}, employer ${pct(x.employerBp)} of the salary credit (${peso(x.minMscCents)} to ${peso(x.maxMscCents)}, steps of ${peso(x.stepCents)}). EC ${peso(x.ecLowCents)} below ${peso(x.ecThresholdCents)}, ${peso(x.ecHighCents)} from there.`;
    }
    case "PERCENT_CONTRIBUTION": {
      const x = r.params as PercentParams;
      const tiers = x.tiers.map((t) => `${t.upToCents === null ? "above" : `up to ${peso(t.upToCents)}:`} employee ${pct(t.employeeBp)}, employer ${pct(t.employerBp)}`).join("; ");
      return `${tiers}. Pay counted from ${peso(x.floorBaseCents)}${x.ceilingBaseCents === null ? ", no upper limit" : ` to ${peso(x.ceilingBaseCents)}`}.`;
    }
    case "WITHHOLDING_TABLE":
    case "ANNUAL_TAX_TABLE": {
      const x = r.params as TableParams;
      return `${x.frequency.toLowerCase().replace("_", "-")} table, ${x.brackets.length} brackets from ${peso(x.brackets[1]?.fromCents ?? 0)} up to ${pct(x.brackets[x.brackets.length - 1].rateBp)}.`;
    }
    case "DE_MINIMIS": {
      const x = r.params as DeMinimisParams;
      return `Exempt up to ${x.unit === "DAYS" ? `${x.ceilingCents} days of pay` : peso(x.ceilingCents)} ${x.per === "MONTH" ? "a month" : x.per === "SEMESTER" ? "a semester" : "a year"}.`;
    }
    case "BENEFITS_POOL":
      return `${peso((r.params as PoolParams).ceilingCents)} a year is exempt.`;
    case "PREMIUM_PAY": {
      const x = r.params as PremiumParams;
      return `Rest day ${pct(x.restDayBp)}, special day ${pct(x.specialNonWorkingBp)}, regular holiday ${pct(x.regularHolidayBp)}, overtime ${pct(x.overtimeOrdinaryBp)} (${pct(x.overtimeOnPremiumBp)} on rest days and holidays), night ${pct(x.nightDiffBp)}. Unworked special days ${x.payUnworkedSpecialNonWorking ? "are paid" : "are not paid"}.`;
    }
    case "INCENTIVE": {
      const x = r.params as IncentiveParams;
      return `${[x.months ? `${x.months} month(s) of basic pay` : "", x.amountCents ? peso(x.amountCents) : ""].filter(Boolean).join(" + ")}; ${x.minServiceMonths} month(s) of service by ${x.asOf}.`;
    }
  }
}
