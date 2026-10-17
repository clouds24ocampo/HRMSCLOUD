// Loads everything the DTR page and the CSV export need, with the access check built in.
import { prisma } from "@/lib/prisma";
import { buildDtr, toSessions, type Session, type ShiftTimes } from "@/lib/dtr";
import { STAMP_SELECT, toPunch } from "@/lib/punch";
import { loadSchedules, resolvePerson } from "@/lib/schedule-data";
import { canViewEmployee, type Actor } from "@/lib/scope";
import { addDays, dayKey, daysBetween, keyOfDbDate, dbDate, zonedTimeToUtc } from "@/lib/time";

export const MAX_RANGE_DAYS = 62;
export const FLEX_MIN_MINUTES = 8 * 60; // flexible schedule: minimum hours a working day

export async function loadDtr(actor: Actor, myEmployeeId: string, employeeId: string, from: string, to: string, tz: string, graceMinutes: number) {
  if (!(await canViewEmployee(actor, myEmployeeId, employeeId))) return null;
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId: actor.organizationId },
    select: { id: true, employeeNo: true, firstName: true, lastName: true, flexible: true },
  });
  if (!employee) return null;

  const days = daysBetween(from, to).slice(0, MAX_RANGE_DAYS);
  const last = days[days.length - 1];
  // One extra day each side so overnight sessions that cross the range edge are not cut in half.
  const windowStart = zonedTimeToUtc(addDays(from, -1), 0, tz);
  const windowEnd = zonedTimeToUtc(addDays(last, 2), 0, tz);

  const [events, schedules, leave, otReqs] = await Promise.all([
    prisma.timeEvent.findMany({
      where: { organizationId: actor.organizationId, employeeId, at: { gte: windowStart, lt: windowEnd } },
      include: { stampType: { select: STAMP_SELECT } },
      orderBy: { at: "asc" },
    }),
    loadSchedules(actor.organizationId, [employeeId], from, last),
    prisma.leaveRequest.findMany({
      where: { organizationId: actor.organizationId, employeeId, status: "APPROVED", startDate: { lte: dbDate(last) }, endDate: { gte: dbDate(from) } },
      select: { startDate: true, endDate: true },
    }),
    prisma.overtimeRequest.findMany({
      where: { organizationId: actor.organizationId, employeeId, date: { gte: dbDate(from), lte: dbDate(last) } },
      select: { id: true, date: true, minutes: true, status: true, decisionNote: true },
    }),
  ]);
  const overtime = new Map(otReqs.map((o) => [keyOfDbDate(o.date), o]));

  const resolved = resolvePerson(schedules.get(employeeId), days);
  const schedule = new Map<string, ShiftTimes | null>([...resolved].map(([d, r]) => [d, r.shift]));
  const leaveDays = new Set(leave.flatMap((l) => daysBetween(keyOfDbDate(l.startDate), keyOfDbDate(l.endDate))));
  const valid = events.filter((e) => !e.voidedAt);
  const rows = buildDtr({ days, punches: valid.map(toPunch), schedule, leaveDays, today: dayKey(new Date(), tz), tz, graceMinutes, flexMinutes: employee.flexible ? FLEX_MIN_MINUTES : undefined });

  const punchesByDay = new Map<string, typeof events>();
  for (const e of events) {
    const k = dayKey(e.at, tz);
    if (k >= from && k <= last) punchesByDay.set(k, [...(punchesByDay.get(k) ?? []), e]);
  }
  // For payroll: whole sessions per day (night hours) and the days the schedule marks as a day off (rest day pay).
  const sessionsByDay = new Map<string, Session[]>();
  for (const sess of toSessions(valid.map(toPunch))) {
    const k = dayKey(sess.inAt, tz);
    sessionsByDay.set(k, [...(sessionsByDay.get(k) ?? []), sess]);
  }
  const dayOff = new Set([...resolved].filter(([, r]) => r.shift === null).map(([d]) => d));
  return { employee, rows, punchesByDay, overtime, hasSchedule: employee.flexible || resolved.size > 0, sessionsByDay, dayOff };
}
