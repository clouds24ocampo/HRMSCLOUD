import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { formatMoney } from "@/lib/money";
import { attendanceSummary, pct } from "@/lib/reports";
import { getOrgSettings } from "@/lib/settings";
import { MAX_RANGE_DAYS } from "@/lib/dtr-data";
import { addDays, dayKey, daysBetween, dbDate, formatDay, formatDuration, formatDurationPrecise } from "@/lib/time";
import { Card, EmptyState, PageHeader, Stat, buttonClass, ghostClass, inputClass } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/labels";


const isKey = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <ul className="space-y-2" role="list">
      {rows.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-line" aria-hidden><span className="block h-full rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} /></span>
          <span className="text-right font-medium tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const me = await requireUser("/reports");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const today = dayKey(new Date(), tz);
  let from = isKey(sp.from) ? sp.from! : `${today.slice(0, 8)}01`;
  let to = isKey(sp.to) ? sp.to! : today;
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to).length > MAX_RANGE_DAYS) to = addDays(from, MAX_RANGE_DAYS - 1);
  const orgId = me.organizationId;
  const fmt = (k: string) => formatDay(k, { month: "short", day: "numeric", year: "numeric" });

  const [people, depts, hires, separations, leave, periods, attendance] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId: orgId, status: { not: "SEPARATED" } }, select: { status: true, department: { select: { name: true } } } }),
    prisma.department.count({ where: { organizationId: orgId, archivedAt: null } }),
    prisma.employmentHistory.count({ where: { organizationId: orgId, change: "HIRED", effectiveFrom: { gte: dbDate(from), lte: dbDate(to) } } }),
    prisma.employmentHistory.count({ where: { organizationId: orgId, change: "STATUS", status: "SEPARATED", effectiveFrom: { gte: dbDate(from), lte: dbDate(to) } } }),
    prisma.leaveRequest.findMany({ where: { organizationId: orgId, status: "APPROVED", startDate: { gte: dbDate(from), lte: dbDate(to) } }, select: { days: true, leaveType: { select: { name: true } } } }),
    prisma.payrollPeriod.findMany({ where: { organizationId: orgId, status: "FINALIZED", payDate: { gte: dbDate(from), lte: dbDate(to) } }, include: { payslips: { select: { grossCents: true, netCents: true, deductionsCents: true, employerCostCents: true } } }, orderBy: { payDate: "asc" } }),
    attendanceSummary(me, mine.id, from, to, tz, settings.graceMinutes),
  ]);

  const byDept = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const p of people) {
    byDept.set(p.department?.name ?? "No department", (byDept.get(p.department?.name ?? "No department") ?? 0) + 1);
    byStatus.set(STATUS_LABEL[p.status], (byStatus.get(STATUS_LABEL[p.status]) ?? 0) + 1);
  }
  const leaveByType = new Map<string, number>();
  for (const l of leave) leaveByType.set(l.leaveType.name, (leaveByType.get(l.leaveType.name) ?? 0) + l.days);
  const pay = periods.flatMap((p) => p.payslips).reduce((a, s) => ({ gross: a.gross + s.grossCents, net: a.net + s.netCents, ded: a.ded + s.deductionsCents, er: a.er + s.employerCostCents }), { gross: 0, net: 0, ded: 0, er: 0 });
  const tot = attendance.reduce((a, r) => ({ sched: a.sched + r.scheduled, present: a.present + r.present, absent: a.absent + r.absent, late: a.late + r.lateCount, lateMin: a.lateMin + r.lateMinutes, ot: a.ot + r.overtimeMinutes }), { sched: 0, present: 0, absent: 0, late: 0, lateMin: 0, ot: 0 });
  const prodTotals = attendance.reduce(
    (a, r) => ({
      productiveSec: a.productiveSec + r.productiveSeconds,
      issueSec: a.issueSec + r.issueSeconds,
      breakSec: a.breakSec + r.breakSeconds,
    }),
    { productiveSec: 0, issueSec: 0, breakSec: 0 }
  );
  const activeSec = prodTotals.productiveSec + prodTotals.issueSec;
  const overallProdRate = activeSec > 0 ? Math.round((prodTotals.productiveSec / activeSec) * 1000) / 10 : (prodTotals.productiveSec > 0 ? 100 : 0);
  const q = new URLSearchParams({ from, to }).toString();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Reports" subtitle="Headcount, attendance, leave, productivity, and payroll cost for a period. Real-time metrics with exact seconds precision." />
      <form className="flex flex-wrap items-end gap-2" role="search">
        <label className="block text-sm font-medium">From<input type="date" name="from" defaultValue={from} className={inputClass} /></label>
        <label className="block text-sm font-medium">To<input type="date" name="to" defaultValue={to} className={inputClass} /></label>
        <button className={buttonClass}>Show</button>
        <Link href="/reports" className="self-center text-sm font-medium text-muted hover:text-ink">This month</Link>
      </form>
      <p className="text-sm text-muted">{fmt(from)} to {fmt(to)}</p>

      {/* Productivity & Hours Breakdown */}
      <section aria-label="Productivity" className="space-y-3">
        <h2 className="text-lg font-semibold">Productivity & Time Utilization</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Productive Work" value={formatDurationPrecise(prodTotals.productiveSec)} tone="success" hint={`${overallProdRate}% overall productivity`} />
          <Stat label="Issue Downtime" value={formatDurationPrecise(prodTotals.issueSec)} tone={prodTotals.issueSec > 0 ? "warning" : "neutral"} hint="Issues & outages (not in productivity)" />
          <Stat label="Breaks & Meals" value={formatDurationPrecise(prodTotals.breakSec)} tone="neutral" hint="Meals & rest (not in productivity)" />
          <Stat label="Overall Productivity" value={`${overallProdRate}%`} tone={overallProdRate >= 95 ? "success" : overallProdRate >= 80 ? "warning" : "danger"} />
        </div>
      </section>

      <section aria-label="People" className="space-y-3">
        <h2 className="text-lg font-semibold">People</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Headcount now" value={people.length} />
          <Stat label="Departments" value={depts} />
          <Stat label="Hired in period" value={hires} tone="success" />
          <Stat label="Left in period" value={separations} tone={separations ? "warning" : "success"} hint={people.length ? `${pct(separations, people.length + separations)}% turnover` : undefined} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card><h3 className="mb-3 font-semibold">By department</h3>{people.length ? <Bars rows={[...byDept].sort((a, b) => b[1] - a[1])} /> : <EmptyState title="No employees yet" />}</Card>
          <Card><h3 className="mb-3 font-semibold">By status</h3>{people.length ? <Bars rows={[...byStatus]} /> : <EmptyState title="No employees yet" />}</Card>
        </div>
      </section>

      <section aria-label="Attendance" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Attendance & Productivity</h2>
          <a href={`/reports/attendance/export?${q}`} className={ghostClass}>Download CSV</a>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Attendance rate" value={`${pct(tot.present, tot.sched)}%`} hint={`${tot.present} of ${tot.sched} scheduled days`} tone="success" />
          <Stat label="Absence rate" value={`${pct(tot.absent, tot.sched)}%`} hint={`${tot.absent} days`} tone={tot.absent ? "danger" : "success"} />
          <Stat label="Late" value={tot.late} hint={formatDuration(tot.lateMin)} tone={tot.late ? "warning" : "success"} />
          <Stat label="Overtime (candidate)" value={formatDuration(tot.ot)} />
        </div>
        {attendance.length === 0 ? <EmptyState title="No one to report on" /> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[50rem] text-sm">
              <thead><tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-2 py-3 text-right font-medium">Scheduled</th>
                <th className="px-2 py-3 text-right font-medium">Present</th>
                <th className="px-2 py-3 text-right font-medium">Productive Work</th>
                <th className="px-2 py-3 text-right font-medium">Issue Downtime</th>
                <th className="px-2 py-3 text-right font-medium">Productivity</th>
                <th className="px-2 py-3 text-right font-medium">Absent</th>
                <th className="px-2 py-3 text-right font-medium">Late</th>
                <th className="px-4 py-3 text-right font-medium">Overtime</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {attendance.map((r) => (
                  <tr key={r.employeeId}>
                    <td className="px-4 py-2.5"><Link href={`/dtr?employee=${r.employeeId}&from=${from}&to=${to}`} className="font-medium hover:text-brand">{r.name}</Link><span className="block text-xs text-muted">{r.department}</span></td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.scheduled}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.present}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-emerald-600">{formatDurationPrecise(r.productiveSeconds)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-amber-600">{r.issueSeconds > 0 ? formatDurationPrecise(r.issueSeconds) : "—"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${r.productivityRate >= 95 ? "bg-emerald-500/10 text-emerald-600" : r.productivityRate >= 80 ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"}`}>
                        {r.productivityRate}%
                      </span>
                    </td>
                    <td className={`px-2 py-2.5 text-right tabular-nums ${r.absent ? "font-semibold text-danger" : ""}`}>{r.absent}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.lateCount ? `${r.lateCount}× · ${formatDuration(r.lateMinutes)}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.overtimeMinutes ? formatDuration(r.overtimeMinutes) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>


      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-3"><h2 className="text-lg font-semibold">Leave taken</h2>{leaveByType.size ? <Bars rows={[...leaveByType]} /> : <p className="text-sm text-muted">No approved leave starting in this period.</p>}</Card>
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Payroll cost</h2>
          {periods.length === 0 ? <p className="text-sm text-muted">No finalized payroll with a pay day in this period.</p> : (
            <>
              <dl className="space-y-1 text-sm">
                {[["Gross pay", pay.gross], ["Deductions", pay.ded], ["Net pay", pay.net], ["Cost to employer", pay.er]].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between border-b border-line py-1"><dt className="text-muted">{k}</dt><dd className="font-medium tabular-nums">{formatMoney(Number(v))}</dd></div>
                ))}
              </dl>
              <p className="text-xs text-muted">{periods.length} finalized period{periods.length === 1 ? "" : "s"}: {periods.map((p) => p.name).join(", ")}</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
