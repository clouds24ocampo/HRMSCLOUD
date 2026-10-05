// The one DTR calculator. Raw punches go in, a day-by-day record comes out.
// Every organization and industry uses this same function; only the inputs (schedule, grace, stamp types) differ.
import { addDays, dayKey, parseHM, zonedTimeToUtc } from "@/lib/time";

// What a pause punch knew about its time stamp type. Missing = a plain unpaid break.
export type StampInfo = { id: string; name: string; paid: boolean; allowedMinutes: number | null };
export type Punch = { type: "IN" | "OUT" | "PAUSE_START" | "PAUSE_END"; at: Date; stamp?: StampInfo | null };
export type ShiftTimes = { startTime: string; endTime: string; breakMinutes: number };

export type Pause = { startAt: Date; endAt: Date | null; name: string; typeId: string | null; paid: boolean; allowedMinutes: number | null };
export type Session = { inAt: Date; outAt: Date | null; pauses: Pause[] };

export type DtrStatus = "PRESENT" | "INCOMPLETE" | "ABSENT" | "LEAVE" | "DAY_OFF" | "NO_SCHEDULE";
export type PauseSummary = { name: string; count: number; minutes: number; paid: boolean; overMinutes: number };

export type DtrDay = {
  day: string;
  status: DtrStatus;
  firstIn: Date | null;
  lastOut: Date | null;
  workedMinutes: number;
  breakMinutes: number; // unpaid pause time (already taken out of worked time)
  pauses: PauseSummary[];
  overLimitMinutes: number; // total time beyond each pause's allowed length
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number; // candidate only: not approved overtime
  shift: ShiftTimes | null;
};

const mins = (ms: number) => Math.max(0, Math.floor(ms / 60000));
const DEFAULT_PAUSE = { name: "Break", typeId: null, paid: false, allowedMinutes: null } as const;

// Pair punches into sessions. A session belongs to the day it started, so overnight shifts stay on one row.
export function toSessions(punches: Punch[]): Session[] {
  const sorted = [...punches].sort((a, b) => a.at.getTime() - b.at.getTime());
  const out: Session[] = [];
  let cur: Session | null = null;
  for (const p of sorted) {
    if (p.type === "IN" && !cur) cur = { inAt: p.at, outAt: null, pauses: [] };
    else if (p.type === "PAUSE_START" && cur && !openPause(cur)) {
      const s = p.stamp;
      cur.pauses.push({ startAt: p.at, endAt: null, ...(s ? { name: s.name, typeId: s.id, paid: s.paid, allowedMinutes: s.allowedMinutes } : DEFAULT_PAUSE) });
    } else if (p.type === "PAUSE_END" && cur) {
      const open = openPause(cur);
      if (open) open.endAt = p.at;
    } else if (p.type === "OUT" && cur) {
      const open = openPause(cur);
      if (open) open.endAt = p.at; // clocking out ends a pause that was left open
      cur.outAt = p.at;
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const openPause = (s: Session) => s.pauses.find((x) => !x.endAt);
const pauseMs = (p: Pause) => (p.endAt ? p.endAt.getTime() - p.startAt.getTime() : 0);

export function shiftInstants(day: string, shift: ShiftTimes, tz: string) {
  const s = parseHM(shift.startTime) ?? 0;
  const e = parseHM(shift.endTime) ?? 0;
  return { start: zonedTimeToUtc(day, s, tz), end: zonedTimeToUtc(day, e <= s ? e + 1440 : e, tz) };
}

export function buildDtr(input: {
  days: string[];
  punches: Punch[];
  schedule: Map<string, ShiftTimes | null>; // day -> shift, null = day off, missing = nothing scheduled
  leaveDays: Set<string>;
  today: string;
  tz: string;
  graceMinutes: number;
}): DtrDay[] {
  const { days, schedule, leaveDays, today, tz, graceMinutes } = input;
  const byDay = new Map<string, Session[]>();
  for (const s of toSessions(input.punches)) {
    const k = dayKey(s.inAt, tz);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }

  return days.map((day): DtrDay => {
    const sessions = byDay.get(day) ?? [];
    const shift = schedule.get(day) ?? null;
    const base = { day, shift, firstIn: null, lastOut: null, workedMinutes: 0, breakMinutes: 0, pauses: [], overLimitMinutes: 0, lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0 };

    if (!sessions.length) {
      const status: DtrStatus = leaveDays.has(day)
        ? "LEAVE"
        : !schedule.has(day)
          ? "NO_SCHEDULE"
          : shift === null
            ? "DAY_OFF"
            : day < today
              ? "ABSENT"
              : "NO_SCHEDULE";
      return { ...base, status };
    }

    const firstIn = sessions[0].inAt;
    const open = sessions.some((s) => !s.outAt);
    const lastOut = open ? null : sessions[sessions.length - 1].outAt;
    const allPauses = sessions.flatMap((s) => s.pauses);
    const unpaidMs = allPauses.filter((p) => !p.paid).reduce((n, p) => n + pauseMs(p), 0);
    const worked = sessions.reduce((n, s) => n + (s.outAt ? s.outAt.getTime() - s.inAt.getTime() : 0), 0) - unpaidMs;

    const summary = new Map<string, PauseSummary>();
    let overLimit = 0;
    for (const p of allPauses) {
      const m = mins(pauseMs(p));
      const over = p.allowedMinutes != null && m > p.allowedMinutes ? m - p.allowedMinutes : 0;
      overLimit += over;
      const row = summary.get(p.name) ?? { name: p.name, count: 0, minutes: 0, paid: p.paid, overMinutes: 0 };
      row.count += 1;
      row.minutes += m;
      row.overMinutes += over;
      summary.set(p.name, row);
    }

    let late = 0, under = 0, over = 0;
    if (shift) {
      const { start, end } = shiftInstants(day, shift, tz);
      const lateBy = mins(firstIn.getTime() - start.getTime());
      late = lateBy > graceMinutes ? lateBy : 0;
      if (lastOut) {
        under = mins(end.getTime() - lastOut.getTime());
        over = mins(lastOut.getTime() - end.getTime());
      }
    }
    return {
      ...base, status: open ? "INCOMPLETE" : "PRESENT", firstIn, lastOut,
      workedMinutes: mins(worked), breakMinutes: mins(unpaidMs), pauses: [...summary.values()], overLimitMinutes: overLimit,
      lateMinutes: late, undertimeMinutes: under, overtimeMinutes: over,
    };
  });
}

// What the clock should offer next, from recent non-voided punches.
export type ClockStatus = { state: "OUT" | "IN" | "ON_PAUSE"; pause?: { typeId: string | null; name: string; since: Date } };
export function clockStatus(punches: Punch[]): ClockStatus {
  const last = toSessions(punches).at(-1);
  if (!last || last.outAt) return { state: "OUT" };
  const open = openPause(last);
  return open ? { state: "ON_PAUSE", pause: { typeId: open.typeId, name: open.name, since: open.startAt } } : { state: "IN" };
}

export { addDays };
