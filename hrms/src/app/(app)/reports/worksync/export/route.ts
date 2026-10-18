import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { csv, csvResponse } from "@/lib/csv";
import { getMyEmployee } from "@/lib/employees";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { isHr } from "@/lib/scope";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, formatTime } from "@/lib/time";
import { loadReportData, nameMap, projectScope } from "@/lib/worksync-data";
import { cardContributors, cycleTime, formatHours, personReport, rangeOf } from "@/lib/worksync-report";

const RANGES = [7, 30, 90];

export async function GET(req: Request) {
  const me = await requireUser("/reports");
  const url = new URL(req.url);
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);

  const scope = await projectScope(me, mine.id);
  const projects = await prisma.wsProject.findMany({
    where: { ...scope, archivedAt: null },
    select: { id: true, name: true },
  });
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length === 0) {
    return new Response("No projects found", { status: 404 });
  }

  const type = url.searchParams.get("type") === "people" ? "people" : "cards";
  const showAll = isHr(me.role.key) || me.role.key === ROLES.MANAGER;
  if (type === "people" && !showAll) {
    return new Response("Only leads, managers and HR can download the people report.", { status: 403 });
  }

  const asked = Number(url.searchParams.get("r"));
  const days = RANGES.includes(asked) ? asked : 30;
  const today = dayKey(new Date(), tz);
  const r = rangeOf(today, days);

  const { cards, events } = await loadReportData(projectIds);
  const names = await nameMap([
    ...new Set([
      ...cards.flatMap((c) => [c.createdById, ...(c.completedById ? [c.completedById] : []), ...c.assigneeKeys]),
      ...events.map((e) => e.actorId),
    ]),
  ]);
  const name = (k: string) => names.get(k) ?? "Former user";
  const stamp = (d: Date | null) => (d ? `${dayKey(d, tz)} ${formatTime(d, tz)}` : "");
  const file = `worksync-all-projects-${type}-${r.from}-to-${r.to}.csv`;

  await audit(me.id, "reports.worksync_exported", "WsProject", "all", { type, days, projectsCount: projectIds.length }, me.organizationId);

  if (type === "people") {
    const rows = personReport(cards, events, r, tz, today);
    return csvResponse(
      file,
      csv([
        [
          "Person",
          "Cards added",
          "Cards resolved",
          "Resolved on time",
          "Assigned, open",
          "Assigned, finished",
          "Overdue",
          "Average progress %",
          "Comments",
          "Moves",
          "Checklist steps done",
          "Active days",
          `Period ${r.from} to ${r.to}`,
        ],
        ...rows.map((p) => [
          name(p.key),
          p.added,
          p.resolved,
          p.resolvedOnTime,
          p.assignedOpen,
          p.assignedDone,
          p.overdue,
          p.avgProgress,
          p.comments,
          p.moves,
          p.steps,
          p.activeDays,
          "",
        ]),
      ])
    );
  }

  const cy = cycleTime(cards, r, tz);
  return csvResponse(
    file,
    csv([
      [
        "Card",
        "Project",
        "Status (list)",
        "Added by",
        "Added at",
        "Resolved by",
        "Resolved at",
        "Time to resolve",
        "Due date",
        "Assigned to",
        "Worked on by",
        "Progress %",
      ],
      ...cards
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((c) => {
          const done = c.category === "DONE" && c.completedAt;
          const workers = cardContributors(c, events)
            .filter((p) => p.actions > 0)
            .map((p) => name(p.actorId));
          return [
            c.title,
            c.projectName,
            c.listName,
            name(c.createdById),
            stamp(c.createdAt),
            done && c.completedById ? name(c.completedById) : "",
            done ? stamp(c.completedAt) : "",
            done ? formatHours(Math.max(0, (c.completedAt!.getTime() - c.createdAt.getTime()) / 3_600_000)) : "",
            c.dueDay ?? "",
            c.assigneeKeys.map(name).join("; "),
            workers.join("; "),
            c.progress,
          ];
        }),
      [],
      [`Average time to resolve (${r.from} to ${r.to})`, cy ? formatHours(cy.avgHours) : "none resolved"],
    ])
  );
}
