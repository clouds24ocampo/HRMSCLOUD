import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { AGENCY_LABEL, loadMonth, loadYear, type Agency } from "@/lib/ph/reports";
import { getOrgSettings } from "@/lib/settings";
import { dayKey } from "@/lib/time";
import { Card, EmptyState, PageHeader, buttonClass, ghostClass, inputClass } from "@/components/ui";

const Row = ({ k, v, strong }: { k: string; v: string | number; strong?: boolean }) => <div className={`flex justify-between gap-4 border-b border-line py-1.5 text-sm ${strong ? "font-semibold" : ""}`}><dt className="text-muted">{k}</dt><dd className="tabular-nums">{v}</dd></div>;

export default async function PayrollReportsPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const me = await requireUser("/payroll");
  const settings = await getOrgSettings(me.organizationId);
  const today = dayKey(new Date(), settings.timezone);
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : Number(today.slice(0, 4));
  const [m, y] = await Promise.all([loadMonth(me.organizationId, month), loadYear(me.organizationId, year)]);
  const s = m.summary;
  const agencies = (Object.keys(AGENCY_LABEL) as Agency[]).filter((a) => m.remit[a].length > 0);
  const sum = (rows: { employeeCents: number; employerCents: number; ecCents: number }[]) => rows.reduce((n, r) => ({ ee: n.ee + r.employeeCents, er: n.er + r.employerCents, ec: n.ec + r.ecCents }), { ee: 0, er: 0, ec: 0 });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/payroll" className="text-sm font-medium text-muted hover:text-ink">← Payroll</Link>
      <PageHeader title="Remittance and BIR reports" subtitle="Figures for the monthly government remittances and the yearly BIR certificates, from finalized payrolls." />
      <div role="note" className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        These pages prepare the numbers. Filing and payment still happen through the agencies&apos; own systems (BIR eBIRForms or eFPS, My.SSS, PhilHealth EPRS, Pag-IBIG eSRS). Only finalized payrolls count, by pay day.
      </div>

      <form className="flex flex-wrap items-end gap-2" role="search">
        <label className="block text-sm font-medium">Month<input type="month" name="month" defaultValue={month} className={inputClass} /></label>
        <label className="block text-sm font-medium">Year<input type="number" name="year" min={2020} max={2100} defaultValue={year} className={inputClass} /></label>
        <button className={buttonClass}>Show</button>
      </form>

      <section aria-label="Monthly remittances" className="space-y-4">
        <h2 className="text-lg font-semibold">{month}: remittances</h2>
        {m.notFinal.length > 0 && <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">Not finalized, so not counted: {m.notFinal.map((p) => p.name).join(", ")}.</p>}
        {agencies.length === 0 ? (
          <EmptyState title="Nothing to remit this month" hint="Contributions appear here once a payroll with a pay day in this month is finalized." />
        ) : (
          agencies.map((a) => {
            const rows = m.remit[a];
            const t = sum(rows);
            return (
              <Card key={a} className="space-y-3 overflow-x-auto">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{AGENCY_LABEL[a]} · {rows.length} employee{rows.length === 1 ? "" : "s"} · total {formatMoney(t.ee + t.er + t.ec)}</h3>
                  <a href={`/payroll/reports/export?type=${a}&month=${month}`} className={ghostClass}>Download CSV</a>
                </div>
                <table className="w-full min-w-[34rem] text-sm">
                  <thead><tr className="border-b border-line text-left text-muted">
                    <th className="py-2 font-medium">Employee</th><th className="py-2 font-medium">{AGENCY_LABEL[a]} no.</th><th className="py-2 text-right font-medium">Employee</th><th className="py-2 text-right font-medium">Employer</th>{a === "SSS" && <th className="py-2 text-right font-medium">EC</th>}
                  </tr></thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.employeeId}>
                        <td className="py-2 font-medium">{r.name}</td><td className="py-2 text-muted">{r.idNo || <span className="text-warning">missing</span>}</td>
                        <td className="py-2 text-right tabular-nums">{formatMoney(r.employeeCents)}</td><td className="py-2 text-right tabular-nums">{formatMoney(r.employerCents)}</td>{a === "SSS" && <td className="py-2 text-right tabular-nums">{formatMoney(r.ecCents)}</td>}
                      </tr>
                    ))}
                    <tr className="font-semibold"><td className="py-2" colSpan={2}>Total</td><td className="py-2 text-right tabular-nums">{formatMoney(t.ee)}</td><td className="py-2 text-right tabular-nums">{formatMoney(t.er)}</td>{a === "SSS" && <td className="py-2 text-right tabular-nums">{formatMoney(t.ec)}</td>}</tr>
                  </tbody>
                </table>
              </Card>
            );
          })
        )}
      </section>

      <section aria-label="BIR 1601-C" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{month}: BIR Form 1601-C figures (tax withheld on compensation)</h2>
          {s.employees > 0 && <a href={`/payroll/reports/export?type=1601C&month=${month}`} className={ghostClass}>Download CSV</a>}
        </div>
        {s.employees === 0 ? <EmptyState title="No finalized payroll in this month" /> : (
          <Card>
            <dl>
              <Row k="Employees paid" v={s.employees} />
              <Row k="Total compensation" v={formatMoney(s.grossCents)} />
              <Row k="Minimum wage earner exempt pay" v={formatMoney(s.mweExemptCents)} />
              <Row k="13th month pay and other benefits (exempt part)" v={formatMoney(s.benefitsExemptCents)} />
              <Row k="De minimis and other non-taxable pay" v={formatMoney(s.otherNonTaxableCents)} />
              <Row k="SSS/GSIS, PhilHealth, Pag-IBIG and union dues" v={formatMoney(s.mandatoryCents)} />
              <Row k="Taxable compensation" v={formatMoney(s.taxableCents)} />
              <Row k="Taxable 13th month and other benefits" v={formatMoney(s.benefitsTaxableCents)} />
              <Row k="Tax withheld (including year-end adjustments)" v={formatMoney(s.taxWithheldCents)} strong />
            </dl>
          </Card>
        )}
      </section>

      <section aria-label="BIR 2316" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{year}: BIR Form 2316 data (yearly, per employee)</h2>
          {y.rows.length > 0 && <a href={`/payroll/reports/export?type=2316&year=${year}`} className={ghostClass}>Download CSV</a>}
        </div>
        {y.notFinal.length > 0 && <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">Not finalized, so not counted: {y.notFinal.join(", ")}.</p>}
        {y.rows.length === 0 ? <EmptyState title={`No finalized payroll in ${year}`} /> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[44rem] text-sm">
              <thead><tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-3 font-medium">Employee</th><th className="px-2 py-3 text-right font-medium">Gross</th><th className="px-2 py-3 text-right font-medium">Taxable</th><th className="px-2 py-3 text-right font-medium">Tax due</th><th className="px-2 py-3 text-right font-medium">Withheld</th><th className="px-4 py-3 font-medium"><span className="sr-only">Details</span></th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {y.rows.map((r) => {
                  const diff = r.taxDueCents === null ? null : r.taxWithheldCents - r.taxDueCents;
                  return (
                    <tr key={r.employeeId}>
                      <td className="px-4 py-2.5 font-medium">{r.name}<span className="block text-xs font-normal text-muted">{r.tin ? `TIN ${r.tin}` : <span className="text-warning">TIN missing</span>}</span></td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{formatMoney(r.grossCents)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{formatMoney(r.taxableCents + r.benefitsTaxableCents)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{r.taxDueCents === null ? "—" : formatMoney(r.taxDueCents)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{formatMoney(r.taxWithheldCents)}{diff !== null && diff !== 0 && <span className={`block text-xs ${diff > 0 ? "text-warning" : "text-danger"}`}>{diff > 0 ? `${formatMoney(diff)} over` : `${formatMoney(-diff)} short`}: do the year-end adjustment</span>}</td>
                      <td className="px-4 py-2.5 text-right"><Link href={`/payroll/reports/2316/${r.employeeId}?year=${year}`} className="font-medium text-brand hover:underline">Open</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
        {!y.hasAnnualRule && y.rows.length > 0 && <p className="text-sm text-warning">No annual income tax rule is installed, so tax due cannot be shown. Install the Philippine rules.</p>}
      </section>
    </div>
  );
}
