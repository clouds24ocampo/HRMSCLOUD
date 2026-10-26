// DTR for many people at once (Live Personnel and Analytics). Same calculator as the DTR page, just batched queries.
import { prisma } from "@/lib/prisma";
import { buildDtr, clockStatus, type DtrDay, type ShiftTimes } from "@/lib/dtr";
import { STAMP_SELECT, toPunch } from "@/lib/punch";
import { loadSchedules, resolvePerson } from "@/lib/schedule-data";
import { addDays, daysBetween, dayKey, dbDate, keyOfDbDate, zonedTimeToUtc } from "@/lib/time";
import { liveState, type LiveState } from "@/lib/live";
import { FLEX_MIN_MINUTES } from "@/lib/dtr-data";

export async function loadTeamDtr(organizationId: string, ids: string[], from: string, to: string, tz: string, graceMinutes: number): Promise<Map<string, DtrDay[]>> {
  const days = daysBetween(from, to).slice(0, 62);
  const last = days[days.length - 1];
  const [events, schedules, leave, flex] = await Promise.all([
    prisma.timeEvent.findMany({
      where: { organizationId, employeeId: { in: ids }, voidedAt: null, at: { gte: zonedTimeToUtc(addDays(from, -1), 0, tz), lt: zonedTimeToUtc(addDays(last, 2), 0, tz) } },
      include: { stampType: { select: STAMP_SELECT } },
      orderBy: { at: "asc" },
    }),
    loadSchedules(organizationId, ids, from, last),
    prisma.leaveRequest.findMany({
      where: { organizationId, employeeId: { in: ids }, status: "APPROVED", startDate: { lte: dbDate(last) }, endDate: { gte: dbDate(from) } },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
    prisma.employee.findMany({ where: { organizationId, id: { in: ids }, flexible: true }, select: { id: true } }),
  ]);
  const flexible = new Set(flex.map((f) => f.id));
  const byEmp = new Map<string, typeof events>();
  for (const e of events) byEmp.set(e.employeeId, [...(byEmp.get(e.employeeId) ?? []), e]);
  const leaveBy = new Map<string, Set<string>>();
  for (const l of leave) {
    const set = leaveBy.get(l.employeeId) ?? new Set<string>();
    daysBetween(keyOfDbDate(l.startDate), keyOfDbDate(l.endDate)).forEach((d) => set.add(d));
    leaveBy.set(l.employeeId, set);
  }
  const today = dayKey(new Date(), tz);
  return new Map(ids.map((id) => {
    const resolved = resolvePerson(schedules.get(id), days);
    const schedule = new Map<string, ShiftTimes | null>([...resolved].map(([d, r]) => [d, r.shift]));
    return [id, buildDtr({ days, punches: (byEmp.get(id) ?? []).map(toPunch), schedule, leaveDays: leaveBy.get(id) ?? new Set(), today, tz, graceMinutes, flexMinutes: flexible.has(id) ? FLEX_MIN_MINUTES : undefined })];
  }));
}

// pause: what they are on right now (Break, Meal, Heavy Rain / Flood…), with its icon and since when. ISSUE = from the Issues page.
// systemOut: the day was closed by the automatic time-out, not by the person.
export type LiveRow = {
  id: string; state: LiveState; detail?: string; shift: ShiftTimes | null | undefined; firstIn: Date | null;
  pause?: { name: string; icon: string; page: "PUNCH" | "ISSUE"; since: Date; overMinutes: number }; lastOut: Date | null; systemOut: boolean;
  today: LiveEvent[]; // every time stamp of the current work day, oldest first
};
export type LiveEvent = {
  id: string; at: Date; type: "IN" | "OUT" | "PAUSE_START" | "PAUSE_END"; name: string; icon: string; page: "PUNCH" | "ISSUE" | null;
  source: string; note: string | null; lat: number | null; lng: number | null; accuracy: number | null; gpsStatus: string; locSource: string | null; device: string | null;
};

// Right now: state of each person from today's plan and their recent punches.
export async function loadLive(organizationId: string, ids: string[], tz: string, graceMinutes: number): Promise<Map<string, LiveRow>> {
  const now = new Date();
  const day = dayKey(now, tz);
  const [events, schedules, leave] = await Promise.all([
    prisma.timeEvent.findMany({
      where: { organizationId, employeeId: { in: ids }, voidedAt: null, at: { gte: new Date(now.getTime() - 36 * 3600_000) } },
      include: { stampType: { select: STAMP_SELECT } },
      orderBy: { at: "asc" },
    }),
    loadSchedules(organizationId, ids, day, day),
    prisma.leaveRequest.findMany({ where: { organizationId, employeeId: { in: ids }, status: "APPROVED", startDate: { lte: dbDate(day) }, endDate: { gte: dbDate(day) } }, select: { employeeId: true } }),
  ]);
  const onLeave = new Set(leave.map((l) => l.employeeId));
  const byEmp = new Map<string, typeof events>();
  for (const e of events) byEmp.set(e.employeeId, [...(byEmp.get(e.employeeId) ?? []), e]);
  return new Map(ids.map((id) => {
    const evs = byEmp.get(id) ?? [];
    const todays = evs.filter((e) => dayKey(e.at, tz) === day && e.type === "IN");
    const clock = clockStatus(evs.map(toPunch));
    const shift = resolvePerson(schedules.get(id), [day]).get(day)?.shift;
    const r = liveState({ now, day, tz, shift, onLeave: onLeave.has(id), clock, timedInToday: todays.length > 0, graceMinutes });
    const out = [...evs].reverse().find((e) => e.type === "OUT" && dayKey(e.at, tz) === day);
    let pause: LiveRow["pause"];
    if (clock.pause) {
      const st = evs.find((e) => e.stampTypeId === clock.pause!.typeId)?.stampType;
      const mins = Math.floor((now.getTime() - clock.pause.since.getTime()) / 60000);
      pause = { name: clock.pause.name, icon: st?.icon ?? "pause", page: st?.page ?? "PUNCH", since: clock.pause.since, overMinutes: st?.allowedMinutes != null ? Math.max(0, mins - st.allowedMinutes) : 0 };
    }
    // The work day shown: from the latest Time In (an overnight shift keeps its start), else today's calendar day.
    const lastIn = [...evs].reverse().find((e) => e.type === "IN");
    const from = lastIn && (dayKey(lastIn.at, tz) === day || clock.state !== "OUT") ? lastIn.at : null;
    const today: LiveEvent[] = evs
      .filter((e) => (from ? e.at >= from : dayKey(e.at, tz) === day))
      .map((e) => ({
        id: e.id, at: e.at, type: e.type, name: e.stampType?.name ?? (e.type === "IN" ? "Time In" : e.type === "OUT" ? "Time Out" : "Break"), icon: e.stampType?.icon ?? "clock",
        page: e.stampType?.page ?? null, source: e.source, note: e.note, lat: e.lat, lng: e.lng, accuracy: e.accuracy, gpsStatus: e.gpsStatus, locSource: e.locSource, device: e.device,
      }));
    return [id, { id, ...r, shift, firstIn: todays[0]?.at ?? null, pause, lastOut: r.state === "DONE" ? out?.at ?? null : null, systemOut: r.state === "DONE" && out?.source === "SYSTEM", today }];
  }));
}

// Where a stamp was made, as stored on the time event.
export type StampPlace = { at: Date; lat: number | null; lng: number | null; accuracy: number | null; gpsStatus: string; locSource: string | null; device: string | null; ipAddress: string | null };

export type BoardRow = {
  id: string; today: DtrDay | undefined; firstIn: StampPlace | null; lastOut: StampPlace | null; live: LiveRow | undefined;
  lateDays: number; lateMinutes: number; absentDays: number; // this cut-off so far
};

// Home's attendance board: today's time in and out with where they were made, plus tardiness for the cut-off so far.
// Pass `preloaded` (the same people, from..today) when the caller already has it, to avoid loading the cut-off twice.
export async function loadAttendanceBoard(organizationId: string, ids: string[], from: string, today: string, tz: string, graceMinutes: number, preloaded?: Map<string, DtrDay[]>): Promise<BoardRow[]> {
  const [dtr, stamps, live] = await Promise.all([
    preloaded ?? loadTeamDtr(organizationId, ids, from, today, tz, graceMinutes),
    prisma.timeEvent.findMany({
      where: { organizationId, employeeId: { in: ids }, voidedAt: null, type: { in: ["IN", "OUT"] }, at: { gte: zonedTimeToUtc(today, 0, tz), lt: zonedTimeToUtc(addDays(today, 1), 0, tz) } },
      select: { employeeId: true, type: true, at: true, lat: true, lng: true, accuracy: true, gpsStatus: true, locSource: true, device: true, ipAddress: true },
      orderBy: { at: "asc" },
    }),
    loadLive(organizationId, ids, tz, graceMinutes),
  ]);
  return ids.map((id) => {
    const rows = dtr.get(id) ?? [];
    const mine = stamps.filter((s) => s.employeeId === id);
    return {
      id,
      today: rows.find((r) => r.day === today),
      live: live.get(id),
      firstIn: mine.find((s) => s.type === "IN") ?? null,
      lastOut: [...mine].reverse().find((s) => s.type === "OUT") ?? null,
      lateDays: rows.filter((r) => r.lateMinutes > 0).length,
      lateMinutes: rows.reduce((n, r) => n + r.lateMinutes, 0),
      absentDays: rows.filter((r) => r.status === "ABSENT").length,
    };
  });
}
