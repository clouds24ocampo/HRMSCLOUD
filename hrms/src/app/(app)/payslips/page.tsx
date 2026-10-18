import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { isHr } from "@/lib/scope";
import { formatMoney } from "@/lib/money";
import { activeCutoffs, payBreakdown } from "@/lib/pay-breakdown";
import { dayKey, dbDate, formatDay, keyOfDbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { PayBreakdown } from "@/components/PayBreakdown";
import { PAYROLL_KIND_LABEL } from "@/lib/labels";
import { CutoffPicker } from "./CutoffPicker";

const short = (d: string) => formatDay(d, { month: "short", day: "numeric", year: "numeric" });

// One cut-off at a time. The list holds only cut-offs the person has a time stamp or payslip in, newest first, and the
// newest opens on its own. A finalized cut-off shows its payslip; one still running shows its pay so far, day by day.
export default async function PayslipsPage({ searchParams }: { searchParams: Promise<{ employee?: string; cutoff?: string }> }) {
  const me = await requireUser("/payslips");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const hr = isHr(me.role.key);
  // Pay is HR-only: anyone else always sees their own, whatever the URL says.
  const other = hr && sp.employee && sp.employee !== mine.id
    ? await prisma.employee.findFirst({ where: { id: sp.employee, organizationId: me.organizationId }, select: { id: true, firstName: true, lastName: true } })
    : null;
  const emp = other ?? mine;
  const today = dayKey(new Date(), tz);
  // Pay periods made by hand (automatic cut-offs off) do not follow 1–15 / 16–end: list their finalized payslips instead.
  if (!settings.autoCutoffs) return <PeriodList organizationId={me.organizationId} employeeId={emp.id} title={other ? `Payslips of ${other.firstName} ${other.lastName}` : "My payslips"} />;

  const cutoffs = await activeCutoffs(me.organizationId, emp.id, tz);
  const cut = cutoffs.find((c) => c.start === sp.cutoff) ?? cutoffs[0];
  const [slip, extras] = await Promise.all([
    cut
      ? prisma.payslip.findFirst({
          where: { employeeId: emp.id, organizationId: me.organizationId, period: { kind: "REGULAR", status: "FINALIZED", startDate: { lte: dbDate(cut.end) }, endDate: { gte: dbDate(cut.start) } } },
          include: { period: { select: { name: true, payDate: true } }, payouts: { orderBy: { createdAt: "desc" }, take: 1 } },
        })
      : null,
    // 13th month and bonuses are not tied to a cut-off: listed apart.
    prisma.payslip.findMany({
      where: { employeeId: emp.id, organizationId: me.organizationId, period: { kind: { not: "REGULAR" }, status: "FINALIZED" } },
      include: { period: { select: { name: true, kind: true, payDate: true } } },
      orderBy: { period: { payDate: "desc" } },
      take: 12,
    }),
  ]);
  const live = cut && !slip ? await payBreakdown(me, mine.id, emp.id, today, settings, cut) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={other ? `Payslips of ${other.firstName} ${other.lastName}` : "My payslips"} subtitle="Pick a cut-off. Only cut-offs with time stamps or pay are listed." />

      {!cut ? (
        <EmptyState title="No cut-offs yet" hint="A cut-off appears here from the first time in. 1st–15th is paid at month end; 16th–end is paid on the 15th." />
      ) : (
        <>
          <Card className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <CutoffPicker
              value={cut.start}
              employee={other?.id}
              options={cutoffs.map((c) => ({ start: c.start, label: `${c.name}${c.start <= today && today <= c.end ? " (current)" : ""}` }))}
            />
            <p className="text-sm text-muted">{short(cut.start)} – {short(cut.end)} · pay day {short(cut.payDate)}</p>
          </Card>

          {slip ? (
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{slip.period.name}</h2>
                <Badge tone="success">Final · paid {short(keyOfDbDate(slip.period.payDate))}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-muted">Gross</p><p className="text-lg font-bold tabular-nums">{formatMoney(slip.grossCents)}</p></div>
                <div><p className="text-muted">Deductions</p><p className="text-lg font-bold tabular-nums">{formatMoney(slip.deductionsCents)}</p></div>
                <div><p className="text-muted">Net pay</p><p className="text-lg font-bold tabular-nums">{formatMoney(slip.netCents)}</p></div>
              </div>
              <p className="text-sm">
                {slip.payouts[0]
                  ? <>Paid {formatMoney(slip.payouts[0].amountCents)} by {slip.payouts[0].method} · <Badge tone={slip.payouts[0].status === "CONFIRMED" ? "success" : slip.payouts[0].status === "DISPUTED" ? "danger" : "warning"}>{slip.payouts[0].status === "CONFIRMED" ? "Receipt confirmed" : slip.payouts[0].status === "DISPUTED" ? "Problem reported" : "Please confirm receipt"}</Badge></>
                  : <span className="text-muted">Payment not recorded yet.</span>}
              </p>
              <Link href={`/payslips/${slip.id}`} className="inline-block font-semibold text-brand hover:underline">Open the payslip, line by line</Link>
            </Card>
          ) : (
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{cut.name}</h2>
                <Badge tone="warning">{cut.end >= today ? "In progress" : "Waiting for payroll to be finalized"}</Badge>
              </div>
              {live ? (
                <PayBreakdown b={live} daysPerYear={settings.daysPerYear} hoursPerDay={settings.hoursPerDay} isAdmin={hr} today={today} />
              ) : (
                <p className="text-sm text-muted">No pay rate on record for this cut-off yet, so the amount cannot be shown. HR sets it on the employee&apos;s profile.</p>
              )}
              <p className="text-xs text-muted">The final payslip, with any government deductions, appears here once HR finalizes the payroll for this cut-off.</p>
            </Card>
          )}
        </>
      )}

      {extras.length > 0 && (
        <Card className="p-0">
          <h2 className="px-5 pt-5 font-semibold">13th month and bonuses</h2>
          <ul className="mt-2 divide-y divide-line">
            {extras.map((s) => (
              <li key={s.id}>
                <Link href={`/payslips/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition hover:bg-bg">
                  <span><span className="font-medium">{s.period.name}</span> <span className="text-sm text-muted">· {PAYROLL_KIND_LABEL[s.period.kind]} · paid {short(keyOfDbDate(s.period.payDate))}</span></span>
                  <span className="font-bold tabular-nums">{formatMoney(s.netCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

async function PeriodList({ organizationId, employeeId, title }: { organizationId: string; employeeId: string; title: string }) {
  // Only finalized payslips: nothing is shown while payroll is still being checked.
  const slips = await prisma.payslip.findMany({
    where: { employeeId, organizationId, period: { status: "FINALIZED" } },
    include: { period: { select: { name: true, payDate: true } } },
    orderBy: { period: { payDate: "desc" } },
    take: 36,
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={title} subtitle="Released after payroll is approved and locked." />
      {slips.length === 0 ? (
        <EmptyState title="No payslips yet" hint="Your payslip appears here when payroll for a period is finalized." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {slips.map((s) => (
              <li key={s.id}>
                <Link href={`/payslips/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 transition hover:bg-bg">
                  <div>
                    <p className="font-medium">{s.period.name}</p>
                    <p className="text-sm text-muted">Paid {short(keyOfDbDate(s.period.payDate))}</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">{formatMoney(s.netCents)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
