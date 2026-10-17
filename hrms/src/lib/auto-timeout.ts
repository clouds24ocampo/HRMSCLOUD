// Automatic time-out. Someone who forgets to time out is timed out by the system 30 minutes after a full working day
// (hours per day, plus any overtime already approved for that day). The punch is marked SYSTEM with the reason, so HR and
// payroll can see it was not the person: only the hours up to the normal day are paid, the rest needs approved overtime.
import { prisma } from "@/lib/prisma";
import { toSessions, type Session } from "@/lib/dtr";
import { STAMP_SELECT, toPunch } from "@/lib/punch";
import { dayKey, dbDate } from "@/lib/time";

export const AUTO_TIMEOUT_GRACE_MIN = 30;
export const AUTO_TIMEOUT_NOTE = "System time-out: no log out";
const HARD_CAP_MS = 16 * 3600_000; // an open session never runs longer than this, whatever the pauses

// Pure: the moment this open session reaches `minutes` of work (unpaid pauses do not count), or null while it is on an
// unpaid pause that has not ended (work is not growing). Paid pauses count as work.
export function reachesWorkAt(s: Session, minutes: number): Date | null {
  const unpaid = s.pauses.filter((p) => !p.paid).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  let t = s.inAt.getTime();
  let left = minutes * 60_000;
  for (const p of unpaid) {
    const gap = Math.max(0, p.startAt.getTime() - t);
    if (gap >= left) return new Date(t + left);
    left -= gap;
    if (!p.endAt) return null;
    t = Math.max(t, p.endAt.getTime());
  }
  return new Date(t + left);
}

// Pure: when the system should time this session out, or null if not yet.
export function autoTimeoutAt(s: Session, now: Date, limitMinutes: number): Date | null {
  if (s.outAt) return null;
  const at = reachesWorkAt(s, limitMinutes);
  const cap = new Date(s.inAt.getTime() + HARD_CAP_MS);
  const due = at && at < cap ? at : cap;
  return due <= now ? due : null;
}

// Times out everyone who is due, in one organization or in all of them. Safe to run often and from several places:
// each time-out is re-checked inside a transaction, so nobody gets two.
export async function sweepAutoTimeouts(organizationId?: string) {
  const now = new Date();
  const events = await prisma.timeEvent.findMany({
    where: { ...(organizationId ? { organizationId } : {}), voidedAt: null, at: { gte: new Date(now.getTime() - 36 * 3600_000) } },
    include: { stampType: { select: STAMP_SELECT } },
    orderBy: { at: "asc" },
  });
  const byEmp = new Map<string, typeof events>();
  for (const e of events) byEmp.set(e.employeeId, [...(byEmp.get(e.employeeId) ?? []), e]);
  let done = 0;
  for (const [employeeId, evs] of byEmp) {
    const open = toSessions(evs.map(toPunch)).at(-1);
    if (!open || open.outAt) continue;
    const orgId = evs[0].organizationId;
    const settings = await prisma.orgSettings.findUnique({ where: { organizationId: orgId }, select: { hoursPerDay: true, timezone: true } });
    const tz = settings?.timezone ?? "Asia/Manila";
    const ot = await prisma.overtimeRequest.findFirst({ where: { employeeId, status: "APPROVED", date: dbDate(dayKey(open.inAt, tz)) }, select: { minutes: true } });
    const at = autoTimeoutAt(open, now, (settings?.hoursPerDay ?? 8) * 60 + (ot?.minutes ?? 0) + AUTO_TIMEOUT_GRACE_MIN);
    if (!at) continue;
    const created = await prisma.$transaction(async (tx) => {
      // Someone (or another sweep) may have timed out in the meantime.
      if (await tx.timeEvent.findFirst({ where: { employeeId, voidedAt: null, type: "OUT", at: { gte: open.inAt } } })) return false;
      const out = await tx.timeStampType.findFirst({ where: { organizationId: orgId, kind: "OUT", archivedAt: null }, select: { id: true } });
      await tx.timeEvent.create({
        data: { organizationId: orgId, employeeId, type: "OUT", stampTypeId: out?.id, at, source: "SYSTEM", gpsStatus: "NOT_CAPTURED", locSource: "NONE", note: AUTO_TIMEOUT_NOTE },
      });
      await tx.auditLog.create({ data: { organizationId: orgId, action: "time_event.auto_timeout", entity: "Employee", entityId: employeeId, detail: { at: at.toISOString(), reason: AUTO_TIMEOUT_NOTE } } });
      return true;
    });
    if (created) done += 1;
  }
  return done;
}
