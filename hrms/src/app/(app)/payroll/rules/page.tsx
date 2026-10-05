import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { describeRule } from "@/lib/ph/describe";
import { NOT_COVERED, PACK_AS_OF, PACK_VERSION } from "@/lib/ph/pack";
import { pickRule, type RuleKind, type RuleRow } from "@/lib/ph/rules";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, formatDay, keyOfDbDate } from "@/lib/time";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AddRuleVersionForm, EndRuleForm, InstallButtons, RemoveRuleButton, RemoveWageOrderButton, WageOrderForm } from "./RulesForms";

const fmt = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric", year: "numeric" });

// What a Philippine payroll needs to find in force on the pay day.
const NEEDED: { code: string; label: string; sector?: "PRIVATE" | "GOVERNMENT" }[] = [
  { code: "SSS", label: "SSS contribution (private)", sector: "PRIVATE" }, { code: "GSIS", label: "GSIS contribution (government)", sector: "GOVERNMENT" },
  { code: "PHILHEALTH", label: "PhilHealth premium" }, { code: "PAGIBIG", label: "Pag-IBIG savings" },
  { code: "WT_MONTHLY", label: "Withholding table, monthly" }, { code: "WT_SEMI_MONTHLY", label: "Withholding table, semi-monthly" }, { code: "WT_WEEKLY", label: "Withholding table, weekly" }, { code: "WT_DAILY", label: "Withholding table, daily" },
  { code: "ANNUAL_TAX", label: "Annual income tax rates (year-end adjustment)" }, { code: "BENEFITS_POOL", label: "₱90,000 exemption for 13th month and other benefits" }, { code: "PREMIUMS", label: "Holiday, rest day, overtime and night pay" },
];

export default async function RulesPage() {
  const me = await requireUser("/payroll");
  const settings = await getOrgSettings(me.organizationId);
  const [rules, wageOrders, holidayCount, profiles] = await Promise.all([
    prisma.statutoryRule.findMany({ where: { organizationId: me.organizationId }, orderBy: [{ code: "asc" }, { effectiveFrom: "desc" }] }),
    prisma.wageOrder.findMany({ where: { organizationId: me.organizationId }, orderBy: [{ region: "asc" }, { effectiveFrom: "desc" }] }),
    prisma.holiday.count({ where: { organizationId: me.organizationId } }),
    prisma.employeeTaxProfile.count({ where: { organizationId: me.organizationId } }),
  ]);
  const today = dayKey(new Date(), settings.timezone);
  const rows: RuleRow[] = rules.map((r) => ({ id: r.id, code: r.code, kind: r.kind, sector: r.sector, effectiveFrom: keyOfDbDate(r.effectiveFrom), effectiveTo: r.effectiveTo ? keyOfDbDate(r.effectiveTo) : null, params: r.params }));
  const byCode = new Map<string, typeof rules>();
  for (const r of rules) byCode.set(r.code, [...(byCode.get(r.code) ?? []), r]);
  const existing = [...byCode.values()].map((v) => ({ code: v[0].code, kind: v[0].kind, sector: v[0].sector, name: v[0].name, agency: v[0].agency, legalBasis: "", params: JSON.stringify(v[0].params, null, 2) }));
  const inForce = (code: string, sector?: "PRIVATE" | "GOVERNMENT") => !!pickRule(rows, code, today, sector);
  const missing = NEEDED.filter((n) => !inForce(n.code, n.sector));
  const isPh = settings.statutoryProfile === "PHILIPPINES";
  const pack = [...new Set(rules.map((r) => r.packVersion).filter(Boolean))];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/payroll/setup" className="text-sm font-medium text-muted hover:text-ink">← Pay setup</Link>
      <PageHeader title="Philippine rules" subtitle="Contribution rates, tax tables, limits and premium pay as dated rules. A change in law is a new version, so old payrolls stay explainable." />
      <div role="note" className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        The starter set (version {PACK_VERSION}, checked {PACK_AS_OF}) comes from the project&apos;s taxation, payroll and benefits guides and was spot-checked against BIR Annex E, the SSS 2025 schedule and RR 29-2025.
        Rates and rules change by circular. Have a payroll practitioner confirm them before the first real payroll, and run a trial payroll next to your current computation.
      </div>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Coverage today <Badge tone={missing.length === 0 ? "success" : "warning"}>{missing.length === 0 ? "complete" : `${missing.length} missing`}</Badge></h2>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {NEEDED.map((n) => {
            const ok = inForce(n.code, n.sector);
            return <li key={n.code} className={ok ? "text-muted" : "font-medium text-warning"}>{ok ? "✓" : "✗"} {n.label}</li>;
          })}
        </ul>
        <p className="text-sm text-muted">
          Payroll uses {isPh ? "these rules" : "rates entered by hand. Switch on the Philippine rules in Pay setup after installing them"}. {holidayCount === 0 && <>No holidays entered yet, so no holiday pay is computed. <Link href="/payroll/holidays" className="font-medium text-brand hover:underline">Add the calendar</Link>. </>}{profiles === 0 && "No employee has a tax profile yet: everyone is treated as a private employee who is not a minimum wage earner."}
        </p>
        {pack.length > 0 && <p className="text-xs text-muted">Starter set installed: {pack.join(", ")}.</p>}
      </Card>

      <Card className="space-y-3">
        <div><h2 className="text-lg font-semibold">Install the starter rules</h2><p className="text-sm text-muted">Adds the rules for who you pay. Rules already there are left alone, so this is safe to run again.</p></div>
        <InstallButtons what="rules" />
      </Card>

      <Card className="space-y-3">
        <div><h2 className="text-lg font-semibold">Statutory leave types</h2><p className="text-sm text-muted">Adds maternity, paternity, solo parent, VAWC and the rest (private), or the Civil Service set (government), as ordinary leave types you can edit. Existing names are kept.</p></div>
        <InstallButtons what="leaves" />
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Rules in this organization <Badge>{rules.length}</Badge></h2>
        {rules.length === 0 && <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-muted">No rules yet. Install the starter rules above.</p>}
        {[...byCode.entries()].map(([code, versions]) => (
          <Card key={code} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{code}</h3>
              <span className="text-sm text-muted">{versions[0].name}</span>
              <Badge>{versions[0].agency}</Badge>
              {versions[0].sector !== "ALL" && <Badge tone="brand">{versions[0].sector === "PRIVATE" ? "Private" : "Government"}</Badge>}
            </div>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {versions.map((v) => {
                const active = pickRule(rows, v.code, today, v.sector === "ALL" ? undefined : v.sector)?.id === v.id;
                return (
                  <li key={v.id} className="space-y-2 px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{fmt(v.effectiveFrom)} → {v.effectiveTo ? fmt(v.effectiveTo) : "no end"} {active && <Badge tone="success">in force today</Badge>}</p>
                      <RemoveRuleButton id={v.id} label={`${v.code} from ${fmt(v.effectiveFrom)}`} />
                    </div>
                    <p className="text-muted">{describeRule(v.kind as RuleKind, v.params)}</p>
                    <p className="text-xs text-muted">{v.legalBasis}{v.note ? ` ${v.note}` : ""}</p>
                    {!v.effectiveTo && <EndRuleForm id={v.id} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <div><h2 className="text-lg font-semibold">Change or add a rule</h2><p className="text-sm text-muted">When a circular changes a rate, add a new version that starts on the effective date. The earlier version ends the day before.</p></div>
        <AddRuleVersionForm existing={existing} />
      </Card>

      <Card className="space-y-4">
        <div><h2 className="text-lg font-semibold">Minimum wage (wage orders)</h2><p className="text-sm text-muted">Enter the daily minimum from the current regional wage order. Payroll warns when a daily rate is below it, and checks minimum wage earners against it. Set each employee&apos;s region on their tax profile.</p></div>
        {wageOrders.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {wageOrders.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span><span className="font-medium">{w.region}</span> · {w.orderNo}{w.sector ? ` · ${w.sector}` : ""} · {formatMoney(w.dailyMinimumCents)} a day · from {fmt(w.effectiveFrom)}{w.effectiveTo ? ` to ${fmt(w.effectiveTo)}` : ""}</span>
                <RemoveWageOrderButton id={w.id} label={`${w.region} ${w.orderNo}`} />
              </li>
            ))}
          </ul>
        )}
        <WageOrderForm />
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold">What is not computed</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {NOT_COVERED.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </Card>
    </div>
  );
}
