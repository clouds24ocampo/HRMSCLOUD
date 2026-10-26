import { Icon, ICON_INLINE } from "@/components/Icon";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { addDays, dayKey, formatDay, formatTime, keyOfDbDate, zonedTimeToUtc } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, Stat, ghostClass } from "@/components/ui";
import { cardFacts, FACTS_INCLUDE, personName, projectScope } from "@/lib/worksync-data";
import { CATEGORY_LABEL, CATEGORY_TONE, KIND_LABEL, PRIORITY_LABEL, PRIORITY_TONE, summarize, themeGradient, type Category } from "@/lib/worksync";
import { Facepile } from "./parts";
import { NewProjectForm } from "./NewProjectForm";
import { Progress } from "./Progress";

const VIEWS = [["projects", "Projects"], ["mine", "My tasks"], ["today", "Daily activity"]] as const;
const isKey = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const EVENT_LABEL: Record<string, string> = {
  CARD_CREATED: "added a card", MOVED: "moved", DONE: "finished", BLOCKED: "marked blocked", COMMENTED: "commented on", ASSIGNED: "changed assignees on",
  CHECKED: "updated the checklist of", EDITED: "edited", ARCHIVED: "archived", PROJECT_CREATED: "started the project", PROJECT_ARCHIVED: "archived the project",
  MEMBER_ADDED: "added a member to the project", MEMBER_REMOVED: "removed a member from the project",
};

export default async function WorkSyncPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const me = await requireUser("/worksync");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const today = dayKey(new Date(), tz);
  const lead = isHr(me.role.key) || me.role.key === ROLES.MANAGER;
  const view = VIEWS.some(([k]) => k === sp.view) ? sp.view! : "projects";
  const scope = await projectScope(me, mine.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="WorkSync" subtitle="Projects, tasks and daily progress in one place. Everyone sees the same board; what you can change depends on your role in the project." action={lead ? <NewProjectForm /> : undefined} />
      <nav aria-label="WorkSync views" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 text-sm font-medium">
        {VIEWS.map(([k, label]) => (
          <Link key={k} href={`/worksync?view=${k}`} aria-current={view === k ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-2 transition ${view === k ? "bg-brand text-brand-ink" : "text-muted hover:bg-bg"}`}>
            {label}
          </Link>
        ))}
        <Link href="/reports?tab=worksync" className="ml-auto whitespace-nowrap rounded-lg px-4 py-2 text-muted transition hover:bg-bg hover:text-ink">
          <Icon name="reports" className={ICON_INLINE} /> Reports & Analytics →
        </Link>
      </nav>
      {view === "projects" && <Projects scope={scope} today={today} />}
      {view === "mine" && <MyCards organizationId={me.organizationId} mineId={mine.id} today={today} />}
      {view === "today" && <DailyActivity scope={scope} meId={me.id} lead={lead} tz={tz} today={today} date={isKey(sp.date) ? sp.date! : today} />}
    </div>
  );
}

async function Projects({ scope, today }: { scope: Awaited<ReturnType<typeof projectScope>>; today: string }) {
  const projects = await prisma.wsProject.findMany({
    where: { ...scope, archivedAt: null },
    include: {
      members: { include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
      cards: { where: { archivedAt: null }, include: FACTS_INCLUDE },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (projects.length === 0) return <EmptyState title="No projects yet" hint="A project appears here when you are added to it. HR and managers start projects with “New project”." />;
  const rows = projects.map((p) => ({ p, s: summarize(p.cards.map(cardFacts), today) }));
  const sum = (f: (s: (typeof rows)[number]["s"]) => number) => rows.reduce((n, r) => n + f(r.s), 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Projects" value={projects.length} />
        <Stat label="Blocked cards" value={sum((s) => s.by.BLOCKED)} tone={sum((s) => s.by.BLOCKED) ? "danger" : undefined} hint={sum((s) => s.by.BLOCKED) ? "needs help" : undefined} />
        <Stat label="Overdue cards" value={sum((s) => s.overdue)} tone={sum((s) => s.overdue) ? "warning" : undefined} hint={sum((s) => s.overdue) ? "past due date" : undefined} />
        <Stat label="Stuck cards" value={sum((s) => s.stuck)} hint="no change for 3 days" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(({ p, s }) => (
          <Link key={p.id} href={`/worksync/${p.id}`} className="group block overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line transition hover:shadow-lg hover:ring-brand/40">
            <div className="flex items-start justify-between gap-3 px-5 py-4 text-white" style={{ backgroundImage: themeGradient(p.color) }}>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{p.name}</h2>
                <p className="text-sm text-white/85">{KIND_LABEL[p.kind]}{p.dueDate ? ` · due ${formatDay(keyOfDbDate(p.dueDate), { month: "short", day: "numeric", year: "numeric" })}` : ""}</p>
              </div>
              <span className="text-2xl font-bold tabular-nums">{s.percent}%</span>
            </div>
            <div className="space-y-3 p-5">
              <Progress percent={s.percent} />
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(["TODO", "DOING", "BLOCKED", "DONE"] as Category[]).map((c) => <Badge key={c} tone={CATEGORY_TONE[c]}>{CATEGORY_LABEL[c]} {s.by[c]}</Badge>)}
                {s.overdue > 0 && <Badge tone="warning">{s.overdue} overdue</Badge>}
                {s.stuck > 0 && <Badge tone="neutral">{s.stuck} stuck</Badge>}
              </div>
              <div className="flex items-center justify-between gap-2" aria-label={`${p.members.length} people`}>
                <Facepile people={p.members.map((m) => m.employee)} max={6} size={28} />
                <span className="text-xs font-semibold text-brand opacity-0 transition group-hover:opacity-100">Open board →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

async function MyCards({ organizationId, mineId, today }: { organizationId: string; mineId: string; today: string }) {
  const cards = await prisma.wsCard.findMany({
    where: { organizationId, archivedAt: null, assignees: { some: { employeeId: mineId } }, project: { archivedAt: null } },
    include: { list: { select: { name: true, category: true } }, project: { select: { id: true, name: true } } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
  });
  if (cards.length === 0) {
    return (
      <EmptyState
        title="No tasks assigned to you"
        hint="Tasks (cards) assigned to you across all projects will appear here. Open any project to create cards and assign team members."
        action={
          <Link href="/worksync?view=projects" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:opacity-90">
            Open Projects →
          </Link>
        }
      />
    );
  }
  const open = cards.filter((c) => c.list.category !== "DONE");
  const done = cards.filter((c) => c.list.category === "DONE");
  const Row = ({ c }: { c: (typeof cards)[number] }) => {
    const due = c.dueDate ? keyOfDbDate(c.dueDate) : null;
    return (
      <li>
        <Link href={`/worksync/${c.project.id}?card=${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition hover:bg-bg">
          <span className="min-w-0"><span className="block truncate font-medium">{c.title}</span><span className="text-sm text-muted">{c.project.name} · {c.list.name}</span></span>
          <span className="flex items-center gap-2">
            {c.priority !== "NORMAL" && <Badge tone={PRIORITY_TONE[c.priority]}>{PRIORITY_LABEL[c.priority]}</Badge>}
            <Badge tone={CATEGORY_TONE[c.list.category]}>{CATEGORY_LABEL[c.list.category]}</Badge>
            {due && <Badge tone={c.list.category !== "DONE" && due < today ? "danger" : "neutral"}>{formatDay(due)}</Badge>}
          </span>
        </Link>
      </li>
    );
  };
  return (
    <div className="space-y-4">
      <Card className="p-0"><h2 className="px-5 pt-5 font-semibold">To finish ({open.length})</h2><ul className="mt-2 divide-y divide-line">{open.map((c) => <Row key={c.id} c={c} />)}</ul>{open.length === 0 && <p className="px-5 pb-5 text-sm text-muted">All caught up.</p>}</Card>
      {done.length > 0 && <Card className="p-0"><h2 className="px-5 pt-5 font-semibold">Finished ({done.length})</h2><ul className="mt-2 divide-y divide-line">{done.map((c) => <Row key={c.id} c={c} />)}</ul></Card>}
    </div>
  );
}

// Who did what on the boards, for one day. Only deliberate actions appear here: nothing is tracked in the background.
// HR and managers see everyone in the projects they can open; everyone else sees their own actions.
async function DailyActivity({ scope, meId, lead, tz, today, date }: { scope: Awaited<ReturnType<typeof projectScope>>; meId: string; lead: boolean; tz: string; today: string; date: string }) {
  const from = zonedTimeToUtc(date, 0, tz);
  const to = zonedTimeToUtc(addDays(date, 1), 0, tz);
  const projects = await prisma.wsProject.findMany({
    where: { ...scope, archivedAt: null },
    select: { id: true, name: true, members: { where: { role: { not: "VIEWER" } }, select: { employee: { select: { id: true, firstName: true, lastName: true, userId: true } } } } },
  });
  const byProject = new Map(projects.map((p) => [p.id, p.name]));
  const events = await prisma.wsActivity.findMany({
    where: { projectId: { in: [...byProject.keys()] }, createdAt: { gte: from, lt: to }, ...(lead ? {} : { actorId: meId }) },
    orderBy: { createdAt: "asc" },
  });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(events.map((e) => e.actorId))] } }, select: { id: true, name: true } });
  const name = new Map(users.map((u) => [u.id, u.name]));
  const byActor = new Map<string, typeof events>();
  for (const e of events) byActor.set(e.actorId, [...(byActor.get(e.actorId) ?? []), e]);

  // People working on these projects who did nothing on the boards that day: a follow-up list, not a score.
  const quiet = new Map<string, { id: string; name: string }>();
  if (lead) for (const p of projects) for (const m of p.members) if (m.employee.userId && !byActor.has(m.employee.userId)) quiet.set(m.employee.id, { id: m.employee.id, name: personName(m.employee) });

  return (
    <div className="space-y-4">
      <Card>
        <form className="flex flex-wrap items-end gap-3" action="/worksync">
          <input type="hidden" name="view" value="today" />
          <div className="text-sm font-medium">
            <label htmlFor="ws-day">Day</label>
            <div className="mt-1 flex items-stretch gap-2">
              <input id="ws-day" type="date" name="date" defaultValue={date} max={today} className="block rounded-lg border border-line bg-surface px-3 py-2" />
              <button className={ghostClass}>Show</button>
            </div>
          </div>
          <p className="ml-auto max-w-md text-xs text-muted">Shows what people did on the boards: cards added, moved, finished, blocked, commented. Nothing is tracked in the background, and this is not a score.</p>
        </form>
      </Card>
      {byActor.size === 0 ? (
        <EmptyState title="No board activity" hint={`Nothing was done on the boards on ${formatDay(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`} />
      ) : (
        [...byActor.entries()].map(([actorId, list]) => {
          const n = (t: string) => list.filter((e) => e.type === t).length;
          return (
            <Card key={actorId} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{name.get(actorId) ?? "Former user"}</h2>
                <p className="flex flex-wrap gap-1.5 text-xs">
                  <Badge tone="success">{n("DONE")} finished</Badge><Badge tone="brand">{n("MOVED")} moved</Badge>
                  {n("BLOCKED") > 0 && <Badge tone="danger">{n("BLOCKED")} blocked</Badge>}<Badge>{n("COMMENTED")} comments</Badge>
                </p>
              </div>
              <ul className="divide-y divide-line text-sm">
                {list.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                    <span>
                      {EVENT_LABEL[e.type] ?? e.type.toLowerCase()}{" "}
                      {e.cardId ? <Link href={`/worksync/${e.projectId}?card=${e.cardId}`} className="font-medium text-brand hover:underline">{e.cardTitle}</Link> : <span className="font-medium">{e.detail}</span>}
                      {e.cardId && e.detail && <span className="text-muted"> · {e.detail}</span>}
                      <span className="text-muted"> · {byProject.get(e.projectId)}</span>
                    </span>
                    <span className="text-xs tabular-nums text-muted">{formatTime(e.createdAt, tz)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
      {lead && quiet.size > 0 && (
        <Card>
          <h2 className="font-semibold">No board activity this day</h2>
          <p className="mt-1 text-xs text-muted">People working on your projects who did nothing on a board. Check their <Link href="/daily-report" className="text-brand hover:underline">daily report</Link> or ask: they may have been on leave, in the field or working off the board.</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">{[...quiet.values()].map((q) => <li key={q.id}><Link href={`/daily-report?employee=${q.id}`} className="rounded-full border border-line px-3 py-1 hover:bg-bg">{q.name}</Link></li>)}</ul>
        </Card>
      )}
    </div>
  );
}
