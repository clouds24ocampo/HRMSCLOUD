import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { canViewEmployee, employeeScope, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { addDays, dayKey, dbDate, formatDay, formatTime, keyOfDbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { DailyReportForm } from "./DailyReportForm";
import { ReportComments, type Author, type Comment } from "./ReportComments";

const isKey = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
type Report = { id: string; date: Date; createdAt: Date; accomplishments: string; issues: string | null; plans: string | null };

function ReportBody({ r }: { r: Report }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="whitespace-pre-line">{r.accomplishments}</p>
      {r.issues && <p className="whitespace-pre-line text-danger"><span className="font-semibold">Blockers:</span> {r.issues}</p>}
      {r.plans && <p className="whitespace-pre-line text-muted"><span className="font-semibold">Next:</span> {r.plans}</p>}
    </div>
  );
}

// Several reports on one day: the newest counts, the older ones are marked replaced.
const latestFirst = (a: Report, b: Report) => b.createdAt.getTime() - a.createdAt.getTime();

export default async function DailyReportPage({ searchParams }: { searchParams: Promise<{ employee?: string; date?: string }> }) {
  const me = await requireUser("/daily-report");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const today = dayKey(new Date(), settings.timezone);
  const lead = isHr(me.role.key) || me.role.key === ROLES.MANAGER;
  const fmt = (d: Date) => formatDay(keyOfDbDate(d), { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  // One person's history: yourself, or someone you may see.
  const personId = sp.employee ?? mine.id;
  if (!(await canViewEmployee(me, mine.id, personId))) notFound();
  const person = personId === mine.id ? null : await prisma.employee.findFirst({ where: { id: personId, organizationId: me.organizationId }, select: { firstName: true, lastName: true } });
  const [todays, history] = await Promise.all([
    prisma.dailyReport.findFirst({ where: { organizationId: me.organizationId, employeeId: mine.id, date: dbDate(today) }, select: { id: true } }),
    prisma.dailyReport.findMany({ where: { organizationId: me.organizationId, employeeId: personId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 60 }),
  ]);
  const replaced = new Set(history.filter((r, i) => history.findIndex((x) => keyOfDbDate(x.date) === keyOfDbDate(r.date)) !== i).map((r) => r.id));

  // The team's reports for one day: everyone below you (HR: everyone).
  const day = isKey(sp.date) && sp.date! <= today ? sp.date! : today;
  let team: { id: string; name: string; report: Report | null }[] = [];
  if (lead) {
    const scope = await employeeScope(me, mine.id);
    const people = await prisma.employee.findMany({
      where: { AND: [scope, { id: { not: mine.id } }, { status: { in: ["ACTIVE", "ON_LEAVE"] } }] },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    });
    const reports = await prisma.dailyReport.findMany({ where: { organizationId: me.organizationId, date: dbDate(day), employeeId: { in: people.map((p) => p.id) } } });
    const byEmp = new Map<string, Report>();
    for (const r of [...reports].sort(latestFirst).reverse()) byEmp.set(r.employeeId, r); // the newest wins
    team = people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, report: byEmp.get(p.id) ?? null }));
  }
  const submitted = team.filter((t) => t.report).length;

  // Every comment under the reports on this page, with who wrote them.
  const reportIds = [...history.map((r) => r.id), ...team.flatMap((t) => (t.report ? [t.report.id] : []))];
  const allComments = reportIds.length
    ? await prisma.dailyReportComment.findMany({ where: { organizationId: me.organizationId, reportId: { in: reportIds } }, orderBy: { createdAt: "asc" } })
    : [];
  const authors = new Map<string, Author>(
    (await prisma.user.findMany({ where: { id: { in: [...new Set(allComments.map((c) => c.authorId))] } }, select: { id: true, name: true, role: { select: { name: true } } } })).map((u) => [u.id, { name: u.name, role: u.role.name }]),
  );
  const thread = (reportId: string) => (
    <ReportComments reportId={reportId} comments={allComments.filter((c) => c.reportId === reportId) as Comment[]} authors={authors} meId={me.id} tz={settings.timezone} />
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Daily report" subtitle="What you did today, what got in the way, and what comes next. Sent reports are final; send a new one to correct it. Your supervisor and HR can comment, and you can reply." />

      {!person && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Today · {formatDay(today, { weekday: "long", month: "long", day: "numeric" })} {todays ? <Badge tone="success">Submitted</Badge> : <Badge tone="warning">Not yet</Badge>}</h2>
          <DailyReportForm again={!!todays} />
        </Card>
      )}

      {lead && !person && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold">{isHr(me.role.key) ? "Everyone" : "My team"} · {formatDay(day, { month: "short", day: "numeric" })} <Badge tone={submitted === team.length ? "success" : "warning"}>{submitted} of {team.length} submitted</Badge></h2>
            <form className="flex items-end gap-2">
              <label className="text-sm font-medium">Day<input type="date" name="date" max={today} defaultValue={day} className={inputClass} /></label>
              <button className={buttonClass}>Show</button>
            </form>
          </div>
          {team.length === 0 ? <p className="text-sm text-muted">Nobody reports to you yet.</p> : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {team.map((t) => (
                <li key={t.id} className="px-3 py-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/daily-report?employee=${t.id}`} className="font-medium hover:underline">{t.name}</Link>
                    {t.report ? <Badge tone="success">Submitted</Badge> : <Badge tone="danger">Not submitted</Badge>}
                  </div>
                  {t.report && <ReportBody r={t.report} />}
                  {t.report && thread(t.report.id)}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">
            <Link href={`/daily-report?date=${addDays(day, -1)}`} className="font-medium text-brand hover:underline">← Previous day</Link>
          </p>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{person ? `${person.firstName} ${person.lastName}'s reports` : "My past reports"}</h2>
          {person && <Link href="/daily-report" className="text-sm font-medium text-brand hover:underline">Back to my reports</Link>}
        </div>
        {history.length === 0 ? <EmptyState title="No reports yet" /> : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {history.map((r) => (
              <li key={r.id} className="px-3 py-3">
                <p className="mb-1 flex flex-wrap items-center gap-2 font-medium">{fmt(r.date)} <span className="text-xs font-normal text-muted">sent {formatTime(r.createdAt, settings.timezone)}</span>{replaced.has(r.id) && <Badge>Replaced by a newer report</Badge>}</p>
                <div className={replaced.has(r.id) ? "opacity-60" : ""}><ReportBody r={r} /></div>
                {thread(r.id)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
