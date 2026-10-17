import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { addDays, dayKey, formatDay, keyOfDbDate } from "@/lib/time";
import { getOrgSettings } from "@/lib/settings";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { PAYROLL_KIND_LABEL, PAYROLL_STATUS as STATUS } from "@/lib/labels";
import { CreatePeriodForm } from "./PayrollForms";
import { StatutoryToggle } from "./StatutoryToggle";
import { StandingPay } from "./StandingPay";
import { autoPayroll } from "@/lib/payroll-auto";
import { cutoffFor } from "@/lib/cutoffs";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ standing?: string }> }) {
  const me = await requireUser("/payroll");
  const { standing } = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const today = dayKey(new Date(), settings.timezone);
  // The 1–15 and 16–end cut-offs exist on their own, and their numbers follow the DTR (refreshed at most hourly).
  let autoError = false;
  try {
    await autoPayroll(me, today);
  } catch (e) {
    console.error("[payroll] automatic cut-offs failed", e);
    autoError = true;
  }
  const [periods, totals, withoutPay, incentives] = await Promise.all([
    prisma.payrollPeriod.findMany({ where: { organizationId: me.organizationId }, orderBy: { startDate: "desc" }, take: 36, include: { _count: { select: { payslips: true } } } }),
    prisma.payslip.groupBy({ by: ["periodId"], where: { organizationId: me.organizationId }, _sum: { netCents: true, grossCents: true } }),
    prisma.employee.count({ where: { organizationId: me.organizationId, status: { not: "SEPARATED" }, compensations: { none: {} } } }),
    prisma.statutoryRule.findMany({ where: { organizationId: me.organizationId, kind: "INCENTIVE" }, select: { code: true, name: true }, distinct: ["code"], orderBy: { code: "asc" } }),
  ]);
  const isPh = settings.statutoryProfile === "PHILIPPINES";
  const sum = new Map(totals.map((t) => [t.periodId, t._sum]));
  const last = periods.find((p) => p.kind === "REGULAR");
  const next = cutoffFor(last ? addDays(keyOfDbDate(last.endDate), 1) : today);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Pay periods, from calculation to approval to a locked payslip."
        action={<div className="flex flex-wrap gap-2"><Link href="/payroll/reports" className="rounded-lg border border-line px-4 py-2.5 font-semibold transition hover:bg-bg">Reports</Link><Link href="/payroll/setup" className={buttonClass}>Pay setup</Link></div>}
      />
      <StandingPay organizationId={me.organizationId} today={today} pick={standing} settings={settings} />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Automatic cut-offs</h2>
            <p className="text-sm text-muted">{settings.autoCutoffs ? "" : "Off: pay periods are created by hand below. Turn it on in Pay setup. When on: "}1st–15th is paid on the last day of the month (30th or 31st). 16th–end of month is paid on the 15th of the next month. Each is created on its own and recalculated from the DTR every hour until someone presses Calculate. Overtime counts only after the department head and HR approve it.</p>
          </div>
        </div>
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-sm font-medium">Government contributions and withholding tax (SSS, PhilHealth, Pag-IBIG, BIR)</p>
          <StatutoryToggle on={settings.deductStatutory} />
        </div>
        {autoError && <p role="alert" className="text-sm text-danger">The automatic cut-offs could not be updated just now. The list below may be out of date; reload to try again.</p>}
      </Card>
      {withoutPay > 0 && (
        <div role="status" className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-warning">{withoutPay} employee{withoutPay === 1 ? " has" : "s have"} no pay rate</p>
          <p className="mt-1 text-muted">They are skipped when payroll is calculated. Set a pay rate on each employee&apos;s profile.</p>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {periods.length === 0 ? (
            <EmptyState title="No pay periods yet" hint="Create the first one. Set up pay rates and contributions first if you have not." />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {periods.map((p) => {
                  const s = STATUS[p.status];
                  const t = sum.get(p.id);
                  return (
                    <li key={p.id}>
                      <Link href={`/payroll/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition hover:bg-bg">
                        <div className="min-w-0">
                          <p className="font-medium">{p.name}{p.kind !== "REGULAR" && <span className="ml-2"><Badge tone="brand">{PAYROLL_KIND_LABEL[p.kind]}</Badge></span>}</p>
                          <p className="text-sm text-muted">{formatDay(keyOfDbDate(p.startDate), { month: "short", day: "numeric" })} – {formatDay(keyOfDbDate(p.endDate), { month: "short", day: "numeric", year: "numeric" })} · pay day {formatDay(keyOfDbDate(p.payDate), { month: "short", day: "numeric" })}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {p._count.payslips > 0 && <span className="text-sm tabular-nums text-muted">{p._count.payslips} payslips · net {formatMoney(t?.netCents ?? 0)}</span>}
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <h2 className="mb-3 text-lg font-semibold">New pay period</h2>
          <CreatePeriodForm defaults={{ name: next.name, start: next.start, end: next.end, pay: next.payDate }} ph={isPh} incentives={incentives} />
        </Card>
      </div>
    </div>
  );
}
