import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatPercent } from "@/lib/money";
import { getOrgSettings } from "@/lib/settings";
import { Badge, Card, PageHeader, ghostClass } from "@/components/ui";
import { TAX_CLASS_LABEL } from "@/lib/labels";
import { AddBracketForm, AddComponentForm, AddContributionForm, FactorsForm, PhSettingsForm } from "./SetupForms";
import { removeBracket, setComponentArchived, setContributionArchived } from "./actions";

export default async function PaySetupPage() {
  const me = await requireUser("/payroll");
  const settings = await getOrgSettings(me.organizationId);
  const [components, contributions, brackets, deMinimisRules] = await Promise.all([
    prisma.payComponent.findMany({ where: { organizationId: me.organizationId }, orderBy: [{ archivedAt: "asc" }, { name: "asc" }] }),
    prisma.contributionRule.findMany({ where: { organizationId: me.organizationId }, orderBy: [{ archivedAt: "asc" }, { name: "asc" }] }),
    prisma.taxBracket.findMany({ where: { organizationId: me.organizationId }, orderBy: { fromCents: "asc" } }),
    prisma.statutoryRule.findMany({ where: { organizationId: me.organizationId, kind: "DE_MINIMIS" }, select: { code: true, name: true }, distinct: ["code"], orderBy: { code: "asc" } }),
  ]);
  const isPh = settings.statutoryProfile === "PHILIPPINES";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/payroll" className="text-sm font-medium text-muted hover:text-ink">← Payroll</Link>
      <PageHeader title="Pay setup" subtitle="The rules payroll follows. Nothing here is built in: you enter your own rates." />
      <div role="note" className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        Government contribution and tax rates change. Enter them from the current official tables, and have a payroll practitioner confirm them before the first real payroll. Run a trial payroll next to your current computation first.
      </div>

      <Card className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Where payroll gets its rates <Badge tone={isPh ? "success" : "neutral"}>{isPh ? "Philippine rules" : "Entered by hand"}</Badge></h2>
          <p className="text-sm text-muted">Philippine rules apply SSS or GSIS, PhilHealth, Pag-IBIG, BIR withholding, 13th month, de minimis limits and DOLE premium pay from dated rules. Entered by hand uses only the contributions and brackets below.</p>
        </div>
        <PhSettingsForm current={settings} />
        <div className="flex flex-wrap gap-2">
          <Link href="/payroll/rules" className={ghostClass}>Philippine rules and wage orders</Link>
          <Link href="/payroll/holidays" className={ghostClass}>Holiday calendar</Link>
          <Link href="/payroll/reports" className={ghostClass}>Remittance and BIR reports</Link>
          <Link href="/payroll/calculators" className={ghostClass}>Benefit estimates</Link>
        </div>
        {isPh && (contributions.length > 0 || brackets.length > 0) && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">The contributions and brackets entered by hand below are ignored while Philippine rules are on.</p>}
      </Card>

      <Card><h2 className="mb-3 text-lg font-semibold">Pay factors</h2><FactorsForm current={settings} /></Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div><h2 className="text-lg font-semibold">Pay items</h2><p className="text-sm text-muted">Allowances, bonuses, loans. Create the item here, then assign it to people on their profile.</p></div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {components.length === 0 && <li className="px-3 py-3 text-sm text-muted">None yet.</li>}
            {components.map((c) => (
              <li key={c.id} className={`flex items-center justify-between gap-2 px-3 py-2.5 ${c.archivedAt ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-sm text-muted">{c.kind === "EARNING" ? "Adds" : "Takes"} {c.calc === "FIXED" ? formatMoney(c.value) : `${formatPercent(c.value)} of basic`}{TAX_CLASS_LABEL[c.taxClass]}{c.preTax ? " · before tax" : ""}{c.inContributionBase ? " · counts for contributions" : ""}{c.mweExempt ? " · untaxed for minimum wage earners" : ""}</p>
                </div>
                <form action={setComponentArchived.bind(null, c.id, !c.archivedAt)}><button className={ghostClass} aria-label={`${c.archivedAt ? "Restore" : "Archive"} ${c.name}`}>{c.archivedAt ? "Restore" : "Archive"}</button></form>
              </li>
            ))}
          </ul>
          <AddComponentForm deMinimis={deMinimisRules.map((r) => ({ code: r.code, name: r.name }))} />
        </Card>

        <Card className="space-y-4">
          <div><h2 className="text-lg font-semibold">Contributions</h2><p className="text-sm text-muted">Shares of basic pay for government programs. Employee share comes off pay, employer share is a cost.</p></div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {contributions.length === 0 && <li className="px-3 py-3 text-sm text-muted">None yet.</li>}
            {contributions.map((c) => (
              <li key={c.id} className={`flex items-center justify-between gap-2 px-3 py-2.5 ${c.archivedAt ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-sm text-muted">Employee {formatPercent(c.employeeBp)} · employer {formatPercent(c.employerBp)}{c.minBaseCents ? ` · from ${formatMoney(c.minBaseCents)}` : ""}{c.maxBaseCents ? ` · up to ${formatMoney(c.maxBaseCents)}` : ""}</p>
                </div>
                <form action={setContributionArchived.bind(null, c.id, !c.archivedAt)}><button className={ghostClass} aria-label={`${c.archivedAt ? "Restore" : "Archive"} ${c.name}`}>{c.archivedAt ? "Restore" : "Archive"}</button></form>
              </li>
            ))}
          </ul>
          <AddContributionForm />
        </Card>
      </div>

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Withholding tax brackets <Badge>{brackets.length}</Badge></h2>
          <p className="text-sm text-muted">For one pay period. Tax = fixed amount + rate × (taxable pay − bracket start), using the highest bracket the pay reaches. With no brackets, no tax is withheld.</p>
        </div>
        {brackets.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {brackets.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span>From <span className="font-medium">{formatMoney(b.fromCents)}</span>: {b.fixedCents ? `${formatMoney(b.fixedCents)} + ` : ""}{formatPercent(b.rateBp)} of the excess</span>
                <form action={removeBracket.bind(null, b.id)}><button className={ghostClass}>Remove</button></form>
              </li>
            ))}
          </ul>
        )}
        <AddBracketForm />
      </Card>
    </div>
  );
}
