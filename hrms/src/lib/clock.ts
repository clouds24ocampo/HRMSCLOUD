import { prisma } from "@/lib/prisma";
import { clockStatus } from "@/lib/dtr";
import { getOrgSettings } from "@/lib/settings";
import { getStampTypes } from "@/lib/stamps";
import { STAMP_SELECT, punchLabel, toPunch } from "@/lib/punch";
import { dayKey, dbDate, formatDay, formatTime } from "@/lib/time";
import { currentDayEvents, stampBlock, usedToday } from "@/lib/stamp-rules";

export type ClockType = {
  id: string; key: string; name: string; icon: string; tone: string; kind: "IN" | "OUT" | "PAUSE";
  allowedMinutes: number | null; requiresNote: boolean; defaultContext: string | null; page: "PUNCH" | "ISSUE";
  rule: string | null; // why it cannot be used today (limit reached, needs approved overtime)
  hint: string | null; // "1 of 1 today", "7 of 10 min used today"
};

// Everything the time stamp card needs: where the person is in their day, which buttons exist, and the password rule.
export async function getClockInfo(organizationId: string, employeeId: string, tz: string) {
  const [events, types, settings, ot] = await Promise.all([
    prisma.timeEvent.findMany({
      where: { organizationId, employeeId, voidedAt: null, at: { gte: new Date(Date.now() - 36 * 3600_000) } },
      select: { type: true, at: true, stampTypeId: true, stampType: { select: STAMP_SELECT } },
      orderBy: { at: "asc" },
    }),
    getStampTypes(organizationId),
    getOrgSettings(organizationId),
    prisma.overtimeRequest.findFirst({ where: { organizationId, employeeId, status: "APPROVED", date: dbDate(dayKey(new Date(), tz)) }, select: { minutes: true } }),
  ]);
  const status = clockStatus(events.map(toPunch));
  const last = events[events.length - 1];
  const lastText = last
    ? `Last: ${punchLabel(last).toLowerCase()} at ${formatTime(last.at, tz)}${dayKey(last.at, tz) === dayKey(new Date(), tz) ? "" : ` on ${formatDay(dayKey(last.at, tz))}`}`
    : null;
  const today = currentDayEvents(events);
  const pausedMin = (id: string) => {
    let total = 0, start: Date | null = null;
    for (const e of today) {
      if (e.stampTypeId !== id) continue;
      if (e.type === "PAUSE_START") start = e.at;
      else if (e.type === "PAUSE_END" && start) { total += Math.floor((e.at.getTime() - start.getTime()) / 60000); start = null; }
    }
    return total;
  };
  const clockTypes: ClockType[] = types.map((t) => {
    const used = usedToday(events, t.id);
    return {
      id: t.id, key: t.key, name: t.name, icon: t.icon, tone: t.tone, kind: t.kind,
      allowedMinutes: t.allowedMinutes, requiresNote: t.requiresNote, defaultContext: t.defaultContext, page: t.page,
      rule: stampBlock(t, events, ot?.minutes ?? 0, false),
      hint: t.dailyCapMinutes != null ? `${pausedMin(t.id)} of ${t.dailyCapMinutes} min used today` : t.maxPerDay != null && t.kind === "PAUSE" ? `${used} of ${t.maxPerDay} today` : null,
    };
  });
  return {
    state: status.state,
    pause: status.pause ? { typeId: status.pause.typeId, name: status.pause.name, since: status.pause.since.toISOString() } : null,
    lastText,
    types: clockTypes,
    requirePassword: settings.requirePunchPassword,
    unlockSeconds: settings.punchUnlockSeconds,
  };
}
