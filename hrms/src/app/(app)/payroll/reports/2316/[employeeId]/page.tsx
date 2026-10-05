import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { loadYear } from "@/lib/ph/reports";
import { Card, PageHeader } from "@/components/ui";

const Line = ({ n, k, v, strong }: { n: string; k: string; v: number; strong?: boolean }) => (
  <div className={`flex justify-between gap-4 border-b border-line py-1.5 text-sm ${strong ? "font-semibold" : ""}`}><dt><span className="mr-2 text-muted">{n}</span>{k}</dt><dd className="tabular-nums">{formatMoney(v)}</dd></div>
);

// The figures that go on BIR Form 2316 for one employee and year. The form itself is filled and signed through the BIR's channels.
export default async function Form2316Page({ params, searchParams }: { params: Promise<{ employeeId: string }>; searchParams: Promise<{ year?: string }> }) {
  const { employeeId } = await params;
  const sp = await searchParams;
  const me = await requireUser("/payroll");
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : new Date().getUTCFullYear();
  const [org, y] = await Promise.all([prisma.organization.findUnique({ where: { id: me.organizationId }, select: { name: true } }), loadYear(me.organizationId, year, employeeId)]);
  const r = y.rows[0];
  if (!r) notFound();
  const diff = r.taxDueCents === null ? null : r.taxWithheldCents - r.taxDueCents;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/payroll/reports?year=${year}`} className="text-sm font-medium text-muted hover:text-ink print:hidden">← Reports</Link>
      <PageHeader title={`BIR Form 2316 data: ${r.name}`} subtitle={`${org?.name ?? ""} · January 1 to December 31, ${year} · ${r.employeeNo}${r.tin ? ` · TIN ${r.tin}` : ""}`} />
      {!r.tin && <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning print:hidden">No TIN on the tax profile. The certificate needs it.</p>}
      {y.notFinal.length > 0 && <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning print:hidden">Payrolls not finalized and not counted: {y.notFinal.join(", ")}.</p>}
      <Card>
        <dl>
          <Line n="IV" k="Gross compensation income from this employer" v={r.grossCents} />
          <Line n="" k="Less: minimum wage earner exempt pay" v={r.mweExemptCents} />
          <Line n="" k="Less: 13th month pay and other benefits kept exempt (up to the yearly limit)" v={r.benefitsExemptCents} />
          <Line n="" k="Less: de minimis and other non-taxable pay" v={r.otherNonTaxableCents} />
          <Line n="" k="Less: SSS/GSIS, PhilHealth, Pag-IBIG and union dues" v={r.mandatoryCents} />
          <Line n="" k="Taxable compensation (regular)" v={r.taxableCents} />
          <Line n="" k="Taxable 13th month pay and other benefits" v={r.benefitsTaxableCents} />
          <Line n="" k="Total taxable compensation income" v={r.taxableCents + r.benefitsTaxableCents} strong />
          {r.taxDueCents !== null && <Line n="" k="Tax due for the year" v={r.taxDueCents} />}
          <Line n="" k="Tax withheld (including earlier employers and year-end adjustment)" v={r.taxWithheldCents} strong />
        </dl>
        {diff !== null && diff !== 0 && <p className="mt-3 text-sm text-warning">{diff > 0 ? `Over-withheld by ${formatMoney(diff)}: refund it in the year-end adjustment.` : `Under-withheld by ${formatMoney(-diff)}: withhold it in the year-end adjustment.`}</p>}
        {r.previousEmployerCents.length > 0 && (
          <div className="mt-4 border-t border-line pt-3 text-sm">
            <p className="font-semibold">Earlier employers this year (from their 2316)</p>
            <ul className="mt-1 space-y-1 text-muted">{r.previousEmployerCents.map((p) => <li key={p.name}>{p.name}: gross {formatMoney(p.grossCents)}, taxable {formatMoney(p.taxableCents)}, tax withheld {formatMoney(p.taxWithheldCents)}</li>)}</ul>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted print:hidden">Gross is what this employer paid. Earlier employers are listed separately and counted in the taxable and withheld lines. Use the browser&apos;s Print to save this page.</p>
    </div>
  );
}
