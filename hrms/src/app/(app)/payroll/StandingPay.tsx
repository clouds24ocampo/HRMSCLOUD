import { Icon, StampIcon, ICON_INLINE } from "@/components/Icon";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { regularMinutesOf, type Attendance } from "@/lib/payroll";
import { formatMoney } from "@/lib/money";
import { teamActivity, type ActivityDay } from "@/lib/pay-breakdown";
import { dbDate, formatDay, formatDuration, formatTime, keyOfDbDate } from "@/lib/time";
import { mapUrl } from "@/lib/locale";
import { Badge, Card } from "@/components/ui";

const short = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric" });
const VERB = { IN: "", OUT: "", PAUSE_START: "start", PAUSE_END: "end" } as const;
type Settings = { timezone: string; graceMinutes: number; daysPerYear: number; hoursPerDay: number; otMultiplierBp: number };

// One day: its tags (late, undertime, issue time, overtime, system time-out, missing location), every stamp with where, and the pay.
function Day({ d, tz }: { d: ActivityDay; tz: string }) {
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{formatDay(d.day)}</p>
        <p className="text-sm tabular-nums"><span className="text-muted">{formatDuration(d.paidMinutes) || "0m"} paid · </span><span className="font-bold">{formatMoney(d.dayCents)}</span></p>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {d.status === "ABSENT" && <Badge tone="danger">Absent</Badge>}
        {d.status === "LEAVE" && <Badge tone="brand">On leave</Badge>}
        {d.status === "INCOMPLETE" && <Badge tone="warning">No time out yet (not paid until closed)</Badge>}
        {d.lateMinutes > 0 && <Badge tone="warning">Late {formatDuration(d.lateMinutes)}</Badge>}
        {d.undertimeMinutes > 0 && d.status === "PRESENT" && <Badge tone="warning">Under {formatDuration(d.undertimeMinutes)}</Badge>}
        {d.issueMinutes > 0 && <Badge tone="danger">Issue {formatDuration(d.issueMinutes)} · not paid</Badge>}
        {d.recoveredMinutes > 0 && <Badge tone="success">Recovered {formatDuration(d.recoveredMinutes)} of earlier issue time</Badge>}
        {d.approvedOtMinutes > 0 && <Badge tone="success">Overtime {formatDuration(d.approvedOtMinutes)} approved</Badge>}
        {d.overtimeMinutes - d.approvedOtMinutes - d.recoveredMinutes > 0 && <Badge>Extra {formatDuration(d.overtimeMinutes - d.approvedOtMinutes - d.recoveredMinutes)} not approved, not paid</Badge>}
        {d.systemTimeout && <Badge tone="danger">System time-out</Badge>}
        {d.noLocation > 0 && <Badge tone="danger">{d.noLocation} without location</Badge>}
      </div>
      {d.stamps.length > 0 && (
        <ol className="mt-2 space-y-1 text-xs">
          {d.stamps.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="w-16 shrink-0 font-semibold tabular-nums">{formatTime(e.at, tz)}</span>
              <span><StampIcon value={e.icon} className="h-4 w-4 inline align-text-bottom" /> {e.name} {VERB[e.type]}{e.issue && <span className="text-danger"> (issue)</span>}</span>
              {e.lat != null && e.lng != null ? (
                <a href={mapUrl(e.lat, e.lng)} target="_blank" rel="noopener noreferrer" className={e.gpsStatus === "OK" ? "text-brand hover:underline" : "text-warning hover:underline"}>
                  <Icon name="location" className={ICON_INLINE} /> ±{Math.round(e.accuracy ?? 0)} m{e.device === "DESKTOP" ? " · computer" : e.device ? " · phone" : ""}
                </a>
              ) : e.source === "SYSTEM" ? <span className="font-semibold text-danger">by the system (no log out)</span>
                : e.source === "MANUAL" ? <span className="text-warning">added by HR</span> : <span className="text-danger">no location</span>}
              {e.note && <span className="basis-full pl-[4.5rem] italic text-muted">“{e.note}”</span>}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

// Everyone, what they are owed for one cut-off not yet paid out, and under each person every day's time stamps and pay.
// Opens on the next pay day. Amounts are the payroll's own payslips; the per-day pay uses the same rule as the payroll.
export async function StandingPay({ organizationId, today, pick, settings }: { organizationId: string; today: string; pick?: string; settings: Settings }) {
  const periods = await prisma.payrollPeriod.findMany({
    where: { organizationId, kind: "REGULAR", OR: [{ status: { not: "FINALIZED" } }, { payDate: { gte: dbDate(today) } }] },
    orderBy: { payDate: "asc" },
    take: 6,
  });
  if (!periods.length) return null;
  const next = periods.find((p) => keyOfDbDate(p.payDate) >= today) ?? periods[periods.length - 1];
  const period = periods.find((p) => p.id === pick) ?? next;
  const [people, slips] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId, status: { not: "SEPARATED" }, hireDate: { lte: period.endDate } }, select: { id: true, firstName: true, lastName: true, employeeNo: true, department: { select: { name: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.payslip.findMany({ where: { periodId: period.id, organizationId }, select: { id: true, employeeId: true, grossCents: true, deductionsCents: true, netCents: true, inputs: true, payouts: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } } }),
  ]);
  const activity = await teamActivity(organizationId, people.map((p) => p.id), keyOfDbDate(period.startDate), keyOfDbDate(period.endDate), today, settings);
  const byEmp = new Map(slips.map((s) => [s.employeeId, s]));
  const sum = slips.reduce((t, s) => ({ gross: t.gross + s.grossCents, ded: t.ded + s.deductionsCents, net: t.net + s.netCents }), { gross: 0, ded: 0, net: 0 });
  const live = period.status !== "FINALIZED" && !period.calculatedById;
  const tz = settings.timezone;

  return (
    <Card className="space-y-4">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Standing pay · {period.name}</h2>
          <p className="text-sm text-muted">
            {short(period.startDate)} – {short(period.endDate)} · pay day <span className="font-semibold text-ink">{formatDay(keyOfDbDate(period.payDate), { weekday: "short", month: "short", day: "numeric" })}</span> ·{" "}
            {period.status === "FINALIZED" ? "final" : live ? "live: follows the time clock, updated hourly" : period.status.toLowerCase()}
          </p>
        </div>
        <nav aria-label="Cut-off to show" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {periods.map((p) => (
            <Link key={p.id} href={`/payroll?standing=${p.id}`} aria-current={p.id === period.id ? "page" : undefined}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold ${p.id === period.id ? "border-brand bg-brand/10 text-brand" : "border-line hover:bg-bg"}`}>
              {p.name}{p.id === next.id ? " · next pay day" : ""}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div><p className="text-muted">Gross</p><p className="whitespace-nowrap font-bold tabular-nums sm:text-lg">{formatMoney(sum.gross)}</p></div>
        <div><p className="text-muted">Deductions</p><p className="whitespace-nowrap font-bold tabular-nums sm:text-lg">{formatMoney(sum.ded)}</p></div>
        <div><p className="text-muted">Net to pay</p><p className="whitespace-nowrap font-bold tabular-nums sm:text-lg">{formatMoney(sum.net)}</p></div>
      </div>

      <ul className="space-y-2" aria-label="Employees">
        {people.map((e) => {
          const s = byEmp.get(e.id);
          const a = (s?.inputs as { attendance?: Attendance } | null)?.attendance;
          const out = s?.payouts[0];
          const days = activity.get(e.id) ?? [];
          const flags = days.reduce((n, d) => n + (d.lateMinutes ? 1 : 0) + (d.noLocation ? 1 : 0) + (d.systemTimeout ? 1 : 0) + (d.status === "ABSENT" ? 1 : 0), 0);
          return (
            <li key={e.id} className="rounded-xl border border-line">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5 marker:hidden">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{e.lastName}, {e.firstName}</span>
                    <span className="block truncate text-xs text-muted">
                      {e.employeeNo}{e.department ? ` · ${e.department.name}` : ""} · {days.filter((d) => d.stamps.length).length} day{days.filter((d) => d.stamps.length).length === 1 ? "" : "s"} logged{a ? ` · ${formatDuration(regularMinutesOf(a)) || "0m"} paid` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {flags > 0 && <Badge tone="warning">{flags} flag{flags === 1 ? "" : "s"}</Badge>}
                    {out && <Badge tone={out.status === "CONFIRMED" ? "success" : out.status === "DISPUTED" ? "danger" : "warning"}>{out.status === "CONFIRMED" ? "Paid" : out.status === "DISPUTED" ? "Problem" : "Paid, waiting"}</Badge>}
                    <span className={`text-right font-bold tabular-nums ${s && s.netCents < 0 ? "text-danger" : ""}`}>{s ? formatMoney(s.netCents) : "—"}</span>
                  </span>
                </summary>
                <div className="space-y-3 border-t border-line p-3">
                  {s ? (
                    <p className="text-sm">
                      Gross {formatMoney(s.grossCents)} · deductions {formatMoney(s.deductionsCents)} · net <span className="font-semibold">{formatMoney(s.netCents)}</span> ·{" "}
                      <Link href={`/payslips/${s.id}`} className="font-semibold text-brand hover:underline">Payslip</Link> ·{" "}
                      <Link href={`/dtr?employee=${e.id}&from=${keyOfDbDate(period.startDate)}&to=${keyOfDbDate(period.endDate)}`} className="font-semibold text-brand hover:underline">DTR</Link>
                    </p>
                  ) : (
                    <p className="text-sm text-muted">Not in this payroll: <Link href={`/employees/${e.id}`} className="text-brand hover:underline">set a pay rate</Link> or calculate it.</p>
                  )}
                  {days.length === 0 ? <p className="text-sm text-muted">No time stamps in this cut-off.</p> : <ul className="space-y-2">{days.map((d) => <Day key={d.day} d={d} tz={tz} />)}</ul>}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">The day amounts are gross for the day (hours paid plus approved overtime). Deductions such as cash advances come off once, on the payslip.</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href={`/payroll/${period.id}`} className="inline-block text-sm font-semibold text-brand hover:underline">Open this payroll to calculate, approve and finalize</Link>
        <a href={`/dtr/report?${new URLSearchParams({ employee: "all", from: keyOfDbDate(period.startDate), to: keyOfDbDate(period.endDate) })}`} className="inline-block text-sm font-semibold text-brand hover:underline">DTR report with daily wages (PDF)</a>
      </div>
    </Card>
  );
}
