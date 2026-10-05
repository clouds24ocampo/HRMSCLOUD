// Holiday, rest day, overtime and night differential pay (Labor Code arts. 86-94). The multipliers come from the PREMIUM_PAY rule.
import type { DtrDay, Session } from "@/lib/dtr";
import type { PremiumParams } from "@/lib/ph/rules";
import { round, type PayType } from "@/lib/ph/calc";
import { addDays, dayKey, zonedTimeToUtc } from "@/lib/time";

export type HolidayKind = "REGULAR" | "SPECIAL_NON_WORKING" | "SPECIAL_WORKING";
export type PayDay = {
  day: string;
  holiday: HolidayKind | null;
  doubleHoliday: boolean; // two regular holidays on one date
  restDay: boolean; // a day off in the schedule
  scheduled: boolean;
  workedMinutes: number; // complete sessions only
  otMinutes: number; // approved overtime inside the worked minutes
  nightRegularMinutes: number;
  nightOtMinutes: number;
  onPaidLeave: boolean;
  holidayEligible: boolean; // present or on paid leave on the scheduled day before
};

export function multiplierBp(d: Pick<PayDay, "holiday" | "doubleHoliday" | "restDay">, p: PremiumParams): number {
  if (d.holiday === "REGULAR") return d.doubleHoliday ? (d.restDay ? p.doubleHolidayRestDayBp : p.doubleHolidayBp) : d.restDay ? p.regularHolidayRestDayBp : p.regularHolidayBp;
  if (d.holiday === "SPECIAL_NON_WORKING") return d.restDay ? p.specialNonWorkingRestDayBp : p.specialNonWorkingBp;
  if (d.holiday === "SPECIAL_WORKING") return d.restDay ? p.restDayBp : p.specialWorkingBp;
  return d.restDay ? p.restDayBp : p.ordinaryBp;
}
export const isPremiumDay = (d: Pick<PayDay, "holiday" | "restDay">) => d.restDay || d.holiday === "REGULAR" || d.holiday === "SPECIAL_NON_WORKING";

// ───────────── Night hours ─────────────

type Span = { start: Date; end: Date };

// Time actually worked: each session minus its unpaid pauses.
export function workIntervals(sessions: Session[]): Span[] {
  const out: Span[] = [];
  for (const s of sessions) {
    if (!s.outAt) continue;
    let parts: Span[] = [{ start: s.inAt, end: s.outAt }];
    for (const p of s.pauses.filter((x) => !x.paid && x.endAt)) {
      parts = parts.flatMap((w) => {
        if (p.endAt! <= w.start || p.startAt >= w.end) return [w];
        const left = p.startAt > w.start ? [{ start: w.start, end: p.startAt }] : [];
        const right = p.endAt! < w.end ? [{ start: p.endAt!, end: w.end }] : [];
        return [...left, ...right];
      });
    }
    out.push(...parts);
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// The last `tailMinutes` of worked time are the overtime; the rest is regular time.
export function splitTail(spans: Span[], tailMinutes: number): { regular: Span[]; overtime: Span[] } {
  let left = tailMinutes * 60_000;
  const overtime: Span[] = [];
  const regular: Span[] = [];
  for (const s of [...spans].reverse()) {
    const len = s.end.getTime() - s.start.getTime();
    if (left <= 0) regular.unshift(s);
    else if (len <= left) {
      overtime.unshift(s);
      left -= len;
    } else {
      const cut = new Date(s.end.getTime() - left);
      overtime.unshift({ start: cut, end: s.end });
      regular.unshift({ start: s.start, end: cut });
      left = 0;
    }
  }
  return { regular, overtime };
}

export function nightMinutes(spans: Span[], tz: string, startMin: number, endMin: number): number {
  let ms = 0;
  for (const s of spans) {
    for (let d = addDays(dayKey(s.start, tz), -1); d <= dayKey(s.end, tz); d = addDays(d, 1)) {
      const ws = zonedTimeToUtc(d, startMin, tz).getTime();
      const we = zonedTimeToUtc(d, endMin <= startMin ? endMin + 1440 : endMin, tz).getTime();
      ms += Math.max(0, Math.min(s.end.getTime(), we) - Math.max(s.start.getTime(), ws));
    }
  }
  return Math.floor(ms / 60_000);
}

// ───────────── Turning DTR rows into pay days ─────────────

export function buildPayDays(o: {
  rows: DtrDay[];
  holidays: Map<string, HolidayKind[]>;
  dayOff: Set<string>; // days the schedule marks as a day off
  paidLeave: Set<string>;
  approvedOvertime: Map<string, number>;
  sessionsByDay: Map<string, Session[]>;
  tz: string;
  premium: PremiumParams;
}): PayDay[] {
  const out: PayDay[] = [];
  let lastScheduledOk = true; // was the previous scheduled day worked or on paid leave? (assume yes before the period starts)
  for (const r of o.rows) {
    const hs = o.holidays.get(r.day) ?? [];
    const regulars = hs.filter((h) => h === "REGULAR").length;
    const holiday: HolidayKind | null = regulars ? "REGULAR" : hs.includes("SPECIAL_NON_WORKING") ? "SPECIAL_NON_WORKING" : hs.includes("SPECIAL_WORKING") ? "SPECIAL_WORKING" : null;
    const complete = r.status === "PRESENT";
    const worked = complete ? r.workedMinutes : 0;
    const restDay = o.dayOff.has(r.day);
    const approved = o.approvedOvertime.get(r.day) ?? 0;
    const otMinutes = !complete ? 0 : r.shift ? Math.min(approved, r.overtimeMinutes) : Math.min(approved, worked);
    const spans = worked > 0 ? workIntervals(o.sessionsByDay.get(r.day) ?? []) : [];
    const { regular, overtime } = splitTail(spans, otMinutes);
    const onPaidLeave = r.status === "LEAVE" && !!r.shift && o.paidLeave.has(r.day);
    out.push({
      day: r.day, holiday, doubleHoliday: regulars >= 2, restDay, scheduled: !!r.shift,
      workedMinutes: worked, otMinutes,
      nightRegularMinutes: nightMinutes(regular, o.tz, o.premium.nightStartMinute, o.premium.nightEndMinute),
      nightOtMinutes: nightMinutes(overtime, o.tz, o.premium.nightStartMinute, o.premium.nightEndMinute),
      onPaidLeave, holidayEligible: lastScheduledOk,
    });
    if (r.shift) lastScheduledOk = complete || onPaidLeave || holiday !== null; // a holiday itself keeps the chain going
  }
  return out;
}

// ───────────── Pay for those days ─────────────

export type PremiumResult = {
  holidayCents: number; restDayCents: number; overtimeCents: number; nightCents: number; unworkedHolidayCents: number;
  unworkedHolidayDays: number;
  notes: { holiday: string; restDay: string; overtime: string; night: string };
};

// hourlyCents may be fractional: only the final line totals are rounded.
export function premiumPay(o: { payType: PayType; dailyCents: number; hourlyCents: number; hoursPerDay: number; factor: number; days: PayDay[]; p: PremiumParams; otFloorBp: number }): PremiumResult {
  const { p, hourlyCents: h } = o;
  let holiday = 0, restDay = 0, overtime = 0, night = 0, unworkedDays = 0;
  const cap = o.hoursPerDay * 60;
  let nHoliday = 0, nRest = 0, nOt = 0, nNight = 0;
  for (const d of o.days) {
    const m = multiplierBp(d, p) / 10000;
    const premium = isPremiumDay(d);
    const reg = Math.min(Math.max(0, d.workedMinutes - d.otMinutes), premium ? cap : Number.MAX_SAFE_INTEGER);
    if (d.workedMinutes > 0 && premium) {
      // Monthly pay already covers a scheduled day; a rest day is covered only when the salary factor counts every calendar day.
      const coveredByPay = o.payType === "MONTHLY" ? !d.restDay || o.factor === 365 : true;
      const extra = h * (reg / 60) * (coveredByPay ? m - 1 : m);
      if (d.holiday === "REGULAR" || d.holiday === "SPECIAL_NON_WORKING") { holiday += extra; nHoliday += 1; } else { restDay += extra; nRest += 1; }
    }
    const otMult = premium ? m * (p.overtimeOnPremiumBp / 10000) : Math.max(p.overtimeOrdinaryBp, o.otFloorBp) / 10000;
    if (d.otMinutes > 0) { overtime += h * (d.otMinutes / 60) * otMult; nOt += 1; }
    const nd = p.nightDiffBp / 10000;
    if (d.nightRegularMinutes > 0 || d.nightOtMinutes > 0) {
      night += h * (d.nightRegularMinutes / 60) * m * nd + h * (d.nightOtMinutes / 60) * otMult * nd;
      nNight += 1;
    }
    // Unworked holidays.
    // Monthly pay already covers these days. Daily and hourly staff are paid for them only when the law or company policy says so.
    if (d.workedMinutes === 0 && !d.onPaidLeave && d.holiday && o.payType !== "MONTHLY") {
      const pays = (d.holiday === "REGULAR" && d.holidayEligible && !d.restDay) || (d.holiday === "SPECIAL_NON_WORKING" && p.payUnworkedSpecialNonWorking && d.scheduled);
      if (pays) unworkedDays += 1;
    }
  }
  const unworked = o.dailyCents * unworkedDays;
  return {
    holidayCents: round(holiday), restDayCents: round(restDay), overtimeCents: round(overtime), nightCents: round(night), unworkedHolidayCents: round(unworked),
    unworkedHolidayDays: unworkedDays,
    notes: { holiday: `${nHoliday} holiday day${nHoliday === 1 ? "" : "s"} worked`, restDay: `${nRest} rest day${nRest === 1 ? "" : "s"} worked`, overtime: `${nOt} day${nOt === 1 ? "" : "s"} with approved overtime`, night: `${nNight} day${nNight === 1 ? "" : "s"} with night hours` },
  };
}
