// The one DTR calculator. Raw punches go in, a day-by-day record comes out.
// Every organization and industry uses this same function; only the inputs (schedule, grace, stamp types) differ.
import { addDays, dayKey, parseHM, zonedTimeToUtc } from "@/lib/time";

// What a pause punch knew about its time stamp type. Missing = a plain unpaid break.
export type StampCategory = "BREAK" | "ISSUE" | "TRIP" | "OTHER";
export type StampInfo = {
  id: string;
  name: string;
  paid: boolean;
  allowedMinutes: number | null;
  dailyCapMinutes?: number | null;
  page?: "PUNCH" | "ISSUE" | null;
  key?: string | null;
  category?: StampCategory;
};
export type Punch = { type: "IN" | "OUT" | "PAUSE_START" | "PAUSE_END"; at: Date; stamp?: StampInfo | null };
export type ShiftTimes = { startTime: string; endTime: string; breakMinutes: number };

export type Pause = {
  startAt: Date;
  endAt: Date | null;
  name: string;
  typeId: string | null;
  paid: boolean;
  allowedMinutes: number | null;
  dailyCapMinutes?: number | null;
  category?: StampCategory;
};
export type Session = { inAt: Date; outAt: Date | null; pauses: Pause[] };

export type DtrStatus = "PRESENT" | "INCOMPLETE" | "ABSENT" | "LEAVE" | "DAY_OFF" | "NO_SCHEDULE";
export type PauseSummary = {
  name: string;
  count: number;
  minutes: number;
  seconds: number;
  paid: boolean;
  overMinutes: number;
  category: StampCategory;
};

export type DtrDay = {
  day: string;
  status: DtrStatus;
  firstIn: Date | null;
  lastOut: Date | null;
  workedMinutes: number;
  breakMinutes: number; // unpaid pause time (already taken out of worked time, preserved for compatibility)
  pauses: PauseSummary[];
  overLimitMinutes: number; // total time beyond each pause's allowed length
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number; // candidate only: not approved overtime
  shift: ShiftTimes | null;
  flex?: boolean; // flexible schedule: no shift times, judged on hours worked instead
  workedSeconds?: number;
  breakSeconds?: number; // total break time in seconds (meals, bio, rest breaks)
  issueMinutes?: number; // time spent on issues/calamities (not counted in productivity)
  issueSeconds?: number;
  productiveMinutes?: number; // pure productive work time (worked minus issues)
  productiveSeconds?: number;
  grossSeconds?: number; // total logged time span from In to Out
  productivityRate?: number; // % productive work vs (productive work + issue time)
};


const mins = (ms: number) => Math.max(0, Math.floor(ms / 60000));
const secs = (ms: number) => Math.max(0, Math.round(ms / 1000));
const DEFAULT_PAUSE = { name: "Break", typeId: null, paid: false, allowedMinutes: null, category: "BREAK" as StampCategory } as const;

const ISSUE_KEYS = new Set([
  "SYSTEM_ISSUE",
  "CLINIC_BREAK",
  "HEAVY_RAIN",
  "EXTREME_HEAT",
  "TYPHOON",
  "EARTHQUAKE",
  "POWER_OUTAGE",
  "CALAMITY",
]);
const ISSUE_NAME_REGEX = /issue|outage|calamity|clinic|typhoon|earthquake|flood|rain|heat|emergency/i;

export function classifyPauseCategory(stamp?: StampInfo | null, fallbackName?: string): StampCategory {
  if (stamp?.category) return stamp.category;
  if (stamp?.page === "ISSUE") return "ISSUE";
  if (stamp?.key && ISSUE_KEYS.has(stamp.key)) return "ISSUE";
  const name = stamp?.name ?? fallbackName ?? "";
  if (stamp?.key === "ON_TRIP" || name.toLowerCase().includes("trip")) return "TRIP";
  if (ISSUE_NAME_REGEX.test(name)) return "ISSUE";
  return "BREAK";
}

// Pair punches into sessions. A session belongs to the day it started, so overnight shifts stay on one row.
export function toSessions(punches: Punch[]): Session[] {
  const sorted = [...punches].sort((a, b) => a.at.getTime() - b.at.getTime());
  const out: Session[] = [];
  let cur: Session | null = null;
  for (const p of sorted) {
    if (p.type === "IN" && !cur) cur = { inAt: p.at, outAt: null, pauses: [] };
    else if (p.type === "PAUSE_START" && cur && !openPause(cur)) {
      const s = p.stamp;
      const category = classifyPauseCategory(s, s?.name);
      cur.pauses.push({
        startAt: p.at,
        endAt: null,
        ...(s
          ? {
              name: s.name,
              typeId: s.id,
              paid: s.paid,
              allowedMinutes: s.allowedMinutes,
              dailyCapMinutes: s.dailyCapMinutes ?? null,
              category,
            }
          : { ...DEFAULT_PAUSE, category: "BREAK" }),
      });
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
  // Flexible schedule: own start time and days off. Never late; under this many minutes worked is undertime, above it is overtime.
  flexMinutes?: number;
}): DtrDay[] {
  const { days, schedule, leaveDays, today, tz, graceMinutes, flexMinutes } = input;
  const flex = flexMinutes != null;
  const byDay = new Map<string, Session[]>();
  for (const s of toSessions(input.punches)) {
    const k = dayKey(s.inAt, tz);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }

  return days.map((day): DtrDay => {
    const sessions = byDay.get(day) ?? [];
    const shift = schedule.get(day) ?? null;
    const base = {
      day,
      shift: flex ? null : shift,
      firstIn: null,
      lastOut: null,
      workedMinutes: 0,
      workedSeconds: 0,
      breakMinutes: 0,
      breakSeconds: 0,
      issueMinutes: 0,
      issueSeconds: 0,
      productiveMinutes: 0,
      productiveSeconds: 0,
      grossSeconds: 0,
      productivityRate: 0,
      pauses: [],
      overLimitMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      ...(flex ? { flex: true } : {}),
    };

    if (!sessions.length) {
      const status: DtrStatus = leaveDays.has(day)
        ? "LEAVE"
        : flex
          ? "DAY_OFF" // a flexible worker picks their own days off
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
    const totalSessionMs = sessions.reduce((n, s) => n + (s.outAt ? s.outAt.getTime() - s.inAt.getTime() : 0), 0);
    // Company rule: only time worked and On Trip count toward the day. Every break and every issue (weather, calamity,
    // power, system, clinic…) is deducted, whatever its "paid" setting says. Lost issue time can be recovered later
    // in the cut-off (see recoveryCredit in payroll.ts).
    const unpaidMs = allPauses.filter((p) => p.category !== "TRIP").reduce((n, p) => n + pauseMs(p), 0);
    const workedMs = Math.max(0, totalSessionMs - unpaidMs);

    const summary = new Map<string, PauseSummary>();
    const caps = new Map<string, number>();
    let overLimit = 0;
    for (const p of allPauses) {
      const pMs = pauseMs(p);
      const m = mins(pMs);
      const s = secs(pMs);
      const over = p.allowedMinutes != null && m > p.allowedMinutes ? m - p.allowedMinutes : 0;
      overLimit += over;
      const row = summary.get(p.name) ?? {
        name: p.name,
        count: 0,
        minutes: 0,
        seconds: 0,
        paid: p.paid,
        overMinutes: 0,
        category: p.category ?? "BREAK",
      };

      row.count += 1;
      row.minutes += m;
      row.seconds += s;
      row.overMinutes += over;
      summary.set(p.name, row);
      if (p.dailyCapMinutes != null) caps.set(p.name, p.dailyCapMinutes);
    }
    // A daily cap (e.g. Bio Break 10 min a day) counts the day's total, not each pause. Excess is flagged, never blocked.
    for (const [name, cap] of caps) {
      const row = summary.get(name)!;
      const extra = Math.max(0, row.minutes - cap) - row.overMinutes;
      if (extra > 0) {
        row.overMinutes += extra;
        overLimit += extra;
      }
    }

    // Issues & downtime (e.g. System Issue, Power Outage, Calamity, Clinic) vs Breaks (e.g. Meal, Bio Break, Rest breaks)
    const issueMs = allPauses.filter((p) => p.category === "ISSUE").reduce((n, p) => n + pauseMs(p), 0);
    const breakMs = allPauses.filter((p) => p.category === "BREAK").reduce((n, p) => n + pauseMs(p), 0);
    // Productive work: pure active work time, strictly excluding both issues and breaks as they are not counted in productivity
    const productiveMs = Math.max(0, totalSessionMs - (issueMs + breakMs));

    const grossSec = secs(totalSessionMs);
    const prodSec = secs(productiveMs);
    const issueSec = secs(issueMs);
    const breakSec = secs(breakMs);
    const workedSec = secs(workedMs);

    const activeWorkAndIssueSec = prodSec + issueSec;
    const productivityRate = activeWorkAndIssueSec > 0
      ? Math.round((prodSec / activeWorkAndIssueSec) * 1000) / 10
      : (grossSec > 0 ? 100 : 0);


    let late = 0, under = 0, over = 0;
    if (flex) {
      if (lastOut) {
        under = Math.max(0, flexMinutes - mins(workedMs));
        over = Math.max(0, mins(workedMs) - flexMinutes);
      }
    } else if (shift) {
      const { start, end } = shiftInstants(day, shift, tz);
      const lateBy = mins(firstIn.getTime() - start.getTime());
      late = lateBy > graceMinutes ? lateBy : 0;
      if (lastOut) {
        under = mins(end.getTime() - lastOut.getTime());
        over = mins(lastOut.getTime() - end.getTime());
      }
    }
    return {
      ...base,
      status: open ? "INCOMPLETE" : "PRESENT",
      firstIn,
      lastOut,
      workedMinutes: mins(workedMs),
      workedSeconds: workedSec,
      breakMinutes: mins(unpaidMs),
      breakSeconds: breakSec,
      issueMinutes: mins(issueMs),
      issueSeconds: issueSec,
      productiveMinutes: mins(productiveMs),
      productiveSeconds: prodSec,
      grossSeconds: grossSec,
      productivityRate,
      pauses: [...summary.values()],
      overLimitMinutes: overLimit,
      lateMinutes: late,
      undertimeMinutes: under,
      overtimeMinutes: over,
    };
  });
}

// Flexible schedule: at least one day off in every 7. Returns each day that is the 7th (or later) worked day in a row.
export function restDayViolations(rows: DtrDay[]): string[] {
  const out: string[] = [];
  let streak = 0;
  for (const r of rows) {
    streak = r.status === "PRESENT" || r.status === "INCOMPLETE" ? streak + 1 : 0;
    if (streak >= 7) out.push(r.day);
  }
  return out;
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
