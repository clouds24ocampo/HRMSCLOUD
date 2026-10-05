import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { getClockInfo } from "@/lib/clock";
import { canAccess, ROLES } from "@/lib/roles";
import { MENU } from "@/lib/menu";
import { dayKey, dbDate, formatDay, zonedTimeToUtc, addDays } from "@/lib/time";
import { ClockCard } from "@/components/ClockCard";
import { Tilt } from "@/components/Tilt";
import { Alert } from "@/components/Fields";
import { Stat } from "@/components/ui";
import { hasRegular } from "@/lib/schedule";
import { loadSchedules, resolvePerson } from "@/lib/schedule-data";

const LINK_HINT: Record<string, string> = {
  "/employees": "People and their history",
  "/organization": "Departments and positions",
  "/schedule": "Plan who works when",
  "/dtr": "What was actually worked",
  "/leave": "Requests and balances",
  "/settings": "Work rules, shifts, leave types",
  "/admin/users": "Sign-ins and roles",
  "/audit": "Who did what, and when",
  "/overtime": "Ask for and approve overtime",
  "/payroll": "Periods, approval, payslips",
  "/payslips": "Your pay, line by line",
  "/recruitment": "Jobs, applicants, hiring",
  "/performance": "Goals and reviews",
  "/learning": "Courses and certificates",
  "/documents": "Contracts, IDs, certificates",
  "/requests": "Ask HR for something",
  "/announcements": "Post news for everyone",
  "/reports": "Headcount, attendance, cost",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const me = await requireUser("/dashboard");
  const { denied } = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const emp = await getMyEmployee(me, tz);
  const today = dayKey(new Date(), tz);
  const dayStart = zonedTimeToUtc(today, 0, tz);
  const dayEnd = zonedTimeToUtc(addDays(today, 1), 0, tz);
  const approver = isHr(me.role.key) || me.role.key === ROLES.MANAGER;

  const myTasks = await prisma.checklistItem.findMany({
    where: { employeeId: emp.id, organizationId: me.organizationId, kind: "ONBOARDING", owner: "EMPLOYEE", doneAt: null },
    select: { id: true, title: true },
    orderBy: { sortOrder: "asc" },
  });
  const news = await prisma.announcement.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 3 });
  const clock = await getClockInfo(me.organizationId, emp.id, tz);
  const myShift = await prisma.scheduleEntry.findUnique({
    where: { employeeId_date: { employeeId: emp.id, date: dbDate(today) } },
    select: { shift: { select: { name: true, startTime: true, endTime: true } } },
  });

  let stats: { overtime: number; requests: number; headcount: number; unscheduled: number; scheduled: number; clockedIn: number; onLeave: number; pending: number; flags: number } | null = null;
  if (approver) {
    const scope = await employeeScope(me, emp.id);
    const people = await prisma.employee.findMany({ where: { ...scope, status: { not: "SEPARATED" } }, select: { id: true } });
    const ids = people.map((p) => p.id);
    const [sched, ins, onLeave, pending, overtime, requests] = await Promise.all([
      loadSchedules(me.organizationId, ids, today, today),
      prisma.timeEvent.findMany({
        where: { organizationId: me.organizationId, employeeId: { in: ids }, type: "IN", voidedAt: null, at: { gte: dayStart, lt: dayEnd } },
        select: { employeeId: true, gpsStatus: true },
      }),
      prisma.leaveRequest.count({ where: { organizationId: me.organizationId, employeeId: { in: ids }, status: "APPROVED", startDate: { lte: dbDate(today) }, endDate: { gte: dbDate(today) } } }),
      prisma.leaveRequest.count({ where: { organizationId: me.organizationId, employeeId: { in: ids.filter((i) => i !== emp.id || me.role.key === ROLES.SUPER_ADMIN) }, status: "PENDING" } }),
      prisma.overtimeRequest.count({ where: { organizationId: me.organizationId, employeeId: { in: ids.filter((i) => i !== emp.id || me.role.key === ROLES.SUPER_ADMIN) }, status: "PENDING" } }),
      isHr(me.role.key) ? prisma.hrRequest.count({ where: { organizationId: me.organizationId, status: { not: "RESOLVED" }, employeeId: { not: emp.id } } }) : 0,
    ]);
    // Regular schedule plus today's changes, so the numbers match the Schedule page.
    const scheduled = ids.filter((id) => resolvePerson(sched.get(id), [today]).get(today)?.shift).length;
    const unscheduled = ids.filter((id) => !hasRegular(sched.get(id)?.regulars ?? [], today) && !sched.get(id)?.overrides.has(today)).length;
    stats = {
      overtime,
      requests,
      headcount: ids.length,
      unscheduled,
      scheduled,
      clockedIn: new Set(ins.map((i) => i.employeeId)).size,
      onLeave,
      pending,
      flags: ins.filter((i) => i.gpsStatus === "DENIED" || i.gpsStatus === "UNAVAILABLE" || i.gpsStatus === "LOW_ACCURACY").length,
    };
  }

  const links = MENU.flatMap((g) => g.items).filter((i) => i.href in LINK_HINT && canAccess(me.role.key, i.href) && i.href !== "/dtr" && i.href !== "/leave" && i.href !== "/schedule" && i.href !== "/dashboard");
  const quick = MENU.flatMap((g) => g.items).filter((i) => ["/dtr", "/schedule", "/leave"].includes(i.href));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hello, {me.name.split(" ")[0]}</h1>
        <p className="mt-1 text-muted">
          {formatDay(today, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
          {myShift ? (myShift.shift ? `your shift is ${myShift.shift.startTime}–${myShift.shift.endTime}` : "today is your day off") : "no shift planned for you today"}
        </p>
      </div>

      {denied && <Alert kind="error">You do not have permission to open that page.</Alert>}

      {myTasks.length > 0 && (
        <section aria-label="Your onboarding tasks" className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <h2 className="font-semibold">Welcome. {myTasks.length} thing{myTasks.length === 1 ? "" : "s"} for you to finish</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">{myTasks.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
          <Link href={`/employees/${emp.id}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">Open my checklist</Link>
        </section>
      )}

      {news.length > 0 && (
        <section aria-label="Announcements" className="space-y-2">
          {news.map((a) => (
            <article key={a.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <p className="font-semibold">{a.pinned && <span aria-label="pinned">📌 </span>}{a.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>
            </article>
          ))}
        </section>
      )}

      <ClockCard {...clock} timezone={tz} />

      {stats && (
        <section aria-label="Today at a glance">
          <h2 className="mb-3 text-lg font-semibold">{isHr(me.role.key) ? "Today across the organization" : "Today with your team"}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
            <Stat label="People" value={stats.headcount} tone={stats.unscheduled ? "warning" : undefined} hint={stats.unscheduled ? `${stats.unscheduled} without a schedule` : undefined} />
            <Stat label="Scheduled today" value={stats.scheduled} />
            <Stat label="Clocked in" value={stats.clockedIn} tone={stats.clockedIn >= stats.scheduled && stats.scheduled > 0 ? "success" : undefined} hint={stats.scheduled > stats.clockedIn ? `${stats.scheduled - stats.clockedIn} not yet` : undefined} />
            <Stat label="On leave" value={stats.onLeave} />
            <Stat label="Leave to decide" value={stats.pending} tone={stats.pending ? "warning" : "success"} hint={stats.pending ? "Waiting" : "All clear"} />
            <Stat label="Overtime to decide" value={stats.overtime} tone={stats.overtime ? "warning" : "success"} hint={stats.overtime ? "Waiting" : "All clear"} />
            {isHr(me.role.key) && <Stat label="HR requests" value={stats.requests} tone={stats.requests ? "warning" : "success"} hint={stats.requests ? "Waiting" : "All clear"} />}
            <Stat label="Location flags" value={stats.flags} tone={stats.flags ? "danger" : "success"} hint={stats.flags ? "Check DTR" : "None today"} />
          </div>
        </section>
      )}

      <section aria-label="Quick links" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...quick, ...links].map((l) => (
          <Tilt key={l.href}>
            <Link href={l.href} className="block h-full rounded-2xl border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-lg">
              <span className="text-3xl" aria-hidden>{l.icon}</span>
              <h3 className="mt-3 text-lg font-semibold">{l.label}</h3>
              <p className="mt-1 text-sm text-muted">{LINK_HINT[l.href] ?? ""}</p>
            </Link>
          </Tilt>
        ))}
      </section>
    </div>
  );
}
