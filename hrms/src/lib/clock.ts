import { prisma } from "@/lib/prisma";
import { clockStatus } from "@/lib/dtr";
import { getOrgSettings } from "@/lib/settings";
import { getStampTypes } from "@/lib/stamps";
import { STAMP_SELECT, punchLabel, toPunch } from "@/lib/punch";
import { dayKey, formatDay, formatTime } from "@/lib/time";

export type ClockType = {
  id: string; key: string; name: string; icon: string; tone: string; kind: "IN" | "OUT" | "PAUSE";
  allowedMinutes: number | null; requiresNote: boolean; defaultContext: string | null;
};

// Everything the time stamp card needs: where the person is in their day, which buttons exist, and the password rule.
export async function getClockInfo(organizationId: string, employeeId: string, tz: string) {
  const [events, types, settings] = await Promise.all([
    prisma.timeEvent.findMany({
      where: { organizationId, employeeId, voidedAt: null, at: { gte: new Date(Date.now() - 36 * 3600_000) } },
      select: { type: true, at: true, stampType: { select: STAMP_SELECT } },
      orderBy: { at: "asc" },
    }),
    getStampTypes(organizationId),
    getOrgSettings(organizationId),
  ]);
  const status = clockStatus(events.map(toPunch));
  const last = events[events.length - 1];
  const lastText = last
    ? `Last: ${punchLabel(last).toLowerCase()} at ${formatTime(last.at, tz)}${dayKey(last.at, tz) === dayKey(new Date(), tz) ? "" : ` on ${formatDay(dayKey(last.at, tz))}`}`
    : null;
  const clockTypes: ClockType[] = types.map((t) => ({
    id: t.id, key: t.key, name: t.name, icon: t.icon, tone: t.tone, kind: t.kind,
    allowedMinutes: t.allowedMinutes, requiresNote: t.requiresNote, defaultContext: t.defaultContext,
  }));
  return {
    state: status.state,
    pause: status.pause ? { typeId: status.pause.typeId, name: status.pause.name, since: status.pause.since.toISOString() } : null,
    lastText,
    types: clockTypes,
    requirePassword: settings.requirePunchPassword,
    unlockSeconds: settings.punchUnlockSeconds,
  };
}
