// Schedule adherence: how closely each person's actual DTR follows their plan. Pure; every organization uses the same definition.
import type { DtrDay } from "@/lib/dtr";
import { parseHM } from "@/lib/time";

export type Verdict = "ADHERING" | "MINOR" | "NOT_ADHERING" | "NO_DATA";
export type Thresholds = { adhering: number; minor: number }; // adherence % at or above these
export const DEFAULT_THRESHOLDS: Thresholds = { adhering: 95, minor: 85 };

export type Summary = {
  scheduledDays: number; present: number; absent: number; lateDays: number;
  lateMinutes: number; undertimeMinutes: number; overtimeMinutes: number; overBreakMinutes: number;
  onTimePct: number | null; attendancePct: number | null; adherencePct: number | null; verdict: Verdict;
};

export const shiftMinutes = (s: { startTime: string; endTime: string; breakMinutes: number }) => {
  const a = parseHM(s.startTime) ?? 0, b = parseHM(s.endTime) ?? 0;
  return Math.max(0, (b <= a ? b + 1440 : b) - a - s.breakMinutes);
};
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export const DAILY_BASE_BREAK_MINUTES = 90; // 1h 30m breaks and meal daily (no extension allowed)
export const OVERTIME_BREAK_INTERVAL_MINUTES = 120; // 2 hours overtime
export const OVERTIME_BREAK_BONUS_MINUTES = 15; // 15 minutes additional break allowance per 2 hours overtime

export function calculateAllowedBreakMinutes(overtimeMinutes: number = 0): number {
  const otBlocks = Math.floor(Math.max(0, overtimeMinutes) / OVERTIME_BREAK_INTERVAL_MINUTES);
  return DAILY_BASE_BREAK_MINUTES + otBlocks * OVERTIME_BREAK_BONUS_MINUTES;
}

export type DailyAdherence = {
  day: string;
  status: DtrDay["status"];
  shift: DtrDay["shift"];
  plannedMinutes: number;
  workedMinutes: number;
  workedSeconds: number;
  productiveMinutes: number;
  productiveSeconds: number;
  productivityRate: number;
  breakMinutes: number;
  breakSeconds: number;
  allowedBreakMinutes: number;
  excessBreakMinutes: number;
  issueMinutes: number;
  issueSeconds: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  keptMinutes: number;
  adherencePct: number | null;
  verdict: Verdict;
};

export function computeDailyAdherence(r: DtrDay): DailyAdherence {
  const isLeave = r.status === "LEAVE";
  const isDayOff = r.status === "DAY_OFF" || r.status === "NO_SCHEDULE";
  const plannedMinutes = r.shift ? shiftMinutes(r.shift) : 480;
  const allowedBreakMinutes = calculateAllowedBreakMinutes(r.overtimeMinutes);
  const actualBreakMinutes = r.breakMinutes ?? Math.floor((r.breakSeconds ?? 0) / 60);
  const excessBreakMinutes = Math.max(0, actualBreakMinutes - allowedBreakMinutes);

  const workedSec = r.workedSeconds ?? (r.workedMinutes * 60);
  const prodSec = r.productiveSeconds ?? workedSec;
  const prodMin = r.productiveMinutes ?? Math.floor(prodSec / 60);
  const breakSec = r.breakSeconds ?? (actualBreakMinutes * 60);
  const issueSec = r.issueSeconds ?? 0;
  const issueMin = r.issueMinutes ?? Math.floor(issueSec / 60);

  if (isLeave || isDayOff) {
    return {
      day: r.day,
      status: r.status,
      shift: r.shift,
      plannedMinutes: 0,
      workedMinutes: r.workedMinutes,
      workedSeconds: workedSec,
      productiveMinutes: prodMin,
      productiveSeconds: prodSec,
      productivityRate: r.productivityRate ?? 0,
      breakMinutes: actualBreakMinutes,
      breakSeconds: breakSec,
      allowedBreakMinutes,
      excessBreakMinutes: 0,
      issueMinutes: issueMin,
      issueSeconds: issueSec,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: r.overtimeMinutes,
      keptMinutes: 0,
      adherencePct: null,
      verdict: "NO_DATA",
    };
  }

  if (r.status === "ABSENT") {
    return {
      day: r.day,
      status: r.status,
      shift: r.shift,
      plannedMinutes,
      workedMinutes: 0,
      workedSeconds: 0,
      productiveMinutes: 0,
      productiveSeconds: 0,
      productivityRate: 0,
      breakMinutes: 0,
      breakSeconds: 0,
      allowedBreakMinutes,
      excessBreakMinutes: 0,
      issueMinutes: 0,
      issueSeconds: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      keptMinutes: 0,
      adherencePct: 0,
      verdict: "NOT_ADHERING",
    };
  }

  const keptMinutes = Math.max(0, plannedMinutes - r.lateMinutes - r.undertimeMinutes - excessBreakMinutes);
  const adherencePct = plannedMinutes > 0 ? Math.min(100, Math.round((keptMinutes / plannedMinutes) * 1000) / 10) : 100;
  const verdict: Verdict = adherencePct >= 95 ? "ADHERING" : adherencePct >= 85 ? "MINOR" : "NOT_ADHERING";

  return {
    day: r.day,
    status: r.status,
    shift: r.shift,
    plannedMinutes,
    workedMinutes: r.workedMinutes,
    workedSeconds: workedSec,
    productiveMinutes: prodMin,
    productiveSeconds: prodSec,
    productivityRate: r.productivityRate ?? 0,
    breakMinutes: actualBreakMinutes,
    breakSeconds: breakSec,
    allowedBreakMinutes,
    excessBreakMinutes,
    issueMinutes: issueMin,
    issueSeconds: issueSec,
    lateMinutes: r.lateMinutes,
    undertimeMinutes: r.undertimeMinutes,
    overtimeMinutes: r.overtimeMinutes,
    keptMinutes,
    adherencePct,
    verdict,
  };
}

export type AdherenceAggregate = {
  totalScheduledDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalPlannedMinutes: number;
  totalKeptMinutes: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalOvertimeMinutes: number;
  totalBreakMinutes: number;
  totalAllowedBreakMinutes: number;
  totalExcessBreakMinutes: number;
  totalProductiveSeconds: number;
  overallProductivityRate: number;
  overallAdherencePct: number | null;
  verdict: Verdict;
};

export function summarizeDailyAdherence(dailyList: DailyAdherence[], today?: string): AdherenceAggregate {
  let scheduled = 0, present = 0, absent = 0, lateDays = 0;
  let planned = 0, kept = 0, late = 0, under = 0, over = 0;
  let breaks = 0, allowedBreaks = 0, excessBreaks = 0;
  let prodSec = 0, issueSec = 0;

  for (const d of dailyList) {
    if (d.status === "LEAVE" || d.status === "DAY_OFF" || d.status === "NO_SCHEDULE") continue;
    if (today && d.day >= today) continue;
    scheduled++;
    planned += d.plannedMinutes;
    if (d.status === "ABSENT") {
      absent++;
      continue;
    }
    present++;
    if (d.lateMinutes > 0) lateDays++;
    late += d.lateMinutes;
    under += d.undertimeMinutes;
    over += d.overtimeMinutes;
    breaks += d.breakMinutes;
    allowedBreaks += d.allowedBreakMinutes;
    excessBreaks += d.excessBreakMinutes;
    kept += d.keptMinutes;
    prodSec += d.productiveSeconds;
    issueSec += d.issueSeconds;
  }

  const overallAdherencePct = planned > 0 ? Math.round((kept / planned) * 1000) / 10 : null;
  const activeSec = prodSec + issueSec;
  const overallProductivityRate = activeSec > 0 ? Math.round((prodSec / activeSec) * 1000) / 10 : 0;
  const verdict: Verdict =
    overallAdherencePct === null
      ? "NO_DATA"
      : overallAdherencePct >= 95
      ? "ADHERING"
      : overallAdherencePct >= 85
      ? "MINOR"
      : "NOT_ADHERING";

  return {
    totalScheduledDays: scheduled,
    presentDays: present,
    absentDays: absent,
    lateDays,
    totalPlannedMinutes: planned,
    totalKeptMinutes: kept,
    totalLateMinutes: late,
    totalUndertimeMinutes: under,
    totalOvertimeMinutes: over,
    totalBreakMinutes: breaks,
    totalAllowedBreakMinutes: allowedBreaks,
    totalExcessBreakMinutes: excessBreaks,
    totalProductiveSeconds: prodSec,
    overallProductivityRate,
    overallAdherencePct,
    verdict,
  };
}

// Only days that were scheduled to work and are over (not today, not future) are judged.
export function summarize(rows: DtrDay[], today: string, t: Thresholds = DEFAULT_THRESHOLDS): Summary {
  let scheduled = 0, planned = 0, kept = 0, present = 0, absent = 0, lateDays = 0, late = 0, under = 0, over = 0, ob = 0, onTime = 0;
  for (const r of rows) {
    over += r.overtimeMinutes;
    const allowedBreak = calculateAllowedBreakMinutes(r.overtimeMinutes);
    const actualBreak = r.breakMinutes ?? Math.floor((r.breakSeconds ?? 0) / 60);
    const excessBreak = Math.max(0, actualBreak - allowedBreak);
    ob += r.overLimitMinutes + excessBreak;
    if (!r.shift || r.status === "LEAVE" || r.status === "DAY_OFF" || r.status === "NO_SCHEDULE" || r.day >= today) continue;
    scheduled++;
    const mins = shiftMinutes(r.shift);
    planned += mins;
    if (r.status === "ABSENT") { absent++; continue; }
    present++;
    if (r.lateMinutes > 0) { lateDays++; late += r.lateMinutes; } else onTime++;
    under += r.undertimeMinutes;
    kept += Math.max(0, mins - r.lateMinutes - r.undertimeMinutes - excessBreak);
  }
  const adherencePct = pct(kept, planned);
  const verdict: Verdict = adherencePct === null ? "NO_DATA" : adherencePct >= t.adhering ? "ADHERING" : adherencePct >= t.minor ? "MINOR" : "NOT_ADHERING";
  return {
    scheduledDays: scheduled, present, absent, lateDays, lateMinutes: late, undertimeMinutes: under, overtimeMinutes: over, overBreakMinutes: ob,
    onTimePct: pct(onTime, scheduled), attendancePct: pct(present, scheduled), adherencePct, verdict,
  };
}

export const VERDICT: Record<Verdict, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  ADHERING: { label: "Adhering", tone: "success" },
  MINOR: { label: "Minor deviations", tone: "warning" },
  NOT_ADHERING: { label: "Not adhering", tone: "danger" },
  NO_DATA: { label: "No data yet", tone: "neutral" },
};
