import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { PAYROLL_KIND_LABEL, PAYROLL_STATUS } from "@/lib/labels";
import { formatDay, keyOfDbDate } from "@/lib/time";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { AdjustmentForm, PeriodActions, RemoveAdjustmentButton, SkipForm } from "../PayrollForms";

const STEPS = ["DRAFT", "CALCULATED", "APPROVED", "FINALIZED"] as const;

export default async function PeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/payroll");
  const p = await prisma.payrollPeriod.findFirst({
    where: { id, organizationId: me.organizationId },
    include: {
      payslips: { orderBy: { employeeName: "asc" }, select: { id: true, employeeNo: true, employeeName: true, grossCents: true, deductionsCents: true, netCents: true, employerCostCents: true, taxWithheldCents: true, inputs: true } },
      adjustments: { include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!p) notFound();

  const [people, missing, actors] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId: me.organizationId, status: { not: "SEPARATED" } }, select: { id: true, firstName: true, lastName: true, employeeNo: true }, orderBy: { lastName: "asc" } }),
    prisma.employee.findMany({ where: { organizationId: me.organizationId, status: { not: "SEPARATED" }, compensations: { none: {} } }, select: { firstName: true, lastName: true } }),
    prisma.user.findMany({ where: { id: { in: [p.calculatedById, p.approvedById, p.finalizedById].filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
  ]);
  const skipped = new Set(p.skipEmployeeIds);
  const who = (uid: string | null) => actors.find((a) => a.id === uid)?.name ?? "—";
  const sum = p.payslips.reduce((a, s) => ({ gross: a.gross + s.grossCents, ded: a.ded + s.deductionsCents, net: a.net + s.netCents, er: a.er + s.employerCostCents }), { gross: 0, ded: 0, net: 0, er: 0 });
  const status = PAYROLL_STATUS[p.status];
  const idx = STEPS.indexOf(p.status);
  const fmtDay = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric", year: "numeric" });
  const warnFor = (inputs: unknown) => ((inputs as { warnings?: string[] })?.warnings ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/payroll" className="text-sm font-medium text-muted hover:text-ink">← All pay periods</Link>
      <PageHeader title={p.name} subtitle={`${fmtDay(p.startDate)} – ${fmtDay(p.endDate)} · pay day ${fmtDay(p.payDate)}`} action={<div className="flex flex-wrap gap-2">{p.kind !== "REGULAR" && <Badge tone="brand">{PAYROLL_KIND_LABEL[p.kind]}</Badge>}{p.yearEnd && <Badge tone="warning">Year-end tax adjustment</Badge>}<Badge tone={status.tone}>{status.label}</Badge></div>} />

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === idx ? "step" : undefined} className={`min-w-0 break-words rounded-xl border px-3 py-2 text-sm ${i <= idx ? "border-brand bg-brand/10 font-semibold text-brand" : "border-line text-muted"}`}>
            {PAYROLL_STATUS[s].label}
            <span className="block text-xs font-normal text-muted">{s === "CALCULATED" && p.calculatedAt ? (p.calculatedById ? who(p.calculatedById) : "Automatic, live") : s === "APPROVED" && p.approvedAt ? who(p.approvedById) : s === "FINALIZED" && p.finalizedAt ? who(p.finalizedById) : " "}</span>
          </li>
        ))}
      </ol>

      <Card>
        <PeriodActions id={p.id} status={p.status} hasSlips={p.payslips.length > 0} />
        {p.status === "FINALIZED" && <p className="mt-2 text-sm text-muted">Locked. The database itself refuses changes to these payslips. Corrections go in as adjustments in the next period.</p>}
      </Card>

      {missing.length > 0 && p.status !== "FINALIZED" && (
        <div role="status" className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-warning">Not paid: no pay rate for {missing.map((m) => `${m.firstName} ${m.lastName}`).join(", ")}</p>
          <p className="mt-1 text-muted">Set a pay rate on their profile, then calculate again.</p>
        </div>
      )}

      {p.payslips.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Gross pay" value={formatMoney(sum.gross)} />
            <Stat label="Deductions" value={formatMoney(sum.ded)} />
            <Stat label="Net pay" value={formatMoney(sum.net)} tone="success" />
            <Stat label="Cost to employer" value={formatMoney(sum.er)} />
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 text-right font-medium">Gross</th>
                  <th className="px-3 py-3 text-right font-medium">Deductions</th>
                  <th className="px-3 py-3 text-right font-medium">Net</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.payslips.map((s) => {
                  const w = warnFor(s.inputs);
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{s.employeeName} <span className="text-xs font-normal text-muted">{s.employeeNo}</span></p>
                        {w.map((x) => <p key={x} className="text-xs text-warning">{x}</p>)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(s.grossCents)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(s.deductionsCents)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${s.netCents < 0 ? "text-danger" : ""}`}>{formatMoney(s.netCents)}</td>
                      <td className="px-4 py-2.5 text-right"><Link href={`/payslips/${s.id}`} className="font-medium text-brand hover:underline">View</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {p.status !== "FINALIZED" && (p.kind !== "REGULAR" || skipped.size > 0) && (
        <Card>
          <h2 className="mb-1 text-lg font-semibold">Who is included</h2>
          <p className="mb-3 text-sm text-muted">Tick anyone to leave out of this payroll (for example someone not eligible). Then calculate again.</p>
          <SkipForm periodId={p.id} people={people.map((e) => ({ id: e.id, label: `${e.lastName}, ${e.firstName}` }))} skipped={p.skipEmployeeIds} />
        </Card>
      )}

      {p.status !== "FINALIZED" && (
        <Card>
          <h2 className="mb-1 text-lg font-semibold">Adjustments</h2>
          <p className="mb-4 text-sm text-muted">A one-off correction for this period, with a reason. After adding one, calculate again.</p>
          {p.adjustments.length > 0 && (
            <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
              {p.adjustments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <span><span className="font-medium">{a.employee.firstName} {a.employee.lastName}</span> · {a.label} · {a.kind === "EARNING" ? "+" : "−"}{formatMoney(a.amountCents)} <span className="text-muted">({a.reason})</span></span>
                  <RemoveAdjustmentButton id={a.id} />
                </li>
              ))}
            </ul>
          )}
          <AdjustmentForm periodId={p.id} people={people.map((e) => ({ id: e.id, label: `${e.lastName}, ${e.firstName} · ${e.employeeNo}` }))} />
        </Card>
      )}
    </div>
  );
}
