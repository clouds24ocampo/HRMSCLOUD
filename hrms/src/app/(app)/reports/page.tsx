import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { formatMoney } from "@/lib/money";
import { attendanceSummary, pct } from "@/lib/reports";
import { getOrgSettings } from "@/lib/settings";
import { MAX_RANGE_DAYS } from "@/lib/dtr-data";
import { addDays, dayKey, daysBetween, dbDate, formatDay, formatDuration, formatDurationPrecise, formatTime, keyOfDbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, Stat, buttonClass, ghostClass, inputClass } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/labels";
import { REQUIRED_201, missing201, FILE_201_CATEGORY } from "@/lib/file201";
import { isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { cardFacts, FACTS_INCLUDE, loadReportData, nameMap, projectScope } from "@/lib/worksync-data";
import { burnUp, cycleTime, dailySeries, personReport, rangeOf } from "@/lib/worksync-report";
import { KIND_LABEL, summarize } from "@/lib/worksync";
import { AddedResolvedChart, BurnUpChart, CardsReport, PeopleTable, ReportTiles } from "../worksync/ReportParts";
import { Progress } from "../worksync/Progress";

const TABS = [
  { key: "attendance", label: "Overview & DTR", icon: "⏱️" },
  { key: "documents", label: "Requirements & 201 Files", icon: "🗂️" },
  { key: "payroll", label: "Payroll & Compensation", icon: "💰" },
  { key: "worksync", label: "WorkSync Tasks", icon: "📋" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const isKey = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const sizeStr = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string; r?: string; employee?: string }>;
}) {
  const me = await requireUser("/reports");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const today = dayKey(new Date(), tz);
  const activeTab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "attendance";

  let from = isKey(sp.from) ? sp.from! : `${today.slice(0, 8)}01`;
  let to = isKey(sp.to) ? sp.to! : today;
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to).length > MAX_RANGE_DAYS) to = addDays(from, MAX_RANGE_DAYS - 1);
  const orgId = me.organizationId;
  const fmt = (k: string) => formatDay(k, { month: "short", day: "numeric", year: "numeric" });
  const hr = isHr(me.role.key);
  const isManager = me.role.key === ROLES.MANAGER;
  // The route already limits /reports to HR and Super Admin; these tabs hold pay and personal-document data, so they check again here
  // in case the route rule is ever widened (pay data is visible to HR and the person only).
  if ((activeTab === "documents" || activeTab === "payroll") && !hr) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Comprehensive reporting on workforce attendance, document requirements, payroll compensation, and cross-project task analytics."
      />

      {/* Primary Tab Navigation */}
      <nav aria-label="Reports tabs" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 text-sm font-medium">
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          const href = `/reports?tab=${t.key}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`;
          return (
            <Link
              key={t.key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 transition ${
                isActive ? "bg-brand text-brand-ink font-semibold" : "text-muted hover:bg-bg"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Date Range Selector for date-filtered tabs */}
      {activeTab !== "worksync" && (
        <form className="flex flex-wrap items-end gap-2" role="search">
          <input type="hidden" name="tab" value={activeTab} />
          <label className="block text-sm font-medium">From<input type="date" name="from" defaultValue={from} className={inputClass} /></label>
          <label className="block text-sm font-medium">To<input type="date" name="to" defaultValue={to} className={inputClass} /></label>
          <button className={buttonClass}>Show</button>
          <Link href={`/reports?tab=${activeTab}`} className="self-center text-sm font-medium text-muted hover:text-ink">This month</Link>
          <span className="ml-auto self-center text-xs text-muted">Showing {fmt(from)} to {fmt(to)}</span>
        </form>
      )}

      {/* Tab 1: Attendance & DTR */}
      {activeTab === "attendance" && (
        <AttendanceReport orgId={orgId} me={me} mineId={mine.id} from={from} to={to} tz={tz} grace={settings.graceMinutes} />
      )}

      {/* Tab 2: Document Requirements & 201 Files */}
      {activeTab === "documents" && (
        <DocumentsReport orgId={orgId} tz={tz} today={today} hr={hr} />
      )}

      {/* Tab 3: Payroll & Compensation */}
      {activeTab === "payroll" && (
        <PayrollReport orgId={orgId} from={from} to={to} tz={tz} hr={hr} />
      )}

      {/* Tab 4: WorkSync Cross-Project Tasks */}
      {activeTab === "worksync" && (
        <WorkSyncReport me={me} mineId={mine.id} tz={tz} today={today} rParam={sp.r} hr={hr} isManager={isManager} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Tab 1: Attendance & DTR Overview
// ──────────────────────────────────────────────
async function AttendanceReport({
  orgId,
  me,
  mineId,
  from,
  to,
  tz,
  grace,
}: {
  orgId: string;
  me: Awaited<ReturnType<typeof requireUser>>;
  mineId: string;
  from: string;
  to: string;
  tz: string;
  grace: number;
}) {
  const [people, depts, hires, separations, leave, periods, attendance] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId: orgId, status: { not: "SEPARATED" } }, select: { status: true, department: { select: { name: true } } } }),
    prisma.department.count({ where: { organizationId: orgId, archivedAt: null } }),
    prisma.employmentHistory.count({ where: { organizationId: orgId, change: "HIRED", effectiveFrom: { gte: dbDate(from), lte: dbDate(to) } } }),
    prisma.employmentHistory.count({ where: { organizationId: orgId, change: "STATUS", status: "SEPARATED", effectiveFrom: { gte: dbDate(from), lte: dbDate(to) } } }),
    prisma.leaveRequest.findMany({ where: { organizationId: orgId, status: "APPROVED", startDate: { gte: dbDate(from), lte: dbDate(to) } }, select: { days: true, leaveType: { select: { name: true } } } }),
    prisma.payrollPeriod.findMany({ where: { organizationId: orgId, status: "FINALIZED", payDate: { gte: dbDate(from), lte: dbDate(to) } }, include: { payslips: { select: { grossCents: true, netCents: true, deductionsCents: true, employerCostCents: true } } }, orderBy: { payDate: "asc" } }),
    attendanceSummary(me, mineId, from, to, tz, grace),
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
    <div className="space-y-6">
      {/* Productivity & Hours Breakdown */}
      <section aria-label="Productivity" className="space-y-3">
        <h2 className="text-lg font-semibold">Productivity & Time Utilization</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Productive Work" value={formatDurationPrecise(prodTotals.productiveSec)} tone="success" hint={`${overallProdRate}% overall productivity`} />
          <Stat label="Issue Downtime" value={formatDurationPrecise(prodTotals.issueSec)} tone={prodTotals.issueSec > 0 ? "warning" : "neutral"} hint="Issues & outages" />
          <Stat label="Breaks & Meals" value={formatDurationPrecise(prodTotals.breakSec)} tone="neutral" hint="Meals & rest periods" />
          <Stat label="Overall Productivity" value={`${overallProdRate}%`} tone={overallProdRate >= 95 ? "success" : overallProdRate >= 80 ? "warning" : "danger"} />
        </div>
      </section>

      {/* Headcount */}
      <section aria-label="People" className="space-y-3">
        <h2 className="text-lg font-semibold">Headcount & Retention</h2>
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

      {/* Attendance & DTR Details */}
      <section aria-label="Attendance" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Attendance & Productivity (DTR)</h2>
          <a href={`/reports/attendance/export?${q}`} className={ghostClass}>Download CSV</a>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Attendance rate" value={`${pct(tot.present, tot.sched)}%`} hint={`${tot.present} of ${tot.sched} scheduled days`} tone="success" />
          <Stat label="Absence rate" value={`${pct(tot.absent, tot.sched)}%`} hint={`${tot.absent} days`} tone={tot.absent ? "danger" : "success"} />
          <Stat label="Late incidents" value={tot.late} hint={formatDuration(tot.lateMin)} tone={tot.late ? "warning" : "success"} />
          <Stat label="Overtime candidate" value={formatDuration(tot.ot)} />
        </div>
        {attendance.length === 0 ? <EmptyState title="No attendance data for this period" /> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-200 text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-2 py-3 text-right font-medium">Scheduled</th>
                  <th className="px-2 py-3 text-right font-medium">Present</th>
                  <th className="px-2 py-3 text-right font-medium">Productive Work</th>
                  <th className="px-2 py-3 text-right font-medium">Issue Downtime</th>
                  <th className="px-2 py-3 text-right font-medium">Productivity</th>
                  <th className="px-2 py-3 text-right font-medium">Absent</th>
                  <th className="px-2 py-3 text-right font-medium">Late</th>
                  <th className="px-4 py-3 text-right font-medium">Overtime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attendance.map((r) => (
                  <tr key={r.employeeId}>
                    <td className="px-4 py-2.5">
                      <Link href={`/dtr?employee=${r.employeeId}&from=${from}&to=${to}`} className="font-medium hover:text-brand">{r.name}</Link>
                      <span className="block text-xs text-muted">{r.department}</span>
                    </td>
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

      {/* Leave & Cost */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-3"><h2 className="text-lg font-semibold">Leave taken</h2>{leaveByType.size ? <Bars rows={[...leaveByType]} /> : <p className="text-sm text-muted">No approved leave in this period.</p>}</Card>
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Payroll summary for period</h2>
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

// ──────────────────────────────────────────────
// Tab 2: Document Requirements & 201 File Compliance
// ──────────────────────────────────────────────
async function DocumentsReport({
  orgId,
  tz,
  today,
  hr,
}: {
  orgId: string;
  tz: string;
  today: string;
  hr: boolean;
}) {
  const [employees, allDocs, users, auditLogs] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId: orgId, status: { not: "SEPARATED" } },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, department: { select: { name: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.employeeDocument.findMany({
      where: { organizationId: orgId },
      include: { employee: { select: { firstName: true, lastName: true, employeeNo: true } } },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId, entity: "EmployeeDocument", action: "document.archived" },
      select: { entityId: true, actorId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const archivedByMap = new Map<string, { actorId: string | null; at: Date }>();
  for (const a of auditLogs) if (a.entityId && !archivedByMap.has(a.entityId)) archivedByMap.set(a.entityId, { actorId: a.actorId, at: a.createdAt });

  // 201 Compliance analysis per employee
  const active201Docs = allDocs.filter((d) => !d.archivedAt && d.category === FILE_201_CATEGORY);
  const docsByEmp = new Map<string, typeof allDocs>();
  for (const d of active201Docs) {
    docsByEmp.set(d.employeeId, [...(docsByEmp.get(d.employeeId) ?? []), d]);
  }

  const compliance = employees.map((e) => {
    const uploaded = docsByEmp.get(e.id) ?? [];
    const titles = uploaded.map((u) => u.title);
    const missing = missing201(titles);
    const satisfied = REQUIRED_201.length - missing.length;
    const rate = Math.round((satisfied / REQUIRED_201.length) * 100);
    return { employee: e, satisfied, total: REQUIRED_201.length, missing, rate };
  });

  const compliantCount = compliance.filter((c) => c.rate === 100).length;
  const expiringSoon = allDocs.filter((d) => !d.archivedAt && d.expiresOn && dayKey(d.expiresOn, tz) >= today && dayKey(d.expiresOn, tz) <= addDays(today, 60));
  const expiredDocs = allDocs.filter((d) => !d.archivedAt && d.expiresOn && dayKey(d.expiresOn, tz) < today);

  const when = (d: Date | null) => (d ? `${formatDay(dayKey(d, tz), { month: "short", day: "numeric" })} ${formatTime(d, tz)}` : "—");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">201 File Compliance & Requirements Audit</h2>
          <p className="text-sm text-muted">Tracking who uploaded, who archived, missing pre-employment requirements, and document renewal dates.</p>
        </div>
        {hr && (
          <a href="/reports/documents/export" className={`${buttonClass} py-1.5! text-sm`}>
            Download requirements report (CSV)
          </a>
        )}
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total documents" value={allDocs.filter((d) => !d.archivedAt).length} hint={`${allDocs.length} including history`} />
        <Stat label="Fully compliant 201" value={`${compliantCount} of ${employees.length}`} tone={compliantCount === employees.length ? "success" : "warning"} hint={employees.length ? `${Math.round((compliantCount / employees.length) * 100)}% compliance` : undefined} />
        <Stat label="Expiring in 60 days" value={expiringSoon.length} tone={expiringSoon.length ? "warning" : undefined} hint={expiringSoon.length ? "action required" : "all good"} />
        <Stat label="Expired documents" value={expiredDocs.length} tone={expiredDocs.length ? "danger" : "success"} />
      </div>

      {/* Employee 201 Requirements Progress */}
      <Card className="p-0">
        <div className="px-5 pt-5">
          <h3 className="font-semibold">Employee Requirements Checklist ({compliance.length})</h3>
          <p className="text-xs text-muted">Philippine standard 201 requirements (13 mandatory items: IDs, clearances, TIN, SSS, PhilHealth, Pag-IBIG, medical).</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-175 text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Employee</th>
                <th className="px-2 py-2.5 font-medium">Department</th>
                <th className="px-2 py-2.5 font-medium">Submitted</th>
                <th className="px-2 py-2.5 font-medium">Compliance %</th>
                <th className="px-2 py-2.5 font-medium">Missing Requirements</th>
                <th className="px-5 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {compliance.map((c) => (
                <tr key={c.employee.id} className="hover:bg-bg/60">
                  <td className="px-5 py-2.5 font-medium">
                    <Link href={`/documents?employee=${c.employee.id}`} className="hover:text-brand hover:underline">
                      {c.employee.lastName}, {c.employee.firstName}
                    </Link>
                    <span className="block text-xs text-muted">{c.employee.employeeNo}</span>
                  </td>
                  <td className="px-2 py-2.5 text-muted">{c.employee.department?.name ?? "—"}</td>
                  <td className="px-2 py-2.5 tabular-nums">{c.satisfied} / {c.total}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20"><Progress percent={c.rate} /></div>
                      <span className="text-xs tabular-nums font-semibold">{c.rate}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-xs">
                    {c.missing.length === 0 ? (
                      <Badge tone="success">Complete</Badge>
                    ) : (
                      <span className="text-muted" title={c.missing.join(", ")}>
                        Missing {c.missing.length}: {c.missing.slice(0, 2).join(", ")}{c.missing.length > 2 ? ` +${c.missing.length - 2} more` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <Link href={`/documents?employee=${c.employee.id}`} className="text-xs font-semibold text-brand hover:underline">
                      Open 201 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Complete Document Audit Trail (Who added, who resolved/archived) */}
      <Card className="p-0">
        <div className="px-5 pt-5">
          <h3 className="font-semibold">Document Audit Trail (Who Added & Resolved)</h3>
          <p className="text-xs text-muted">Complete records: uploader, timestamp, expiration, versioning, and resolver/archiver.</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-212.5 text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Document</th>
                <th className="px-2 py-2.5 font-medium">Employee</th>
                <th className="px-2 py-2.5 font-medium">Category</th>
                <th className="px-2 py-2.5 font-medium">Added By</th>
                <th className="px-2 py-2.5 font-medium">Status</th>
                <th className="px-2 py-2.5 font-medium">Resolved / Archived By</th>
                <th className="px-5 py-2.5 text-right font-medium">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {allDocs.slice(0, 50).map((d) => {
                const arch = archivedByMap.get(d.id);
                const isArch = !!d.archivedAt;
                const isExp = d.expiresOn && dayKey(d.expiresOn, tz) < today;
                return (
                  <tr key={d.id} className="hover:bg-bg/60">
                    <td className="px-5 py-2.5 font-medium">
                      {d.title} {d.version > 1 && <span className="text-xs font-normal text-muted">(v{d.version})</span>}
                      <span className="block text-xs text-muted">{d.fileName} · {sizeStr(d.sizeBytes)}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      {d.employee.lastName}, {d.employee.firstName}
                    </td>
                    <td className="px-2 py-2.5 text-muted">{d.category}</td>
                    <td className="px-2 py-2.5">
                      <span className="font-medium">{d.uploadedById ? userMap.get(d.uploadedById) ?? "Former User" : "System"}</span>
                      <span className="block text-xs text-muted">{when(d.createdAt)}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      {isArch ? (
                        <Badge tone="neutral">Archived</Badge>
                      ) : isExp ? (
                        <Badge tone="danger">Expired</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                      {d.expiresOn && <span className="block text-[11px] text-muted">Exp: {dayKey(d.expiresOn, tz)}</span>}
                    </td>
                    <td className="px-2 py-2.5">
                      {isArch ? (
                        <>
                          <span className="font-medium">{arch?.actorId ? userMap.get(arch.actorId) ?? "Admin" : "Admin"}</span>
                          <span className="block text-xs text-muted">{when(d.archivedAt)}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted">Active (not archived)</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <a href={`/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand hover:underline">
                        Open
                      </a>
                    </td>
                  </tr>
                );
              })}
              {allDocs.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-6 text-center text-muted">No documents uploaded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────
// Tab 3: Payroll & Compensation Analytics
// ──────────────────────────────────────────────
async function PayrollReport({
  orgId,
  from,
  to,
  tz,
  hr,
}: {
  orgId: string;
  from: string;
  to: string;
  tz: string;
  hr: boolean;
}) {
  const [periods, users] = await Promise.all([
    prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, payDate: { gte: dbDate(from), lte: dbDate(to) } },
      include: {
        payslips: {
          select: {
            employeeId: true,
            grossCents: true,
            netCents: true,
            deductionsCents: true,
            employerCostCents: true,
            employee: { select: { firstName: true, lastName: true, employeeNo: true } },
          },
        },
      },
      orderBy: { payDate: "desc" },
    }),
    prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const allSlips = periods.flatMap((p) => p.payslips);
  const totals = periods.reduce(
    (a, p) => {
      const isFinal = p.status === "FINALIZED";
      for (const s of p.payslips) {
        a.gross += s.grossCents;
        a.net += s.netCents;
        a.ded += s.deductionsCents;
        a.er += s.employerCostCents;
        if (isFinal) a.paid += 1;
      }
      return a;
    },
    { gross: 0, net: 0, ded: 0, er: 0, paid: 0 }
  );

  const when = (d: Date | null) => (d ? `${formatDay(dayKey(d, tz), { month: "short", day: "numeric" })} ${formatTime(d, tz)}` : "—");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Payroll & Compensation Disbursements</h2>
          <p className="text-sm text-muted">Auditing pay run lifecycle: who created, who calculated, who finalized, and disbursement totals.</p>
        </div>
        {hr && (
          <Link href="/payroll/reports" className={`${buttonClass} py-1.5! text-sm`}>
            Detailed tax & statutory reports (2316/SSS) →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total Gross Pay" value={formatMoney(totals.gross)} tone="brand" />
        <Stat label="Total Deductions" value={formatMoney(totals.ded)} tone="warning" />
        <Stat label="Total Net Pay" value={formatMoney(totals.net)} tone="success" />
        <Stat label="Employer Cost" value={formatMoney(totals.er)} />
        <Stat label="Disbursements" value={`${totals.paid} of ${allSlips.length}`} hint={allSlips.length ? `${Math.round((totals.paid / allSlips.length) * 100)}% distributed` : undefined} />
      </div>

      {/* Pay Runs Table with Approver / Creator details */}
      <Card className="p-0">
        <div className="px-5 pt-5">
          <h3 className="font-semibold">Payroll Runs in Period ({periods.length})</h3>
          <p className="text-xs text-muted">Exact cycle timestamps and actors responsible for calculating and final approvals.</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-200 text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Payroll Period</th>
                <th className="px-2 py-2.5 font-medium">Pay Date</th>
                <th className="px-2 py-2.5 font-medium">Status</th>
                <th className="px-2 py-2.5 font-medium">Processed / Calculated By</th>
                <th className="px-2 py-2.5 font-medium">Approved & Finalized By</th>
                <th className="px-2 py-2.5 text-right font-medium">Gross Pay</th>
                <th className="px-2 py-2.5 text-right font-medium">Net Disbursed</th>
                <th className="px-5 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {periods.map((p) => {
                const gross = p.payslips.reduce((n, s) => n + s.grossCents, 0);
                const net = p.payslips.reduce((n, s) => n + s.netCents, 0);
                return (
                  <tr key={p.id} className="hover:bg-bg/60">
                    <td className="px-5 py-2.5 font-medium">
                      <Link href={`/payroll/${p.id}`} className="hover:text-brand hover:underline">{p.name}</Link>
                      <span className="block text-xs text-muted">{p.payslips.length} payslips</span>
                    </td>
                    <td className="px-2 py-2.5 text-muted">{p.payDate ? keyOfDbDate(p.payDate) : "—"}</td>
                    <td className="px-2 py-2.5">
                      <Badge tone={p.status === "FINALIZED" ? "success" : p.status === "APPROVED" ? "brand" : "warning"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="font-medium">{p.calculatedById ? userMap.get(p.calculatedById) ?? "Admin" : p.createdById ? userMap.get(p.createdById) ?? "Admin" : "System"}</span>
                      <span className="block text-xs text-muted">{when(p.calculatedAt ?? p.createdAt)}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      {p.finalizedById ? (
                        <>
                          <span className="font-medium">{userMap.get(p.finalizedById) ?? "HR Lead"}</span>
                          <span className="block text-xs text-muted">{when(p.finalizedAt)}</span>
                        </>
                      ) : p.approvedById ? (
                        <>
                          <span className="font-medium">{userMap.get(p.approvedById) ?? "Approver"}</span>
                          <span className="block text-xs text-muted">{when(p.approvedAt)}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted">Pending finalization</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-medium">{formatMoney(gross)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-success">{formatMoney(net)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <Link href={`/payroll/${p.id}`} className="text-xs font-semibold text-brand hover:underline">
                        Open run →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {periods.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-6 text-center text-muted">No payroll runs found for this date range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────
// Tab 4: WorkSync Multi-Project Task Analytics
// ──────────────────────────────────────────────
async function WorkSyncReport({
  me,
  mineId,
  tz,
  today,
  rParam,
  hr,
  isManager,
}: {
  me: Awaited<ReturnType<typeof requireUser>>;
  mineId: string;
  tz: string;
  today: string;
  rParam?: string;
  hr: boolean;
  isManager: boolean;
}) {
  const days = [7, 30, 90].includes(Number(rParam)) ? Number(rParam) : 30;
  const scope = await projectScope(me, mineId);
  const projects = await prisma.wsProject.findMany({
    where: { ...scope, archivedAt: null },
    include: {
      members: { include: { employee: { select: { firstName: true, lastName: true } } } },
      cards: { where: { archivedAt: null }, include: FACTS_INCLUDE },
    },
    orderBy: { updatedAt: "desc" },
  });

  const projectIds = projects.map((p) => p.id);
  const { cards, events } = await loadReportData(projectIds);
  const r = rangeOf(today, days);
  const people = personReport(cards, events, r, tz, today);
  const names = await nameMap([
    ...new Set([
      ...cards.flatMap((c) => [c.createdById, ...(c.completedById ? [c.completedById] : []), ...c.assigneeKeys]),
      ...events.map((e) => e.actorId),
    ]),
  ]);

  const resolvedNow = cards.filter(
    (c) => c.category === "DONE" && c.completedAt && dayKey(c.completedAt, tz) >= r.from && dayKey(c.completedAt, tz) <= r.to
  );
  const onTime = resolvedNow.length
    ? Math.round((resolvedNow.filter((c) => !c.dueDay || dayKey(c.completedAt!, tz) <= c.dueDay).length / resolvedNow.length) * 100)
    : null;
  const added = cards.filter((c) => dayKey(c.createdAt, tz) >= r.from && dayKey(c.createdAt, tz) <= r.to).length;
  const showAll = hr || isManager;

  const projectSummaries = projects.map((p) => ({
    p,
    s: summarize(p.cards.map(cardFacts), today),
  }));

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-sm font-medium">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/reports?tab=worksync&r=${d}`}
              className={`rounded-lg px-3 py-1.5 transition ${days === d ? "bg-brand text-brand-ink" : "text-muted hover:bg-bg"}`}
            >
              Last {d} days
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <a href={`/reports/worksync/export?r=${days}`} className={`${buttonClass} py-1.5! text-sm`}>
            Download cards report (CSV)
          </a>
          {showAll && (
            <a href={`/reports/worksync/export?r=${days}&type=people`} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold transition hover:bg-bg">
              Download people report (CSV)
            </a>
          )}
        </div>
      </div>

      {/* Aggregate Tiles */}
      <ReportTiles
        added={added}
        resolved={resolvedNow.length}
        open={cards.filter((c) => c.category !== "DONE").length}
        cycle={cycleTime(cards, r, tz)}
        onTime={onTime}
      />

      {/* Velocity & Burn-Up Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AddedResolvedChart series={dailySeries(cards, r, tz)} />
        <BurnUpChart data={burnUp(cards, r, tz)} />
      </div>

      {/* WorkSync Projects / Folders Progress Summary */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Project Folders & Progress ({projectSummaries.length})</h3>
            <p className="text-xs text-muted">High-level completion status and card distribution across active workspaces.</p>
          </div>
          <Link href="/worksync" className="text-sm font-semibold text-brand hover:underline">
            Open WorkSync Boards →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
          {projectSummaries.map(({ p, s }) => (
            <Link
              key={p.id}
              href={`/worksync/${p.id}`}
              className="block rounded-xl border border-line bg-surface p-4 transition hover:border-brand/50 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm truncate">{p.name}</span>
                <span className="font-bold text-sm tabular-nums text-brand">{s.percent}%</span>
              </div>
              <p className="text-xs text-muted mt-0.5">{KIND_LABEL[p.kind]} · {s.total} cards</p>
              <div className="mt-2.5">
                <Progress percent={s.percent} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1 text-[11px]">
                <Badge tone="neutral">{s.by.TODO} todo</Badge>
                <Badge tone="brand">{s.by.DOING} doing</Badge>
                {s.by.BLOCKED > 0 && <Badge tone="danger">{s.by.BLOCKED} blocked</Badge>}
                <Badge tone="success">{s.by.DONE} done</Badge>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {/* People Table: Who Added, Who Resolved, Activity */}
      <PeopleTable
        rows={showAll ? people : people.filter((p) => p.key === me.id)}
        names={names}
        days={days}
      />

      {/* All Cards Task Report: Who added, resolved, worked on, progress */}
      <CardsReport
        cards={cards}
        events={events}
        names={names}
        tz={tz}
        href={(c) => `/worksync/${c.projectId}?card=${c.id}`}
        showProject={true}
      />
    </div>
  );
}
