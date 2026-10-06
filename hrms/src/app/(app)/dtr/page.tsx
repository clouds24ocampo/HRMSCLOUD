import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { getClockInfo } from "@/lib/clock";
import { punchLabel } from "@/lib/punch";
import { getStampTypes } from "@/lib/stamps";
import { loadDtr, MAX_RANGE_DAYS } from "@/lib/dtr-data";
import type { DtrStatus } from "@/lib/dtr";
import { addDays, dayKey, daysBetween, formatDay, formatDuration, formatTime, weekStart } from "@/lib/time";
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
const CONTEXT = { OFFICE: "Office", FIELD: "Field work", REMOTE: "Remote", CLIENT_SITE: "Client site" } as const;
const isKey = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function DtrPage({ searchParams }: { searchParams: Promise<{ employee?: string; from?: string; to?: string }> }) {
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
  const q = (o: Record<string, string>) => `/dtr?${new URLSearchParams({ employee: employeeId, ...o })}`;
  const prevWs = addDays(weekStart(from), -7);
  const nextWs = addDays(weekStart(from), 7);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="DTR"
        subtitle={`${data.employee.firstName} ${data.employee.lastName} · ${data.employee.employeeNo}. What was actually worked. Times are ${tz}.`}
        action={
          <a href={`/dtr/export?${new URLSearchParams({ employee: employeeId, from, to })}`} className={ghostClass}>Download CSV</a>
        }
      />

      {!data.hasSchedule && (
        <div role="status" className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-warning">No schedule for {data.employee.firstName} in this period</p>
          <p className="mt-1 text-muted">Late, undertime and overtime cannot be measured without one. {hr || me.role.key === "MANAGER" ? <Link href={`/employees/${employeeId}`} className="font-medium text-brand hover:underline">Set a regular schedule</Link> : "Ask your supervisor or HR to set one."}</p>
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
        <label className="block text-sm font-medium">From<input type="date" name="from" defaultValue={from} className={inputClass} /></label>
        <label className="block text-sm font-medium">To<input type="date" name="to" defaultValue={to} className={inputClass} /></label>
        <button className={buttonClass}>Show</button>
      </form>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={q({ from: prevWs, to: addDays(prevWs, 6) })} className={ghostClass}>← Previous week</Link>
        <Link href={q({ from: ws, to: addDays(ws, 6) })} className={ghostClass}>This week</Link>
        <Link href={q({ from: nextWs, to: addDays(nextWs, 6) })} className={ghostClass}>Next week →</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Days present" value={sum.present} hint={sum.absent ? `${sum.absent} absent` : "No absences"} tone={sum.absent ? "danger" : "success"} />
        <Stat label="Hours worked" value={formatDuration(sum.worked)} />
        <Stat label="Late" value={formatDuration(sum.late)} tone={sum.late ? "warning" : "success"} hint={sum.late ? "after grace" : "On time"} />
        <Stat label="Undertime · Overtime" value={`${formatDuration(sum.under)} · ${formatDuration(sum.over)}`} />
      </div>

      {data.rows.length === 0 ? (
        <EmptyState title="No days in this range" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {data.rows.map((r) => {
              const punches = data.punchesByDay.get(r.day) ?? [];
              const st = STATUS[r.status];
              const showFlags = r.status === "PRESENT" || r.status === "INCOMPLETE";
              return (
                <li key={r.day}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition marker:hidden hover:bg-bg">
                      <span className="w-24 shrink-0 font-medium">{formatDay(r.day)}{r.day === today && <span className="ml-1 text-xs text-brand">today</span>}</span>
                      <span className="w-28 shrink-0 text-sm text-muted">{r.shift ? `${r.shift.startTime}–${r.shift.endTime}` : r.firstIn ? "No schedule" : "—"}</span>
                      <span className="w-36 shrink-0 text-sm tabular-nums">
                        {r.firstIn ? `${formatTime(r.firstIn, tz)} – ${r.lastOut ? formatTime(r.lastOut, tz) : "…"}` : "—"}
                      </span>
                      <span className="w-16 shrink-0 text-sm font-medium tabular-nums">{r.workedMinutes ? formatDuration(r.workedMinutes) : ""}</span>
                      <span className="flex flex-1 flex-wrap items-center gap-1.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {showFlags && !r.shift && <Badge tone="warning">No schedule: not measured</Badge>}
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
                              <span className="font-medium">{x.name}</span> {x.count > 1 ? `×${x.count} ` : ""}· {formatDuration(x.minutes)}{" "}
                              <span className="text-muted">({x.paid ? "paid" : "unpaid"})</span>
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
                                <span className={`font-semibold tabular-nums ${p.voidedAt ? "line-through" : ""}`}>{formatTime(p.at, tz)}</span>
                                <span>{p.stampType ? `${p.stampType.icon} ` : ""}{punchLabel(p)}</span>
                                <Badge>{CONTEXT[p.workContext]}</Badge>
                                {p.source === "MANUAL" && <Badge tone="warning">Manual entry</Badge>}
                                {p.lat != null && p.lng != null ? (
                                  <a
                                    href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-brand underline-offset-2 hover:underline"
                                  >
                                    View location{p.accuracy != null ? ` (±${Math.round(p.accuracy)} m)` : ""}
                                  </a>
                                ) : p.gpsStatus === "NOT_CAPTURED" ? null : (
                                  <Badge tone="danger">{p.gpsStatus === "DENIED" ? "Location denied" : "No location"}</Badge>
                                )}
                                {p.gpsStatus === "LOW_ACCURACY" && <Badge tone="warning">Low accuracy</Badge>}
                              </div>
                              {p.tripFrom && <p className="mt-1">📍 <span className="font-medium">{p.tripFrom} → {p.tripTo}</span> <span className="text-muted">· {p.tripReason}</span></p>}
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
