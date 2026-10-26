import { Icon } from "@/components/Icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { dayKey, formatDay, keyOfDbDate } from "@/lib/time";
import { filterable, dayOf, loadCards, loadProject, serverNow } from "@/lib/worksync-data";
import { KIND_LABEL, STUCK_DAYS, dueState, filtersActive, matchesFilters, parseFilters, personName, summarize, themeGradient } from "@/lib/worksync";
import { cardFacts } from "@/lib/worksync-data";
import { Board, type BoardList } from "../Board";
import { CardDetail } from "../CardDetail";
import { FilterBar } from "../FilterBar";
import { PANELS, PanelContent, type PanelName } from "../Panels";
import { Sheet } from "../Sheet";
import { Facepile } from "../parts";
import { CalendarView } from "../views/CalendarView";
import { DashboardView } from "../views/DashboardView";
import { ReportsView } from "../views/ReportsView";
import { TableView } from "../views/TableView";
import { TimelineView } from "../views/TimelineView";
import type { ViewCtx } from "../views/types";

const VIEWS = [
  { key: "board", label: "Board", icon: "cards" },
  { key: "table", label: "Table", icon: "table" },
  { key: "timeline", label: "Timeline", icon: "timeline" },
  { key: "calendar", label: "Calendar", icon: "schedule" },
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "reports", label: "Reports", icon: "reports" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

const short = (key: string) => formatDay(key, { month: "short", day: "numeric" });

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser("/worksync");
  const { id } = await params;
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const loaded = await loadProject(me, mine.id, id);
  if (!loaded) notFound(); // outside your reach looks the same as missing
  const { project, level, myRole } = loaded;
  const today = dayKey(new Date(), tz);
  const canEdit = level !== "VIEW";
  const canManage = level === "MANAGE";
  const view: ViewKey = VIEWS.some((v) => v.key === sp.view) ? (sp.view as ViewKey) : "board";
  const panel = PANELS.some((p) => p.key === sp.panel) ? (sp.panel as PanelName) : null;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7);
  const filters = parseFilters(sp);

  // The URL of this page with some parameters changed. Filters, view and month carry over on their own.
  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v && ["view", "q", "who", "label", "pri", "m", "r", "card", "panel"].includes(k)) next.set(k, v);
    if (next.get("view") === "board") next.delete("view");
    const qs = next.toString();
    return `/worksync/${id}${qs ? `?${qs}` : ""}`;
  };

  const allCards = await loadCards(id);
  const cards = allCards.filter((c) => matchesFilters(filterable(c), filters, mine.id));
  const members = project.members.map((m) => ({ employeeId: m.employeeId, userId: m.employee.userId, firstName: m.employee.firstName, lastName: m.employee.lastName, role: m.role }));
  const now = serverNow();
  const stats = summarize(allCards.map(cardFacts), today, now);
  const names = new Map<string, string>();
  const ctx: ViewCtx = { projectId: id, today, now, names, tz, lists: project.lists, labels: project.labels, members, cards, canEdit, canManage, selected: sp.card, filtered: filtersActive(filters), href };
  const closeHref = href({ card: null, panel: null });

  // A card opened over the page (it may be one the filters hide).
  const open = sp.card
    ? await prisma.wsCard.findFirst({
        where: { id: sp.card, projectId: id, archivedAt: null, list: { archivedAt: null } },
        include: { list: true, assignees: { select: { employeeId: true } }, labels: { select: { labelId: true } }, checklist: { orderBy: { position: "asc" } }, comments: { orderBy: { createdAt: "desc" } } },
      })
    : null;
  const activity = panel === "activity" ? await prisma.wsActivity.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 60 }) : [];
  const cardEvents = open ? await prisma.wsActivity.findMany({ where: { projectId: id, cardId: open.id }, orderBy: { createdAt: "desc" }, take: 500 }) : [];
  const cardActivity = cardEvents.slice(0, 100);
  const userIds = [...new Set([...allCards.map((c) => c.createdById), ...activity.map((a) => a.actorId), ...cardEvents.map((a) => a.actorId), ...(open?.completedById ? [open.completedById] : []), ...(open?.comments.map((c) => c.authorId) ?? [])])];
  const who = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  for (const [k, v] of who) names.set(k, v);

  // Who can still be added: HR anyone active in the company, a manager their own chain.
  const people = panel === "people" && canManage
    ? (await prisma.employee.findMany({
        where: { ...(await employeeScope(me, mine.id)), status: { in: ["ACTIVE", "ON_LEAVE"] }, id: { notIn: project.members.map((m) => m.employeeId) } },
        select: { id: true, firstName: true, lastName: true, employeeNo: true },
        orderBy: { firstName: "asc" },
      })).map((e) => ({ id: e.id, name: `${personName(e)} (${e.employeeNo})` }))
    : [];

  const labelById = new Map(project.labels.map((l) => [l.id, l]));
  const board: BoardList[] = project.lists.map((l) => ({
    id: l.id,
    name: l.name,
    category: l.category,
    cards: cards.filter((c) => c.listId === l.id).map((c) => {
      const due = dayOf(c.dueDate);
      return {
        id: c.id,
        title: c.title,
        href: href({ card: c.id }),
        priority: c.priority,
        labels: c.labels.map((x) => labelById.get(x.labelId)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ name: x.name, color: x.color })),
        due: due ? { label: short(due), state: dueState(due, today, l.category) } : null,
        assignees: c.assignees.map((a) => a.employee),
        checkDone: c.checklist.filter((k) => k.done).length,
        checkTotal: c.checklist.length,
        comments: c._count.comments,
        stuck: l.category !== "DONE" && now - c.updatedAt.getTime() > STUCK_DAYS * 86_400_000,
        hasDescription: !!c.description,
        creator: who.get(c.createdById) ?? null,
      };
    }),
  }));

  const tab = (active: boolean) => `inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${active ? "bg-white text-slate-900 shadow" : "text-white/90 hover:bg-white/20"}`;
  const header = (
    <div className="space-y-4 text-white" id="top">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/worksync" className="text-sm font-medium text-white/80 hover:text-white hover:underline">← All projects</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{project.name}</h1>
          <p className="mt-0.5 text-sm text-white/85">
            {KIND_LABEL[project.kind]}{project.dueDate ? ` · target ${formatDay(keyOfDbDate(project.dueDate), { month: "long", day: "numeric", year: "numeric" })}` : ""}{project.archivedAt ? " · archived (read only)" : ""}
          </p>
          {project.description && <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-white/80">{project.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <div className="w-40">
              <p className="text-right text-sm font-bold tabular-nums">{stats.percent}% complete</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${stats.percent}%` }} /></div>
            </div>
            <Link href={href({ panel: "people", card: null })} scroll={false} aria-label={`${members.length} people on this project`} className="rounded-full p-0.5 hover:bg-white/20"><Facepile people={members} max={5} size={30} /></Link>
          </div>
          <nav aria-label="Project menu" className="flex flex-wrap justify-end gap-1">
            {PANELS.map((p) => <Link key={p.key} href={href({ panel: p.key, card: null })} scroll={false} className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/30"><Icon name={p.icon} className="h-3.5 w-3.5 inline align-text-bottom" /> {p.label}</Link>)}
          </nav>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Views" className="flex flex-wrap gap-1 rounded-xl bg-black/15 p-1">
          {VIEWS.map((v) => <Link key={v.key} href={href({ view: v.key, card: null, panel: null })} scroll={false} aria-current={view === v.key ? "page" : undefined} className={tab(view === v.key)}><Icon name={v.icon} className="h-4 w-4" />{v.label}</Link>)}
        </nav>
        <Suspense fallback={null}><FilterBar people={members.filter((m) => m.role !== "VIEWER").map((m) => ({ id: m.employeeId, name: personName(m) }))} labels={project.labels.map((l) => ({ id: l.id, name: l.name }))} /></Suspense>
      </div>
      {ctx.filtered && <p className="text-sm text-white/90" role="status">Showing {cards.length} of {allCards.length} cards. <Link href={href({ q: null, who: null, label: null, pri: null })} scroll={false} className="font-semibold underline">Clear filters</Link></p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-[110rem] space-y-5">
      <div className="rounded-2xl p-4 shadow-lg sm:p-5" style={{ backgroundImage: themeGradient(project.color) }}>
        {header}
        {view === "board" && (
          <div className="mt-5">
            <Board projectId={id} lists={board} canEdit={canEdit} canManage={canManage} selected={open?.id} />
          </div>
        )}
      </div>

      {!canEdit && <p className="text-sm text-muted">You can look and comment, but not change cards{myRole === "VIEWER" ? " (you are a viewer on this project)" : " (you are looking from above the team)"}.</p>}

      {view === "table" && <TableView ctx={ctx} />}
      {view === "timeline" && <TimelineView ctx={ctx} />}
      {view === "calendar" && <CalendarView ctx={ctx} month={month} />}
      {view === "dashboard" && <DashboardView ctx={ctx} />}
      {view === "reports" && <ReportsView ctx={ctx} days={[7, 30, 90].includes(Number(sp.r)) ? Number(sp.r) : 30} showAll={canManage || isHr(me.role.key) || me.role.key === ROLES.MANAGER} meUserId={me.id} />}

      {open && (
        <Sheet closeHref={closeHref} label={`Card: ${open.title}`}>
          <CardDetail ctx={ctx} card={open} who={who} activity={cardActivity} events={cardEvents} />
        </Sheet>
      )}
      {!open && panel && (
        <Sheet closeHref={closeHref} label={PANELS.find((p) => p.key === panel)!.label} side>
          <PanelContent panel={panel} ctx={ctx} project={project} members={project.members} people={people} activity={activity} who={who} />
        </Sheet>
      )}
    </div>
  );
}
