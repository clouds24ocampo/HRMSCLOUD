// System activity analytics for HR: everything the audit log, the time clock and the chat recorded in a date range.
// Read-only aggregate queries; days are counted in the organization's timezone.
import { prisma } from "@/lib/prisma";
import { addDays, daysBetween, zonedTimeToUtc } from "@/lib/time";

const MODULE_LABEL: Record<string, string> = {
  login: "Sign-in", password: "Passwords", employee: "Employees", compensation: "Pay rates", payroll: "Payroll", overtime: "Overtime", leave: "Leave",
  time_event: "DTR corrections", document: "Documents", policy: "Policies", daily_report: "Daily reports", call: "Calls",
  department: "Organization", position: "Organization", schedule: "Schedule", user: "Users", announcement: "Announcements",
  id_card: "Digital ID", review: "Performance", goal: "Performance", course: "Learning", applicant: "Recruitment", job: "Recruitment", request: "HR requests",
};
export const moduleOf = (action: string) => MODULE_LABEL[action.split(".")[0]] ?? action.split(".")[0].replace(/_/g, " ");

type DayCount = { d: string; n: bigint };

export async function activityAnalytics(organizationId: string, from: string, to: string, tz: string) {
  const start = zonedTimeToUtc(from, 0, tz);
  const end = zonedTimeToUtc(addDays(to, 1), 0, tz);
  const range = { gte: start, lt: end };
  const day = (col: string) => `to_char((${col} AT TIME ZONE 'UTC' AT TIME ZONE $2)::date, 'YYYY-MM-DD')`;

  const [auditDays, stampDays, msgDays, byAction, byActor, stampHours, sources, devices, logins, failed, messages, calls, reports, signatures, uploads, recent] = await Promise.all([
    prisma.$queryRawUnsafe<DayCount[]>(`SELECT ${day('"createdAt"')} d, count(*) n FROM "AuditLog" WHERE "organizationId" = $1 AND "createdAt" >= $3 AND "createdAt" < $4 GROUP BY 1`, organizationId, tz, start, end),
    prisma.$queryRawUnsafe<DayCount[]>(`SELECT ${day('"at"')} d, count(*) n FROM "TimeEvent" WHERE "organizationId" = $1 AND "at" >= $3 AND "at" < $4 AND "voidedAt" IS NULL GROUP BY 1`, organizationId, tz, start, end),
    prisma.$queryRawUnsafe<DayCount[]>(
      `SELECT ${day('m."createdAt"')} d, count(*) n FROM "Message" m JOIN "Conversation" c ON c."id" = m."conversationId" WHERE c."organizationId" = $1 AND m."createdAt" >= $3 AND m."createdAt" < $4 GROUP BY 1`,
      organizationId, tz, start, end,
    ),
    prisma.auditLog.groupBy({ by: ["action"], where: { organizationId, createdAt: range }, _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ["actorId"], where: { organizationId, createdAt: range, actorId: { not: null } }, _count: { _all: true }, orderBy: { _count: { actorId: "desc" } }, take: 10 }),
    prisma.$queryRawUnsafe<{ h: number; n: bigint }[]>(
      `SELECT extract(hour FROM ("at" AT TIME ZONE 'UTC' AT TIME ZONE $2))::int h, count(*) n FROM "TimeEvent" WHERE "organizationId" = $1 AND "at" >= $3 AND "at" < $4 AND "voidedAt" IS NULL AND "type" IN ('IN', 'OUT') GROUP BY 1`,
      organizationId, tz, start, end,
    ),
    prisma.timeEvent.groupBy({ by: ["locSource"], where: { organizationId, at: range, voidedAt: null }, _count: { _all: true } }),
    prisma.timeEvent.groupBy({ by: ["device"], where: { organizationId, at: range, voidedAt: null }, _count: { _all: true } }),
    prisma.auditLog.count({ where: { organizationId, createdAt: range, action: "login.success" } }),
    prisma.auditLog.count({ where: { organizationId, createdAt: range, action: "login.failed" } }),
    prisma.message.count({ where: { conversation: { organizationId }, createdAt: range } }),
    prisma.callSession.groupBy({ by: ["kind"], where: { organizationId, createdAt: range }, _count: { _all: true } }),
    prisma.dailyReport.count({ where: { organizationId, createdAt: range } }),
    prisma.policySignature.count({ where: { organizationId, createdAt: range } }),
    prisma.employeeDocument.count({ where: { organizationId, createdAt: range } }),
    prisma.auditLog.findMany({ where: { organizationId, createdAt: range }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);

  const series = (rows: DayCount[]) => {
    const m = new Map(rows.map((r) => [r.d, Number(r.n)]));
    return daysBetween(from, to).map((d) => ({ label: d, value: m.get(d) ?? 0 }));
  };
  const modules = new Map<string, number>();
  for (const a of byAction) modules.set(moduleOf(a.action), (modules.get(moduleOf(a.action)) ?? 0) + a._count._all);
  const actorIds = [...new Set([...byActor.map((a) => a.actorId!), ...recent.map((r) => r.actorId).filter((x): x is string => !!x)])];
  const users = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: { select: { name: true } } } });
  const who = new Map(users.map((u) => [u.id, u]));
  const hours = new Map(stampHours.map((h) => [h.h, Number(h.n)]));

  return {
    totals: {
      actions: byAction.reduce((n, a) => n + a._count._all, 0), activeUsers: (await prisma.auditLog.findMany({ where: { organizationId, createdAt: range, actorId: { not: null } }, distinct: ["actorId"], select: { actorId: true } })).length,
      logins, failed, messages, reports, signatures, uploads,
      stamps: stampDays.reduce((n, r) => n + Number(r.n), 0),
      voiceCalls: calls.find((c) => c.kind === "VOICE")?._count._all ?? 0, videoCalls: calls.find((c) => c.kind === "VIDEO")?._count._all ?? 0,
    },
    perDay: { actions: series(auditDays), stamps: series(stampDays), messages: series(msgDays) },
    modules: [...modules].sort((a, b) => b[1] - a[1]),
    topUsers: byActor.map((a) => ({ name: who.get(a.actorId!)?.name ?? "Removed user", role: who.get(a.actorId!)?.role.name ?? "", count: a._count._all })),
    stampHours: Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, "0")}:00`, value: hours.get(h) ?? 0 })),
    sources: sources.map((s) => ({ key: s.locSource ?? "BEFORE_TRACKING", count: s._count._all })),
    devices: devices.map((s) => ({ key: s.device ?? "UNKNOWN", count: s._count._all })),
    recent: recent.map((r) => ({ id: r.id, at: r.createdAt, who: (r.actorId && who.get(r.actorId)?.name) || "System", action: r.action, module: moduleOf(r.action) })),
  };
}
