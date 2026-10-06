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

const shiftMinutes = (s: { startTime: string; endTime: string; breakMinutes: number }) => {
  const a = parseHM(s.startTime) ?? 0, b = parseHM(s.endTime) ?? 0;
  return Math.max(0, (b <= a ? b + 1440 : b) - a - s.breakMinutes);
};
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

// Only days that were scheduled to work and are over (not today, not future) are judged.
export function summarize(rows: DtrDay[], today: string, t: Thresholds = DEFAULT_THRESHOLDS): Summary {
  let scheduled = 0, planned = 0, kept = 0, present = 0, absent = 0, lateDays = 0, late = 0, under = 0, over = 0, ob = 0, onTime = 0;
  for (const r of rows) {
    over += r.overtimeMinutes;
    ob += r.overLimitMinutes;
    if (!r.shift || r.status === "LEAVE" || r.status === "DAY_OFF" || r.status === "NO_SCHEDULE" || r.day >= today) continue;
    scheduled++;
    const mins = shiftMinutes(r.shift);
    planned += mins;
    if (r.status === "ABSENT") { absent++; continue; }
    present++;
    if (r.lateMinutes > 0) { lateDays++; late += r.lateMinutes; } else onTime++;
    under += r.undertimeMinutes;
    kept += Math.max(0, mins - r.lateMinutes - r.undertimeMinutes);
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
