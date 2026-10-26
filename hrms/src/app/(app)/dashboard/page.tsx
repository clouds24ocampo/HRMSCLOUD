import { Icon, ICON_INLINE } from "@/components/Icon";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { getClockInfo } from "@/lib/clock";
import { ROLES } from "@/lib/roles";
import { dayKey, dbDate, formatDay, formatDuration, formatTime, formatTimePrecise, keyOfDbDate, zonedTimeToUtc, addDays } from "@/lib/time";
import { Alert } from "@/components/Fields";
import { Badge, Card, Stat } from "@/components/ui";
import { Bars, Meter } from "@/components/Charts";
import { hasRegular } from "@/lib/schedule";
import { loadSchedules, resolvePerson } from "@/lib/schedule-data";
import { loadDtr } from "@/lib/dtr-data";
import type { DtrDay } from "@/lib/dtr";
import { buildAttendance, regularMinutesOf } from "@/lib/payroll";
import { cutoffFor } from "@/lib/cutoffs";
import { formatMoney, formatRate } from "@/lib/money";
import { rates } from "@/lib/ph/calc";
import { load201 } from "@/lib/documents";
import { missing201 } from "@/lib/file201";
import { overtimeQueue } from "@/lib/overtime";
import { autoPayroll } from "@/lib/payroll-auto";
import { governmentEstimates } from "@/lib/statutory-estimate";
import { punchLabel } from "@/lib/punch";
import { summarize, VERDICT, type Summary } from "@/lib/adherence";
import { projectCutoffGross, remainingPlannedMinutes } from "@/lib/dashboard-insights";
import { StatutoryToggle } from "@/app/(app)/payroll/StatutoryToggle";
import { AttendanceBoard } from "@/components/AttendanceBoard";
import { statusTag } from "@/components/LiveStatus";
import { LivePersonnelReport, type PersonnelLiveItem } from "@/components/LivePersonnelReport";
import { loadAttendanceBoard, loadTeamDtr, type BoardRow } from "@/lib/team-dtr";
import { AcceptIncentiveForm } from "@/app/(app)/incentives/IncentiveForms";

const label = (action: string) => {
  const s = action.replace(/[._]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const pctText = (n: number | null) => (n === null ? "—" : `${n}%`);
const toneOf = (a: number | null) => (a === null ? "neutral" : a >= 95 ? "success" : a >= 85 ? "warning" : "danger");
const short = { month: "short", day: "numeric" } as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const me = await requireUser("/dashboard");
  const { denied } = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const emp = await getMyEmployee(me, tz);
  const today = dayKey(new Date(), tz);
  const dayStart = zonedTimeToUtc(today, 0, tz);
  const dayEnd = zonedTimeToUtc(addDays(today, 1), 0, tz);
  const hr = isHr(me.role.key);
  const approver = hr || me.role.key === ROLES.MANAGER;
  const cut = cutoffFor(today);

  if (hr) {
    // Same automatic cut-offs and hourly refresh as the Payroll page, so Home never shows stale pay.
    try {
      await autoPayroll(me, today);
    } catch (e) {
      console.error("[dashboard] automatic payroll failed", e);
    }
  }

  const [myTasks, news, clock, myShift, myReport, comp, myDtr, pendingIncentives] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { employeeId: emp.id, organizationId: me.organizationId, kind: "ONBOARDING", owner: "EMPLOYEE", doneAt: null },
      select: { id: true, title: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.announcement.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 3 }),
    getClockInfo(me.organizationId, emp.id, tz),
    prisma.scheduleEntry.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date: dbDate(today) } },
      select: { shift: { select: { name: true, startTime: true, endTime: true } } },
    }),
    prisma.dailyReport.findFirst({ where: { organizationId: me.organizationId, employeeId: emp.id, date: dbDate(today) }, select: { id: true } }),
    prisma.compensation.findFirst({ where: { employeeId: emp.id, organizationId: me.organizationId, effectiveFrom: { lte: dbDate(today) } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] }),
    loadDtr(me, emp.id, emp.id, cut.start, today, tz, settings.graceMinutes),
    prisma.incentive.findMany({
      where: { organizationId: me.organizationId, employeeId: emp.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const awarderUserIds = Array.from(new Set(pendingIncentives.map((i) => i.awardedById)));
  const awarderUsers = awarderUserIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: awarderUserIds } }, select: { id: true, name: true } }) : [];
  const awarderMap = new Map(awarderUsers.map((u) => [u.id, u.name]));

  // My cut-off so far: logged hours (a day counts up to the normal hours), and what they come to.
  const approvedOt = await prisma.overtimeRequest.findMany({ where: { organizationId: me.organizationId, employeeId: emp.id, status: "APPROVED", date: { gte: dbDate(cut.start), lte: dbDate(today) } }, select: { date: true, minutes: true } });
  const att = myDtr ? buildAttendance(myDtr.rows, new Set(), new Set(), new Map(approvedOt.map((o) => [keyOfDbDate(o.date), o.minutes])), settings.hoursPerDay * 60) : null;
  const myMinutes = att ? regularMinutesOf(att) : 0;
  const myRates = comp ? rates(comp.payType, comp.rateCents, settings.daysPerYear, settings.hoursPerDay) : null;
  const myEarned = myRates ? Math.round((myRates.hourly * myMinutes) / 60) : null;

  let stats: { overtime: number; requests: number; headcount: number; unscheduled: number; scheduled: number; clockedIn: number; onLeave: number; pending: number; flags: number; reports: number } | null = null;
  let feed: { at: Date; who: string; what: string; href?: string }[] = [];
  let board: BoardRow[] = [];
  let boardNames = new Map<string, { name: string; dept: string | null }>();
  let team: { total: Summary; daily: { label: string; late: number; absent: number }[]; attention: { id: string; s: Summary }[] } | null = null;
  const liveScope = approver
    ? await employeeScope(me, emp.id)
    : emp.departmentId
    ? { organizationId: me.organizationId, departmentId: emp.departmentId }
    : { organizationId: me.organizationId };

  const livePeople = await prisma.employee.findMany({
    where: { ...liveScope, status: { not: "SEPARATED" } },
    select: {
      id: true,
      userId: true,
      flexible: true,
      firstName: true,
      lastName: true,
      employeeNo: true,
      department: { select: { name: true } },
      position: { select: { title: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
  });
  const ids = livePeople.map((p) => p.id);

  // One DTR load for the cut-off feeds the attendance board, live status, and manager adherence.
  const cutDtr = await loadTeamDtr(me.organizationId, ids, cut.start, today, tz, settings.graceMinutes);
  board = await loadAttendanceBoard(me.organizationId, ids, cut.start, today, tz, settings.graceMinutes, cutDtr);
  boardNames = new Map(livePeople.map((p) => [p.id, { name: `${p.firstName} ${p.lastName}`, dept: p.department?.name ?? null }]));

  if (approver) {
    const allRows = ids.flatMap((id) => cutDtr.get(id) ?? []);
    const days = Array.from(new Set(allRows.map((r) => r.day))).sort();
    team = {
      total: summarize(allRows, today),
      daily: days.map((d) => {
        const rows = allRows.filter((r) => r.day === d);
        return { label: formatDay(d, short), late: rows.reduce((n, r) => n + r.lateMinutes, 0), absent: rows.filter((r) => r.status === "ABSENT").length };
      }),
      attention: ids
        .map((id) => ({ id, s: summarize(cutDtr.get(id) ?? [], today) }))
        .filter((x) => x.s.lateDays > 0 || x.s.absent > 0 || (x.s.adherencePct !== null && x.s.adherencePct < 95))
        .sort((a, b) => (a.s.adherencePct ?? 101) - (b.s.adherencePct ?? 101) || b.s.lateMinutes - a.s.lateMinutes)
        .slice(0, 8),
    };
    const others = ids.filter((i) => i !== emp.id || me.role.key === ROLES.SUPER_ADMIN);
    const [sched, ins, onLeave, pending, otQueue, requests, reports, audits, punches] = await Promise.all([
      loadSchedules(me.organizationId, ids, today, today),
      prisma.timeEvent.findMany({
        where: { organizationId: me.organizationId, employeeId: { in: ids }, type: "IN", voidedAt: null, at: { gte: dayStart, lt: dayEnd } },
        select: { employeeId: true, gpsStatus: true },
      }),
      prisma.leaveRequest.count({ where: { organizationId: me.organizationId, employeeId: { in: ids }, status: "APPROVED", startDate: { lte: dbDate(today) }, endDate: { gte: dbDate(today) } } }),
      prisma.leaveRequest.count({ where: { organizationId: me.organizationId, employeeId: { in: others }, status: "PENDING" } }),
      overtimeQueue(me, emp.id),
      hr ? prisma.hrRequest.count({ where: { organizationId: me.organizationId, status: { not: "RESOLVED" }, employeeId: { not: emp.id } } }) : 0,
      prisma.dailyReport.findMany({ where: { organizationId: me.organizationId, date: dbDate(today), employeeId: { in: ids.filter((i) => i !== emp.id) } }, distinct: ["employeeId"], select: { employeeId: true } }).then((r) => r.length),
      // Activity: everything the people in my reach did (HR: the whole organization).
      prisma.auditLog.findMany({
        where: { organizationId: me.organizationId, ...(hr ? {} : { actorId: { in: livePeople.map((p) => p.userId).filter((u): u is string => !!u) } }) },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.timeEvent.findMany({
        where: { organizationId: me.organizationId, employeeId: { in: ids }, voidedAt: null, at: { gte: dayStart, lt: dayEnd } },
        include: { stampType: { select: { name: true, kind: true } }, employee: { select: { firstName: true, lastName: true } } },
        orderBy: { at: "desc" },
        take: 20,
      }),
    ]);
    const scheduled = ids.filter((id) => resolvePerson(sched.get(id), [today]).get(today)?.shift).length;
    const flexible = new Set(livePeople.filter((p) => p.flexible).map((p) => p.id));
    const unscheduled = ids.filter((id) => !flexible.has(id) && !hasRegular(sched.get(id)?.regulars ?? [], today) && !sched.get(id)?.overrides.has(today)).length;
    stats = {
      overtime: otQueue.length, requests, headcount: ids.length, unscheduled, scheduled, onLeave, pending, reports,
      clockedIn: new Set(ins.map((i) => i.employeeId)).size,
      flags: ins.filter((i) => i.gpsStatus === "DENIED" || i.gpsStatus === "UNAVAILABLE" || i.gpsStatus === "LOW_ACCURACY").length,
    };
    const actors = await prisma.user.findMany({ where: { id: { in: audits.map((a) => a.actorId).filter((u): u is string => !!u) } }, select: { id: true, name: true } });
    const nameOf = new Map(actors.map((u) => [u.id, u.name]));
    feed = [
      ...audits.map((a) => ({ at: a.createdAt, who: (a.actorId && nameOf.get(a.actorId)) || "System", what: label(a.action) })),
      ...punches.map((p) => ({ at: p.at, who: `${p.employee.firstName} ${p.employee.lastName}`, what: punchLabel(p), href: `/dtr?employee=${p.employeeId}&from=${today}&to=${today}` })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 20);
  }

  const now = new Date();
  const personnelLiveItems: PersonnelLiveItem[] = livePeople.map((p) => {
    const row = board.find((b) => b.id === p.id);
    const tag = statusTag(row?.live, !!p.flexible, row?.today?.lateMinutes ?? 0, tz, now);

    const isIssue = row?.live?.pause?.page === "ISSUE";
    const isBreak = row?.live?.state === "ON_BREAK" && !isIssue;
    const isWorking = row?.live?.state === "WORKING";
    const isLate = (row?.today?.lateMinutes ?? 0) > 0 || row?.live?.state === "LATE";
    const isOnLeave = row?.live?.state === "ON_LEAVE";
    const isTimedOut = row?.live?.state === "DONE";

    const shiftStr = row?.today?.shift
      ? `${row.today.shift.startTime}–${row.today.shift.endTime}`
      : p.flexible
      ? "Flexible (min 8h)"
      : row?.today?.status === "DAY_OFF"
      ? "Day off"
      : "—";

    const locPlace = row?.firstIn ?? row?.lastOut;
    const location =
      locPlace && locPlace.lat != null && locPlace.lng != null
        ? {
            lat: locPlace.lat,
            lng: locPlace.lng,
            accuracy: locPlace.accuracy,
            device: locPlace.device,
            locSource: locPlace.locSource,
            weak: locPlace.gpsStatus !== "OK",
          }
        : null;

    const events = (row?.live?.today ?? []).map((e) => ({
      id: e.id,
      atTime: formatTimePrecise(e.at, tz),
      type: e.type,
      name: e.name,
      icon: e.icon,
      page: e.page,
      source: e.source,
      note: e.note,
      lat: e.lat,
      lng: e.lng,
      accuracy: e.accuracy,
      device: e.device,
    }));

    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      firstName: p.firstName,
      lastName: p.lastName,
      employeeNo: p.employeeNo,
      department: p.department?.name ?? null,
      position: p.position?.title ?? null,
      statusGroup: tag.group,
      statusLabel: tag.label,
      statusIcon: tag.icon,
      statusTone: tag.tone,
      statusDetail: tag.detail,
      isWorking,
      isIssue,
      isBreak,
      isLate,
      isOnLeave,
      isTimedOut,
      shift: shiftStr,
      firstInTime: row?.firstIn?.at ? formatTimePrecise(row.firstIn.at, tz) : null,
      firstInIso: row?.firstIn?.at ? row.firstIn.at.toISOString() : null,
      lastOutTime: row?.lastOut?.at ? formatTimePrecise(row.lastOut.at, tz) : null,
      workedMinutes: row?.today?.workedMinutes ?? 0,
      liveWork: row?.today?.liveWork ?? null,
      pause: row?.live?.pause
        ? {
            name: row.live.pause.name,
            icon: row.live.pause.icon,
            isIssue: row.live.pause.page === "ISSUE",
            sinceIso: row.live.pause.since.toISOString(),
            sinceTime: formatTimePrecise(row.live.pause.since, tz),
            overMinutes: row.live.pause.overMinutes,
          }
        : undefined,
      location,
      events,
    };
  });

  // HR: payroll as it stands right now, where it is heading, government contributions, and 201 file completeness.
  const hrData = hr
    ? await (async () => {
        const [period, gov, active] = await Promise.all([
          prisma.payrollPeriod.findFirst({
            where: { organizationId: me.organizationId, kind: "REGULAR", startDate: { lte: dbDate(today) }, endDate: { gte: dbDate(today) } },
            include: { payslips: { select: { grossCents: true, netCents: true, deductionsCents: true, employerCostCents: true } } },
          }),
          governmentEstimates(me.organizationId, today, settings.daysPerYear, settings.hoursPerDay),
          prisma.employee.findMany({ where: { organizationId: me.organizationId, status: { in: ["ACTIVE", "ON_LEAVE"] } }, select: { id: true } }),
        ]);
        const activeIds = active.map((a) => a.id);
        const [files, aheadDtr, comps] = await Promise.all([
          load201(me.organizationId, activeIds),
          // Planned shifts still ahead in this cut-off (tomorrow to the last day).
          today < cut.end ? loadTeamDtr(me.organizationId, activeIds, addDays(today, 1), cut.end, tz, settings.graceMinutes) : Promise.resolve(new Map<string, DtrDay[]>()),
          prisma.compensation.findMany({
            where: { organizationId: me.organizationId, employeeId: { in: activeIds }, effectiveFrom: { lte: dbDate(today) } },
            orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
            select: { employeeId: true, payType: true, rateCents: true },
          }),
        ]);
        const incomplete = active.filter((a) => missing201(files.get(a.id)?.keys() ?? []).length > 0).length;
        const sum = period?.payslips.reduce((t, s) => ({ gross: t.gross + s.grossCents, net: t.net + s.netCents, ded: t.ded + s.deductionsCents, er: t.er + s.employerCostCents }), { gross: 0, net: 0, ded: 0, er: 0 });
        const hourly = new Map<string, number>();
        for (const c of comps) if (!hourly.has(c.employeeId)) hourly.set(c.employeeId, rates(c.payType, c.rateCents, settings.daysPerYear, settings.hoursPerDay).hourly);
        const remaining = new Map(activeIds.map((id) => [id, remainingPlannedMinutes(aheadDtr.get(id) ?? [], today, settings.hoursPerDay * 60)]));
        const shiftsAhead = activeIds.reduce((n, id) => n + (aheadDtr.get(id) ?? []).filter((r) => r.shift && r.status !== "LEAVE").length, 0);
        const projection = projectCutoffGross(sum?.gross ?? 0, remaining, hourly);
        return { period, sum, gov, incomplete, active: active.length, projection, shiftsAhead };
      })()
    : null;

  const clockText = clock.state === "OUT" ? "You are timed out." : clock.state === "ON_PAUSE" ? `On ${clock.pause?.name.toLowerCase()} since ${formatTime(new Date(clock.pause!.since), tz)}.` : "You are timed in.";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hello, {me.name.split(" ")[0]}</h1>
          <p className="mt-1 text-muted">
            {formatDay(today, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
            {emp.flexible ? "flexible schedule, at least 8 hours" : myShift ? (myShift.shift ? `your shift is ${myShift.shift.startTime}–${myShift.shift.endTime}` : "today is your day off") : "no shift planned for you today"}
          </p>
        </div>
        <Link href="/dtr" className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:border-brand hover:text-brand">
          <Icon name="dtr" className={ICON_INLINE} /> {clockText} <span className="text-brand">Open DTR</span>
        </Link>
      </div>

      {denied && <Alert kind="error">You do not have permission to open that page.</Alert>}

      {/* PENDING INCENTIVES RECOGNITION BANNER */}
      {pendingIncentives.length > 0 && (
        <section aria-label="Incentives awaiting your acceptance" className="rounded-2xl border-2 border-emerald-500/40 bg-linear-to-r from-emerald-500/10 via-teal-500/10 to-transparent p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Icon name="incentive" className={ICON_INLINE} /> INCENTIVE RECOGNITION
              </div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-ink">
                You have {pendingIncentives.length} incentive award{pendingIncentives.length > 1 ? "s" : ""} awaiting your acceptance!
              </h2>
              <p className="mt-1 text-sm text-muted">
                Accept below to confirm receipt and credit this to your next semi-monthly payslip. All acceptances are recorded with an audit trail.
              </p>
            </div>
            <Link href="/incentives" className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:border-brand hover:text-brand">
              View All Incentives →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {pendingIncentives.map((inc) => (
              <div key={inc.id} className="flex flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-sm">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-ink">{inc.title}</h3>
                    <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatMoney(inc.amountCents)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted line-clamp-3 whitespace-pre-wrap">{inc.reason}</p>
                  <p className="mt-2 text-[11px] text-muted">
                    Awarded by: {awarderMap.get(inc.awardedById) ?? "Management"} · {formatDay(keyOfDbDate(inc.createdAt))}
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-line">
                  <AcceptIncentiveForm incentiveId={inc.id} title={inc.title} amount={formatMoney(inc.amountCents)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LIVE PERSONNEL REPORT: BIG AND SEE IT FIRST */}
      {personnelLiveItems.length > 0 && (
        <LivePersonnelReport items={personnelLiveItems} tz={tz} isApprover={approver} />
      )}

      {myTasks.length > 0 && (
        <section aria-label="Your onboarding tasks" className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <h2 className="font-semibold">Welcome. {myTasks.length} thing{myTasks.length === 1 ? "" : "s"} for you to finish</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">{myTasks.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
          <Link href={`/employees/${emp.id}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">Open my checklist</Link>
        </section>
      )}

      {news.length > 0 && (
        <section aria-label="Announcements" className="space-y-2">
          {news.map((a) => (
            <article key={a.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <p className="font-semibold">{a.pinned && <span aria-label="pinned"><Icon name="pin" className={ICON_INLINE} /> </span>}{a.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>
            </article>
          ))}
        </section>
      )}

      <section aria-label="My cut-off" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Hours logged · ${cut.name}`} value={formatDuration(myMinutes) || "0m"} hint={`Pay day ${formatDay(cut.payDate, { month: "short", day: "numeric" })}`} tone="brand" />
        <Stat label="Earned so far (basic)" value={myEarned === null ? "—" : formatMoney(myEarned)} hint={myRates ? `${formatRate(myRates.hourly)} an hour` : "No pay rate yet"} />
        <Stat label="Days worked" value={att?.presentDays ?? 0} hint={att && att.incompleteDays ? `${att.incompleteDays} without time out` : undefined} tone="warning" />
        <Stat label="Today's daily report" value={myReport ? "Sent" : "Not yet"} tone={myReport ? "success" : "warning"} hint={myReport ? "Thank you" : "Write it before you leave"} />
      </section>

      {stats && (
        <section aria-label="Today at a glance">
          <h2 className="mb-3 text-lg font-semibold">{hr ? "Today across the organization" : "Today with your team"}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="People" value={stats.headcount} tone={stats.unscheduled ? "warning" : undefined} hint={stats.unscheduled ? `${stats.unscheduled} without a schedule` : undefined} />
            <Stat label="Scheduled today" value={stats.scheduled} />
            <Stat label="Clocked in" value={stats.clockedIn} tone={stats.clockedIn >= stats.scheduled && stats.scheduled > 0 ? "success" : undefined} hint={stats.scheduled > stats.clockedIn ? `${stats.scheduled - stats.clockedIn} not yet` : undefined} />
            <Stat label="On leave" value={stats.onLeave} />
            <Stat label="Leave to decide" value={stats.pending} tone={stats.pending ? "warning" : "success"} hint={stats.pending ? "Waiting" : "All clear"} />
            <Stat label="Overtime to decide" value={stats.overtime} tone={stats.overtime ? "warning" : "success"} hint={stats.overtime ? "Waiting for you" : "All clear"} />
            <Stat label="Daily reports today" value={`${stats.reports} / ${Math.max(0, stats.headcount - 1)}`} tone={stats.reports >= stats.headcount - 1 ? "success" : "warning"} hint="Open daily reports" />
            {hr ? <Stat label="HR requests" value={stats.requests} tone={stats.requests ? "warning" : "success"} hint={stats.requests ? "Waiting" : "All clear"} /> : <Stat label="Location flags" value={stats.flags} tone={stats.flags ? "danger" : "success"} hint={stats.flags ? "Check DTR" : "None today"} />}
          </div>
        </section>
      )}

      {team && (
        <section aria-label="Schedule adherence this cut-off" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Schedule adherence · {cut.name}</h2>
              <p className="text-xs text-muted">
                {formatDay(cut.start, short)} – {formatDay(today, short)} · {team.total.scheduledDays} scheduled person-{team.total.scheduledDays === 1 ? "day" : "days"} measured. Today counts once it ends.
              </p>
            </div>
            <Badge tone={VERDICT[team.total.verdict].tone}>{VERDICT[team.total.verdict].label}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Schedule adherence" value={pctText(team.total.adherencePct)} tone={toneOf(team.total.adherencePct)} hint="Planned minutes actually kept" />
            <Stat label="On time" value={pctText(team.total.onTimePct)} tone={team.total.lateDays ? "warning" : "success"} hint={team.total.lateDays ? `${team.total.lateDays} late ${team.total.lateDays === 1 ? "day" : "days"} · ${formatDuration(team.total.lateMinutes)}` : "No late days"} />
            <Stat label="Attendance" value={pctText(team.total.attendancePct)} tone={team.total.absent ? "danger" : "success"} hint={team.total.absent ? `${team.total.absent} absent` : "No absences"} />
            <Stat label="Undertime · Overtime" value={<span className="text-2xl">{formatDuration(team.total.undertimeMinutes) || "0m"} · {formatDuration(team.total.overtimeMinutes) || "0m"}</span>} hint="Overtime here is unapproved time past shift end" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <h3 className="font-semibold">Late minutes by day</h3>
              <Bars data={team.daily.map((d) => ({ label: d.label, value: d.late }))} unit=" min" tone="warning" height={120} />
              <p className="mt-1 flex justify-between text-xs text-muted"><span>{team.daily[0]?.label}</span><span>{team.daily.at(-1)?.label}</span></p>
            </Card>
            <Card>
              <h3 className="font-semibold">Absences by day</h3>
              <Bars data={team.daily.map((d) => ({ label: d.label, value: d.absent }))} tone="danger" height={120} />
              <p className="mt-1 flex justify-between text-xs text-muted"><span>{team.daily[0]?.label}</span><span>{team.daily.at(-1)?.label}</span></p>
            </Card>
            <Card className="p-0">
              <h3 className="border-b border-line px-5 py-3 font-semibold">Needs attention</h3>
              {team.attention.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Everyone is on schedule this cut-off.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {team.attention.map(({ id, s }) => (
                    <li key={id} className="px-5 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{boardNames.get(id)?.name ?? "—"}</span>
                        <span className="tabular-nums text-xs text-muted">{pctText(s.adherencePct)}</span>
                      </div>
                      <Meter value={s.adherencePct} tone={VERDICT[s.verdict].tone} />
                      <p className="mt-0.5 text-xs text-muted tabular-nums">Late {s.lateDays}× · {formatDuration(s.lateMinutes) || "0m"} · Absent {s.absent}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>
      )}

      {approver && board.length > 0 && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Attendance today: who is in, out and late</h2>
              <p className="text-xs text-muted">Every time in and time out with where it was made. Late people first. Tardiness counts from {formatDay(cut.start, { month: "short", day: "numeric" })} (this cut-off).</p>
            </div>
            <span className="flex flex-wrap gap-2 text-sm">
              <Badge tone="danger">{board.filter((b) => b.today?.lateMinutes).length} late</Badge>
              <Badge tone="success">{board.filter((b) => b.firstIn).length} timed in</Badge>
              <Badge>{board.filter((b) => b.lastOut).length} timed out</Badge>
              <Link href="/schedule/live" className="font-semibold text-brand hover:underline">Live view</Link>
            </span>
          </div>
          <AttendanceBoard rows={board} names={boardNames} tz={tz} />
        </Card>
      )}

      {hrData && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Payroll · {cut.name}</h2>
              {hrData.period && <Link href={`/payroll/${hrData.period.id}`} className="text-sm font-semibold text-brand hover:underline">Open</Link>}
            </div>
            {hrData.period && hrData.sum ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Earned so far</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-muted">Gross</p><p className="text-lg font-bold tabular-nums">{formatMoney(hrData.sum.gross)}</p></div>
                  <div><p className="text-muted">Deductions</p><p className="text-lg font-bold tabular-nums">{formatMoney(hrData.sum.ded)}</p></div>
                  <div><p className="text-muted">Net to pay</p><p className="text-lg font-bold tabular-nums">{formatMoney(hrData.sum.net)}</p></div>
                </div>
                <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Projected by {formatDay(cut.end, short)} (gross)</p>
                  <p className="text-2xl font-bold tabular-nums">{formatMoney(hrData.projection.projected)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {hrData.projection.ahead > 0 ? `+${formatMoney(hrData.projection.ahead)} basic pay for ${hrData.shiftsAhead} planned ${hrData.shiftsAhead === 1 ? "shift" : "shifts"} still ahead, if worked as scheduled.` : "No planned shifts left in this cut-off."}{" "}
                    Employer contributions so far {formatMoney(hrData.sum.er)} · total cost so far {formatMoney(hrData.sum.gross + hrData.sum.er)}.
                  </p>
                </div>
                <p className="text-xs text-muted">
                  {hrData.period.payslips.length} payslips · pay day {formatDay(keyOfDbDate(hrData.period.payDate), short)} ·{" "}
                  {hrData.period.calculatedAt ? `${hrData.period.calculatedById ? "calculated" : "live, updated"} ${formatTime(hrData.period.calculatedAt, tz)}` : "not calculated yet"}. From logged hours and approved overtime only.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">No pay period for today yet.</p>
            )}
            <div className="border-t border-line pt-3">
              <p className="mb-1 text-sm font-medium">201 files</p>
              <p className="text-sm">{hrData.incomplete === 0 ? <Badge tone="success">All {hrData.active} complete</Badge> : <><Badge tone="warning">{hrData.incomplete} of {hrData.active} incomplete</Badge> <Link href="/documents" className="ml-1 font-medium text-brand hover:underline">Review</Link></>}</p>
            </div>
          </Card>

          <Card className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Government contributions · monthly</h2>
              <p className="text-xs text-muted">SSS (or GSIS), PhilHealth, Pag-IBIG and BIR withholding tax on each monthly salary{hrData.gov.starter ? ", using the built-in Philippine rates" : ""}. Optional for now.</p>
            </div>
            <StatutoryToggle on={settings.deductStatutory} />
            {hrData.gov.rows.length === 0 ? <p className="text-sm text-muted">No pay rates yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-136 text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr><th className="py-1.5 font-medium">Employee</th><th className="font-medium">Salary</th><th className="font-medium">SSS</th><th className="font-medium">PhilHealth</th><th className="font-medium">Pag-IBIG</th><th className="font-medium">Tax</th><th className="font-medium">Employee total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular-nums">
                    {hrData.gov.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="py-1.5"><Link href={`/employees/${r.id}`} className="font-medium hover:underline">{r.name}</Link></td>
                        <td>{formatMoney(r.monthlyCents)}</td>
                        <td title={`Employer ${formatMoney(r.social.er)}`}>{r.social.label === "GSIS" ? "GSIS " : ""}{formatMoney(r.social.ee)}</td>
                        <td title={`Employer ${formatMoney(r.philhealth.er)}`}>{formatMoney(r.philhealth.ee)}</td>
                        <td title={`Employer ${formatMoney(r.pagibig.er)}`}>{formatMoney(r.pagibig.ee)}</td>
                        <td>{formatMoney(r.taxCents)}</td>
                        <td className="font-semibold">{formatMoney(r.eeTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="text-xs text-muted">
                    <tr><td className="pt-2" colSpan={7}>Employees {formatMoney(hrData.gov.totals.ee)} a month (tax {formatMoney(hrData.gov.totals.tax)}) · employer share {formatMoney(hrData.gov.totals.er)} a month. Hover a figure for the employer share.</td></tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {approver && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{hr ? "Activity across the organization" : "Activity in your team"}</h2>
            {hr && <Link href="/audit" className="text-sm font-semibold text-brand hover:underline">Full audit log</Link>}
          </div>
          {feed.length === 0 ? <p className="text-sm text-muted">Nothing yet today.</p> : (
            <ul className="divide-y divide-line">
              {feed.map((f, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0"><span className="font-medium">{f.who}</span> · {f.href ? <Link href={f.href} className="hover:underline">{f.what}</Link> : f.what}</span>
                  <span className="text-xs text-muted tabular-nums">{dayKey(f.at, tz) === today ? formatTime(f.at, tz) : `${formatDay(dayKey(f.at, tz), { month: "short", day: "numeric" })} ${formatTime(f.at, tz)}`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
