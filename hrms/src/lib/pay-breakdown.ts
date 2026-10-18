// How one person's pay is worked out, shown on their profile: the rate chain (monthly -> year -> day -> hour), the fixed
// share per cut-off, and what each day of the current cut-off actually earned from the hours logged on the DTR.
// Same formulas as the payroll calculator (rates() and the logged-hours rule): nothing here is a second calculation model.
import { prisma } from "@/lib/prisma";
import { cutoffFor, type Cutoff } from "@/lib/cutoffs";
import { loadDtr } from "@/lib/dtr-data";
import type { DtrDay } from "@/lib/dtr";
import { loadTeamDtr } from "@/lib/team-dtr";
import { rates } from "@/lib/ph/calc";
import { recoveryCredit } from "@/lib/payroll";
import type { Actor } from "@/lib/scope";
import { addDays, dayKey, dbDate, keyOfDbDate, zonedTimeToUtc } from "@/lib/time";

// One day's pay from its DTR row: hours worked up to the normal day, plus approved overtime at the overtime rate.
// A day still timed in pays nothing yet (it is paid once it closes). The one per-day rule: profile, payslips and payroll use it.
// `recovered`: issue time from earlier days paid back today (see recoveryCredit in payroll.ts).
export function dayPay(d: Pick<DtrDay, "status" | "workedMinutes" | "overtimeMinutes">, approvedMinutes: number, capMinutes: number, minuteCents: number, otMultiplierBp: number, recovered = 0) {
  const okOt = Math.min(approvedMinutes, d.overtimeMinutes);
  const regular = d.status === "PRESENT" ? Math.min(d.workedMinutes - okOt, capMinutes) + recovered : 0;
  return { okOt, regular, regularCents: Math.round(minuteCents * regular), otCents: Math.round(minuteCents * okOt * (otMultiplierBp / 10000)) };
}

export type PayDayRow = { day: string; recoveredMinutes: number; regularMinutes: number; overtimeMinutes: number; approvedOtMinutes: number; regularCents: number; otCents: number; systemTimeout: boolean; status: string };

// `cutoff` picks an earlier cut-off (Payslips page); by default the one holding today. Days after today are not counted yet.
export async function payBreakdown(me: Actor, myEmployeeId: string, employeeId: string, today: string, s: { timezone: string; graceMinutes: number; daysPerYear: number; hoursPerDay: number; otMultiplierBp: number }, cutoff?: Cutoff) {
  const cut = cutoff ?? cutoffFor(today);
  const last = cut.end < today ? cut.end : today;
  // The pay rate in force at the end of that cut-off (a raise later does not rewrite an older cut-off).
  const comp = await prisma.compensation.findFirst({ where: { employeeId, organizationId: me.organizationId, effectiveFrom: { lte: dbDate(last) } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] });
  if (!comp) return null;
  const r = rates(comp.payType, comp.rateCents, s.daysPerYear, s.hoursPerDay);
  const [dtr, ot, system] = await Promise.all([
    loadDtr(me, myEmployeeId, employeeId, cut.start, last, s.timezone, s.graceMinutes),
    prisma.overtimeRequest.findMany({ where: { employeeId, organizationId: me.organizationId, status: "APPROVED", date: { gte: dbDate(cut.start), lte: dbDate(last) } }, select: { date: true, minutes: true } }),
    prisma.timeEvent.findMany({ where: { employeeId, organizationId: me.organizationId, source: "SYSTEM", voidedAt: null, at: { gte: dbDate(cut.start) } }, select: { at: true } }),
  ]);
  const approved = new Map(ot.map((o) => [keyOfDbDate(o.date), o.minutes]));
  const minute = r.hourly / 60;
  const cap = s.hoursPerDay * 60;
  const recovered = recoveryCredit(dtr?.rows ?? [], approved, cap);
  const days: PayDayRow[] = (dtr?.rows ?? [])
    .filter((d) => d.workedMinutes > 0 || d.status === "INCOMPLETE")
    .map((d) => {
      const p = dayPay(d, approved.get(d.day) ?? 0, cap, minute, s.otMultiplierBp, recovered.get(d.day) ?? 0);
      return {
        day: d.day, status: d.status, recoveredMinutes: recovered.get(d.day) ?? 0, regularMinutes: p.regular, overtimeMinutes: d.overtimeMinutes, approvedOtMinutes: p.okOt,
        regularCents: p.regularCents, otCents: p.otCents,
        systemTimeout: system.some((e) => d.lastOut?.getTime() === e.at.getTime()),
      };
    });
  return {
    payType: comp.payType, rateCents: comp.rateCents, monthly: r.monthly, yearly: r.monthly * 12, daily: r.daily, hourly: r.hourly,
    perCutoff: Math.round(r.monthly / 2), cut, days,
    total: days.reduce((n, d) => n + d.regularCents + d.otCents, 0),
  };
}

// Cut-offs this person has anything in: a time stamp or a payslip. Newest first. A month they did not work in never appears.
export async function activeCutoffs(organizationId: string, employeeId: string, tz: string): Promise<Cutoff[]> {
  const [days, slips] = await Promise.all([
    prisma.$queryRawUnsafe<{ d: string }[]>(
      `SELECT DISTINCT to_char(("at" AT TIME ZONE 'UTC' AT TIME ZONE $3)::date, 'YYYY-MM-DD') d FROM "TimeEvent" WHERE "organizationId" = $1 AND "employeeId" = $2 AND "voidedAt" IS NULL`,
      organizationId, employeeId, tz,
    ),
    // A live ₱0 payslip is not a transaction: only finalized ones, or ones that actually pay something.
    prisma.payslip.findMany({ where: { organizationId, employeeId, period: { kind: "REGULAR" }, OR: [{ period: { status: "FINALIZED" } }, { grossCents: { gt: 0 } }] }, select: { period: { select: { startDate: true } } } }),
  ]);
  const byStart = new Map<string, Cutoff>();
  for (const d of [...days.map((r) => r.d), ...slips.map((x) => keyOfDbDate(x.period.startDate))]) {
    const c = cutoffFor(d);
    byStart.set(c.start, c);
  }
  return [...byStart.values()].sort((a, b) => (a.start < b.start ? 1 : -1));
}

export type ActivityStamp = {
  id: string; at: Date; type: "IN" | "OUT" | "PAUSE_START" | "PAUSE_END"; name: string; icon: string; issue: boolean; source: string; note: string | null;
  lat: number | null; lng: number | null; accuracy: number | null; gpsStatus: string; device: string | null;
};
export type ActivityDay = {
  day: string; status: string; stamps: ActivityStamp[]; workedMinutes: number; paidMinutes: number; approvedOtMinutes: number; overtimeMinutes: number;
  lateMinutes: number; undertimeMinutes: number; issueMinutes: number; breakMinutes: number; recoveredMinutes: number; dayCents: number; noLocation: number; systemTimeout: boolean;
};

// Payroll view: for everyone in a period, each day with every time stamp (what, when, where), the tags and that day's pay.
// HR only (the caller checks). Same DTR engine and the same dayPay() as everywhere else.
export async function teamActivity(organizationId: string, ids: string[], from: string, to: string, today: string, s: { timezone: string; graceMinutes: number; daysPerYear: number; hoursPerDay: number; otMultiplierBp: number }) {
  const last = to < today ? to : today;
  if (last < from || !ids.length) return new Map<string, ActivityDay[]>();
  const tz = s.timezone;
  const [dtr, events, comps, ot] = await Promise.all([
    loadTeamDtr(organizationId, ids, from, last, tz, s.graceMinutes),
    prisma.timeEvent.findMany({
      where: { organizationId, employeeId: { in: ids }, voidedAt: null, at: { gte: zonedTimeToUtc(from, 0, tz), lt: zonedTimeToUtc(addDays(last, 1), 0, tz) } },
      include: { stampType: { select: { name: true, icon: true, page: true } } },
      orderBy: { at: "asc" },
    }),
    prisma.compensation.findMany({ where: { organizationId, employeeId: { in: ids }, effectiveFrom: { lte: dbDate(last) } }, orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }] }),
    prisma.overtimeRequest.findMany({ where: { organizationId, employeeId: { in: ids }, status: "APPROVED", date: { gte: dbDate(from), lte: dbDate(last) } }, select: { employeeId: true, date: true, minutes: true } }),
  ]);
  const out = new Map<string, ActivityDay[]>();
  for (const id of ids) {
    const comp = comps.filter((c) => c.employeeId === id).pop();
    const minute = comp ? rates(comp.payType, comp.rateCents, s.daysPerYear, s.hoursPerDay).hourly / 60 : 0;
    const mine = events.filter((e) => e.employeeId === id);
    const rows = dtr.get(id) ?? [];
    // Each stamp belongs to exactly one day: the day its session started (DTR rule, so an overnight shift stays on one row);
    // a stamp outside every session falls on its calendar day.
    const owner = new Map(mine.map((e) => {
      const inSession = rows.filter((d) => d.firstIn && e.at >= d.firstIn && (!d.lastOut || e.at <= d.lastOut)).pop();
      return [e.id, inSession?.day ?? dayKey(e.at, tz)];
    }));
    const approvedFor = new Map(ot.filter((o) => o.employeeId === id).map((o) => [keyOfDbDate(o.date), o.minutes]));
    const recovered = recoveryCredit(rows, approvedFor, s.hoursPerDay * 60);
    const days = rows.map((d): ActivityDay => {
      const stamps = mine.filter((e) => owner.get(e.id) === d.day);
      const p = dayPay(d, approvedFor.get(d.day) ?? 0, s.hoursPerDay * 60, minute, s.otMultiplierBp, recovered.get(d.day) ?? 0);
      return {
        day: d.day, status: d.status, workedMinutes: d.workedMinutes, paidMinutes: p.regular, approvedOtMinutes: p.okOt, overtimeMinutes: d.overtimeMinutes,
        lateMinutes: d.lateMinutes, undertimeMinutes: d.undertimeMinutes, issueMinutes: d.issueMinutes ?? 0, breakMinutes: d.breakMinutes, recoveredMinutes: recovered.get(d.day) ?? 0, dayCents: p.regularCents + p.otCents,
        noLocation: stamps.filter((e) => e.lat == null && e.source !== "SYSTEM" && e.source !== "MANUAL").length,
        systemTimeout: stamps.some((e) => e.source === "SYSTEM"),
        stamps: stamps.map((e) => ({
          id: e.id, at: e.at, type: e.type, name: e.stampType?.name ?? (e.type === "IN" ? "Time In" : e.type === "OUT" ? "Time Out" : "Break"), icon: e.stampType?.icon ?? "⏱️",
          issue: e.stampType?.page === "ISSUE", source: e.source, note: e.note, lat: e.lat, lng: e.lng, accuracy: e.accuracy, gpsStatus: e.gpsStatus, device: e.device,
        })),
      };
    });
    out.set(id, days.filter((d) => d.stamps.length || d.status === "ABSENT" || d.status === "LEAVE"));
  }
  return out;
}
