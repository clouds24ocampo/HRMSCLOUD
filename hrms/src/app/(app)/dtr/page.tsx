import { Icon, StampIcon, ICON_INLINE } from "@/components/Icon";
import { mapUrl } from "@/lib/locale";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { getClockInfo } from "@/lib/clock";
import { punchLabel } from "@/lib/punch";
import { getStampTypes } from "@/lib/stamps";
import { loadDtr, MAX_RANGE_DAYS } from "@/lib/dtr-data";
import { restDayViolations, type DtrStatus } from "@/lib/dtr";
import { addDays, dayKey, daysBetween, formatDay, formatDuration, formatDurationPrecise, formatTimePrecise, weekStart } from "@/lib/time";
import { aggregateByMonth, aggregateByWeek, summarizeProductivity } from "@/lib/productivity";
import { ClockCard } from "@/components/ClockCard";
import { Badge, Card, EmptyState, PageHeader, Stat, buttonClass, ghostClass, inputClass } from "@/components/ui";

import { ManualPunchForm, VoidForm } from "./DtrForms";
import { RequestOvertimeForm } from "@/app/(app)/overtime/OvertimeForms";
import { LEAVE_STATUS } from "@/lib/leave";

const STATUS: Record<DtrStatus, { label: string; tone: "success" | "warning" | "danger" | "brand" | "neutral" }> = {
  PRESENT: { label: "Present", tone: "success" },
  INCOMPLETE: { label: "No clock-out", tone: "warning" },
  ABSENT: { label: "Absent", tone: "danger" },
  LEAVE: { label: "On leave", tone: "brand" },
  DAY_OFF: { label: "Day off", tone: "neutral" },
  NO_SCHEDULE: { label: "No schedule", tone: "neutral" },
};
const CONTEXT = { OFFICE: "Office", FIELD: "Field work / Client site", REMOTE: "Remote", CLIENT_SITE: "Field work / Client site" } as const;
const isKey = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function DtrPage({ searchParams }: { searchParams: Promise<{ employee?: string; from?: string; to?: string; view?: string }> }) {
  const me = await requireUser("/dtr");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const today = dayKey(new Date(), tz);
  const hr = isHr(me.role.key);

  const ws = weekStart(today);
  let from = isKey(sp.from) ? sp.from! : ws;
  let to = isKey(sp.to) ? sp.to! : addDays(ws, 6);
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to).length > MAX_RANGE_DAYS) to = addDays(from, MAX_RANGE_DAYS - 1);

  const scope = await employeeScope(me, mine.id);
  const people = await prisma.employee.findMany({
    where: scope,
    select: { id: true, firstName: true, lastName: true, employeeNo: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 300,
  });
  const employeeId = sp.employee ?? mine.id;
  const data = await loadDtr(me, mine.id, employeeId, from, to, tz, settings.graceMinutes);
  if (!data) notFound();

  const stampOptions = hr
    ? (await getStampTypes(me.organizationId, true)).flatMap((t) =>
        t.kind === "PAUSE"
          ? [{ value: `${t.id}|START`, label: `${t.name} (start)` }, { value: `${t.id}|END`, label: `${t.name} (end)` }]
          : [{ value: `${t.id}|MAIN`, label: t.name }],
      )
    : [];
  const own = employeeId === mine.id;
  const clock = own ? await getClockInfo(me.organizationId, mine.id, tz) : null;
  const sum = data.rows.reduce(
    (a, r) => ({
      present: a.present + (r.status === "PRESENT" || r.status === "INCOMPLETE" ? 1 : 0),
      absent: a.absent + (r.status === "ABSENT" ? 1 : 0),
      worked: a.worked + r.workedMinutes,
      late: a.late + r.lateMinutes,
      under: a.under + r.undertimeMinutes,
      over: a.over + r.overtimeMinutes,
    }),
    { present: 0, absent: 0, worked: 0, late: 0, under: 0, over: 0 },
  );
  const view = sp.view === "week" ? "week" : sp.view === "month" ? "month" : "day";
  const productivity = summarizeProductivity(data.rows);
  const weeklyRollup = aggregateByWeek(data.rows);
  const monthlyRollup = aggregateByMonth(data.rows);

  const q = (o: Record<string, string>) => `/dtr?${new URLSearchParams({ employee: employeeId, view, ...o })}`;
  const prevWs = addDays(weekStart(from), -7);
  const nextWs = addDays(weekStart(from), 7);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="DTR & Productivity"
        subtitle={`${data.employee.firstName} ${data.employee.lastName} · ${data.employee.employeeNo}. 100% timestamp precision. Working hours vs issues & breaks. Times are ${tz}.`}
        action={
          <span className="flex flex-wrap gap-2">
            <a href={`/dtr/report?${new URLSearchParams({ employee: employeeId, from, to })}`} className={ghostClass}>Download PDF</a>
            {(hr || me.role.key === ROLES.MANAGER) && <a href={`/dtr/report?${new URLSearchParams({ employee: "all", from, to })}`} className={ghostClass}>PDF, everyone</a>}
            <a href={`/dtr/export?${new URLSearchParams({ employee: employeeId, from, to })}`} className={ghostClass}>Download CSV</a>
          </span>
        }
      />

      {!data.hasSchedule && (
        <div role="status" className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-warning">No schedule for {data.employee.firstName} in this period</p>
          <p className="mt-1 text-muted">Late, undertime and overtime cannot be measured without one. {hr || me.role.key === "MANAGER" ? <Link href={`/employees/${employeeId}`} className="font-medium text-brand hover:underline">Set a regular schedule</Link> : "Ask your supervisor or HR to set one."}</p>
        </div>
      )}

      {data.employee.flexible && (
        <div role="status" className={`rounded-2xl border p-4 text-sm ${restDayViolations(data.rows).length ? "border-danger/40 bg-danger/10" : "border-brand/30 bg-brand/5"}`}>
          <p className="font-semibold">Flexible schedule</p>
          <p className="mt-1 text-muted">Own hours and days off: at least 8 hours on each working day, and at least 1 day off a week.</p>
          {restDayViolations(data.rows).length > 0 && <p className="mt-1 font-semibold text-danger">No day off for 7 days in a row on {restDayViolations(data.rows).map((d) => formatDay(d)).join(", ")}.</p>}
        </div>
      )}

      {clock && <ClockCard {...clock} timezone={tz} />}

      <form className="flex flex-wrap items-end gap-2" role="search">
        {people.length > 1 && (
          <label className="block min-w-0 flex-1 basis-56 text-sm font-medium">
            Person
            <select name="employee" defaultValue={employeeId} className={inputClass}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} · {p.employeeNo}</option>
              ))}
            </select>
          </label>
        )}
        {people.length <= 1 && <input type="hidden" name="employee" value={employeeId} />}
        <input type="hidden" name="view" value={view} />
        <label className="block min-w-0 flex-1 basis-36 text-sm font-medium">From<input type="date" name="from" defaultValue={from} className={inputClass} /></label>
        <label className="block min-w-0 flex-1 basis-36 text-sm font-medium">To<input type="date" name="to" defaultValue={to} className={inputClass} /></label>
        <button className={buttonClass}>Show</button>
      </form>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={q({ from: prevWs, to: addDays(prevWs, 6) })} className={ghostClass}>← Previous week</Link>
        <Link href={q({ from: ws, to: addDays(ws, 6) })} className={ghostClass}>This week</Link>
        <Link href={q({ from: nextWs, to: addDays(nextWs, 6) })} className={ghostClass}>Next week →</Link>
      </div>

      {/* Productivity & Hours Overview (Working hours vs Issues & Breaks) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Productive Work"
          value={formatDurationPrecise(productivity.productiveSeconds)}
          tone="success"
          hint={`${productivity.productivityRate}% productivity rate`}
        />
        <Stat
          label="Issue Downtime"
          value={formatDurationPrecise(productivity.issueSeconds)}
          tone={productivity.issueSeconds > 0 ? "warning" : "neutral"}
          hint="Issues (not in productivity)"
        />
        <Stat
          label="Breaks & Meals"
          value={formatDurationPrecise(productivity.breakSeconds)}
          tone="neutral"
          hint="Breaks (not in productivity)"
        />
        <Stat
          label="Gross Logged Span"
          value={formatDurationPrecise(productivity.grossSeconds)}
          hint={`${sum.present} of ${data.rows.length} days present`}
        />
        <Stat
          label="Late · Undertime"
          value={`${formatDuration(sum.late)} · ${formatDuration(sum.under)}`}
          tone={sum.late > 0 || sum.under > 0 ? "warning" : "success"}
          hint={sum.over > 0 ? `OT: ${formatDuration(sum.over)}` : "No overtime"}
        />
      </div>

      {/* View Switcher: Days, Weeks, Months */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-1">
        <div className="flex gap-2 text-sm font-medium">
          <Link
            href={q({ view: "day" })}
            className={`rounded-lg px-3 py-1.5 transition ${view === "day" ? "bg-brand text-white font-semibold shadow-sm" : "bg-surface text-muted hover:text-ink border border-line"}`}
          >
            <Icon name="schedule" className={ICON_INLINE} /> Daily Breakdown ({data.rows.length} days)
          </Link>
          <Link
            href={q({ view: "week" })}
            className={`rounded-lg px-3 py-1.5 transition ${view === "week" ? "bg-brand text-white font-semibold shadow-sm" : "bg-surface text-muted hover:text-ink border border-line"}`}
          >
            <Icon name="week" className={ICON_INLINE} /> Weekly Rollup ({weeklyRollup.length} {weeklyRollup.length === 1 ? "week" : "weeks"})
          </Link>
          <Link
            href={q({ view: "month" })}
            className={`rounded-lg px-3 py-1.5 transition ${view === "month" ? "bg-brand text-white font-semibold shadow-sm" : "bg-surface text-muted hover:text-ink border border-line"}`}
          >
            <Icon name="schedule" className={ICON_INLINE} /> Monthly Rollup ({monthlyRollup.length} {monthlyRollup.length === 1 ? "month" : "months"})
          </Link>
        </div>
        <p className="text-xs text-muted">
          Issues & breaks are separated and excluded from net productivity.
        </p>
      </div>

      {/* VIEW 1: DAILY BREAKDOWN */}
      {view === "day" && (
        data.rows.length === 0 ? (
          <EmptyState title="No days in this range" />
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {data.rows.map((r) => {
                const punches = data.punchesByDay.get(r.day) ?? [];
                const st = STATUS[r.status];
                const showFlags = r.status === "PRESENT" || r.status === "INCOMPLETE";
                const prodSec = r.productiveSeconds ?? 0;
                const issSec = r.issueSeconds ?? 0;
                const brkSec = r.breakSeconds ?? 0;
                const grsSec = r.grossSeconds ?? 0;
                const prodRate = r.productivityRate ?? 0;
                return (
                  <li key={r.day}>
                    <details className="group" open={data.rows.length === 1 ? true : undefined}>
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition marker:hidden hover:bg-bg">
                        <span className="w-24 shrink-0 font-medium">
                          {formatDay(r.day)}{r.day === today && <span className="ml-1 text-xs text-brand">today</span>}
                        </span>
                        <span className="w-28 shrink-0 text-sm text-muted">
                          {r.shift ? `${r.shift.startTime}–${r.shift.endTime}` : r.flex ? "Flexible, 8 h" : r.firstIn ? "No schedule" : "—"}
                        </span>
                        <span className="w-48 shrink-0 text-sm tabular-nums" title="100% recorded punches with exact seconds">
                          {r.firstIn ? `${formatTimePrecise(r.firstIn, tz)} – ${r.lastOut ? formatTimePrecise(r.lastOut, tz) : "…"}` : "—"}
                        </span>
                        <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-ink" title="Net productive working time">
                          {prodSec ? formatDurationPrecise(prodSec) : ""}
                        </span>
                        <span className="flex flex-1 flex-wrap items-center gap-1.5">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {showFlags && issSec > 0 && (
                            <Badge tone="warning"><Icon name="warning" className={ICON_INLINE} /> Issue {formatDurationPrecise(issSec)}</Badge>
                          )}
                          {showFlags && brkSec > 0 && (
                            <Badge tone="neutral"><Icon name="coffee" className={ICON_INLINE} /> Break {formatDurationPrecise(brkSec)}</Badge>
                          )}
                          {showFlags && prodRate < 100 && prodRate > 0 && (
                            <Badge tone="brand">{prodRate}% Prod</Badge>
                          )}
                          {showFlags && !r.shift && !r.flex && <Badge tone="warning">No schedule: not measured</Badge>}
                          {showFlags && r.lateMinutes > 0 && <Badge tone="warning">Late {formatDuration(r.lateMinutes)}</Badge>}
                          {showFlags && r.undertimeMinutes > 0 && r.status === "PRESENT" && <Badge tone="warning">Under {formatDuration(r.undertimeMinutes)}</Badge>}
                          {showFlags && r.overtimeMinutes > 0 && <Badge tone="brand">Over {formatDuration(r.overtimeMinutes)}</Badge>}
                          {data.overtime.get(r.day)?.status === "APPROVED" && <Badge tone="success">OT approved {formatDuration(data.overtime.get(r.day)!.minutes)}</Badge>}
                          {showFlags && r.overLimitMinutes > 0 && <Badge tone="danger">Over break limit {formatDuration(r.overLimitMinutes)}</Badge>}
                          {punches.some((p) => !p.voidedAt && (p.gpsStatus === "DENIED" || p.gpsStatus === "UNAVAILABLE" || p.gpsStatus === "LOW_ACCURACY")) && <Badge tone="danger">Location flag</Badge>}
                        </span>
                        <span className="text-muted transition group-open:rotate-90" aria-hidden>▸</span>
                      </summary>
                      <div className="border-t border-line bg-bg px-5 py-3">
                        {/* Day Productivity Callout */}
                        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted">Productive Work:</span>
                            <span className="font-semibold text-emerald-600">{formatDurationPrecise(prodSec)}</span>
                          </div>
                          <span className="text-line">|</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted">Issues:</span>
                            <span className="font-semibold text-amber-600">{formatDurationPrecise(issSec)}</span>
                          </div>
                          <span className="text-line">|</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted">Breaks:</span>
                            <span className="font-semibold text-muted">{formatDurationPrecise(brkSec)}</span>
                          </div>
                          <span className="text-line">|</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted">Gross Logged:</span>
                            <span className="font-semibold">{formatDurationPrecise(grsSec)}</span>
                          </div>
                          <span className="text-line">|</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted">Productivity:</span>
                            <Badge tone={prodRate >= 95 ? "success" : prodRate >= 80 ? "warning" : "danger"}>
                              {prodRate}%
                            </Badge>
                          </div>
                        </div>


                        {r.status === "PRESENT" && r.overtimeMinutes > 0 && (() => {
                          const ot = data.overtime.get(r.day);
                          if (ot && ot.status !== "CANCELLED") {
                            const s = LEAVE_STATUS[ot.status];
                            return <p className="mb-3 text-sm"><span className="font-medium">Overtime {formatDuration(ot.minutes)}</span> <Badge tone={s.tone}>{s.label}</Badge>{ot.decisionNote ? <span className="text-muted"> — {ot.decisionNote}</span> : null}</p>;
                          }
                          return own ? (
                            <div className="mb-3 rounded-lg border border-line bg-surface p-3">
                              <p className="text-sm">Overtime shown here is only a candidate. Ask for approval so it can be paid.</p>
                              <RequestOvertimeForm day={r.day} label={`Request ${formatDuration(r.overtimeMinutes)} overtime`} />
                            </div>
                          ) : <p className="mb-3 text-sm text-muted">No overtime request for this day yet.</p>;
                        })()}

                        {r.pauses.length > 0 && (
                          <ul className="mb-3 flex flex-wrap gap-2 text-sm">
                            {r.pauses.map((x) => (
                              <li key={x.name} className="rounded-lg border border-line bg-surface px-3 py-1.5">
                                <span className="font-medium">{x.name}</span> {x.count > 1 ? `×${x.count} ` : ""}· {formatDurationPrecise(x.seconds)}{" "}
                                <span className="text-xs text-muted">({x.category === "ISSUE" ? "issue downtime" : x.paid ? "paid" : "unpaid"})</span>
                                {x.overMinutes > 0 && <span className="ml-1 font-semibold text-danger">over by {formatDuration(x.overMinutes)}</span>}
                              </li>
                            ))}
                          </ul>
                        )}

                        {punches.length === 0 ? (
                          <p className="text-sm text-muted">No punches this day.</p>
                        ) : (
                          <ul className="space-y-2">
                            {punches.map((p) => (
                              <li key={p.id} className={`rounded-lg border border-line bg-surface p-3 text-sm ${p.voidedAt ? "opacity-60" : ""}`}>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className={`font-semibold tabular-nums ${p.voidedAt ? "line-through" : ""}`} title="100% recorded server timestamp with seconds">
                                    {formatTimePrecise(p.at, tz)}
                                  </span>
                                  <span>{p.stampType && <><StampIcon value={p.stampType.icon} className="h-4 w-4 inline align-text-bottom" /> </>}{punchLabel(p)}</span>
                                  <Badge>{CONTEXT[p.workContext]}</Badge>
                                  {p.source === "MANUAL" && <Badge tone="warning">Manual entry</Badge>}
                                  {p.source === "SYSTEM" && <Badge tone="danger">System time-out (no log out)</Badge>}
                                {p.source === "KIOSK" && <Badge>Stamped from the login page</Badge>}
                                  {p.lat != null && p.lng != null ? (
                                    <a
                                      href={mapUrl(p.lat, p.lng, 17)}
                                      target="_blank" rel="noopener noreferrer"
                                      className="text-brand underline-offset-2 hover:underline"
                                    >
                                      View location{p.accuracy != null ? ` (±${Math.round(p.accuracy)} m)` : ""}
                                    </a>
                                  ) : p.gpsStatus === "NOT_CAPTURED" ? null : (
                                    <Badge tone="danger">{p.gpsStatus === "DENIED" ? "Location denied" : "No location"}</Badge>
                                  )}
                                  {p.gpsStatus === "LOW_ACCURACY" && <Badge tone="warning">Low accuracy</Badge>}
                                  {p.locSource && <Badge tone={p.locSource === "GPS" || p.locSource === "PHONE_LINK" ? "success" : "warning"}>{({ GPS: "Phone GPS", PHONE_LINK: "Confirmed by phone", WIFI: "Computer estimate", NONE: "No location" } as Record<string, string>)[p.locSource] ?? p.locSource}</Badge>}
                                  {p.device && <span className="text-xs text-muted">{p.device === "DESKTOP" ? <><Icon name="laptop" className={ICON_INLINE} /> computer</> : <><Icon name="smartphone" className={ICON_INLINE} /> phone</>}{p.ipAddress ? ` · IP ${p.ipAddress}` : ""}</span>}
                                </div>
                                {p.tripFrom && <p className="mt-1"><Icon name="location" className={ICON_INLINE} /> <span className="font-medium">{p.tripFrom} → {p.tripTo}</span> <span className="text-muted">· {p.tripReason}</span></p>}
                                {p.note && <p className="mt-1 text-muted">“{p.note}”</p>}
                                {p.voidedAt ? (
                                  <p className="mt-1 text-xs text-danger">Voided: {p.voidReason}</p>
                                ) : (
                                  hr && <div className="mt-1"><VoidForm eventId={p.id} /></div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </Card>
        )
      )}

      {/* VIEW 2: WEEKLY ROLLUP */}
      {view === "week" && (
        weeklyRollup.length === 0 ? (
          <EmptyState title="No weeks in this range" />
        ) : (
          <div className="space-y-4">
            {weeklyRollup.map((w) => (
              <Card key={w.key} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                  <div>
                    <h3 className="font-semibold text-ink">{w.label}</h3>
                    <p className="text-xs text-muted">{w.summary.presentDays} of {w.days.length} days present · {w.from} to {w.to}</p>
                  </div>
                  <Badge tone={w.summary.productivityRate >= 95 ? "success" : w.summary.productivityRate >= 80 ? "warning" : "danger"}>
                    {w.summary.productivityRate}% Productivity
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-xs text-muted">Productive Work</p>
                    <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatDurationPrecise(w.summary.productiveSeconds)}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-xs text-muted">Issue Downtime</p>
                    <p className="text-lg font-bold text-amber-600 tabular-nums">{formatDurationPrecise(w.summary.issueSeconds)}</p>
                    <p className="text-[11px] text-muted">Not in productivity</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-xs text-muted">Breaks & Meals</p>
                    <p className="text-lg font-bold text-ink tabular-nums">{formatDurationPrecise(w.summary.breakSeconds)}</p>
                    <p className="text-[11px] text-muted">Not in productivity</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-xs text-muted">Total Gross Logged</p>
                    <p className="text-lg font-bold text-ink tabular-nums">{formatDurationPrecise(w.summary.grossSeconds)}</p>
                  </div>
                </div>

                {(w.summary.issues.length > 0 || w.summary.breaks.length > 0) && (
                  <div className="space-y-2 pt-1 text-sm">
                    {w.summary.issues.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Issues:</span>
                        {w.summary.issues.map((i) => (
                          <span key={i.name} className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {i.name} ({i.count}×) · {formatDurationPrecise(i.seconds)}
                          </span>
                        ))}
                      </div>
                    )}
                    {w.summary.breaks.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Breaks:</span>
                        {w.summary.breaks.map((b) => (
                          <span key={b.name} className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs text-muted">
                            {b.name} ({b.count}×) · {formatDurationPrecise(b.seconds)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      {/* VIEW 3: MONTHLY ROLLUP */}
      {view === "month" && (
        monthlyRollup.length === 0 ? (
          <EmptyState title="No months in this range" />
        ) : (
          <div className="space-y-4">
            {monthlyRollup.map((m) => (
              <Card key={m.key} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                  <div>
                    <h3 className="font-semibold text-ink">{m.label}</h3>
                    <p className="text-xs text-muted">{m.summary.presentDays} of {m.days.length} days present</p>
                  </div>
                  <Badge tone={m.summary.productivityRate >= 95 ? "success" : m.summary.productivityRate >= 80 ? "warning" : "danger"}>
                    {m.summary.productivityRate}% Productivity
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-xs text-muted">Monthly Productive Work</p>
                    <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatDurationPrecise(m.summary.productiveSeconds)}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-xs text-muted">Monthly Issues Downtime</p>
                    <p className="text-lg font-bold text-amber-600 tabular-nums">{formatDurationPrecise(m.summary.issueSeconds)}</p>
                    <p className="text-[11px] text-muted">Not in productivity</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-xs text-muted">Monthly Breaks</p>
                    <p className="text-lg font-bold text-ink tabular-nums">{formatDurationPrecise(m.summary.breakSeconds)}</p>
                    <p className="text-[11px] text-muted">Not in productivity</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-xs text-muted">Gross Time Logged</p>
                    <p className="text-lg font-bold text-ink tabular-nums">{formatDurationPrecise(m.summary.grossSeconds)}</p>
                  </div>
                </div>

                {(m.summary.issues.length > 0 || m.summary.breaks.length > 0) && (
                  <div className="space-y-2 pt-1 text-sm">
                    {m.summary.issues.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Month&apos;s Issues:</span>
                        {m.summary.issues.map((i) => (
                          <span key={i.name} className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {i.name} ({i.count}×) · {formatDurationPrecise(i.seconds)}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.summary.breaks.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Month&apos;s Breaks:</span>
                        {m.summary.breaks.map((b) => (
                          <span key={b.name} className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs text-muted">
                            {b.name} ({b.count}×) · {formatDurationPrecise(b.seconds)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}


      {hr && (
        <Card>
          <h2 className="mb-1 text-lg font-semibold">Add a missed punch</h2>
          <p className="mb-4 text-sm text-muted">Corrections are added, never edited. The reason stays on record and the entry is marked manual.</p>
          <ManualPunchForm
            today={today}
            selected={employeeId}
            stamps={stampOptions}
            employees={people.map((p) => ({ id: p.id, label: `${p.lastName}, ${p.firstName} · ${p.employeeNo}` }))}
          />
        </Card>
      )}
    </div>
  );
}
