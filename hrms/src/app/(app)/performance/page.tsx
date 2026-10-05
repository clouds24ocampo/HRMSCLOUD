import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { formatDay, keyOfDbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { AcknowledgeButton, CloseCycleButton, CreateCycleForm, GoalForm, GoalProgress, RATING_LABEL, RatingForm } from "./PerformanceForms";

const STAGE = { SELF: "Waiting for self-assessment", MANAGER: "Waiting for the manager", FINAL: "Waiting for HR's final rating", DONE: "Done" } as const;
const GOAL_STATUS = { ACTIVE: ["In progress", "brand"], ACHIEVED: ["Achieved", "success"], DROPPED: ["Dropped", "neutral"] } as const;

function Ratings({ r }: { r: { selfRating: number | null; selfComment: string | null; managerRating: number | null; managerComment: string | null; finalRating: number | null; finalComment: string | null } }) {
  const rows: [string, number | null, string | null][] = [["Self-assessment", r.selfRating, r.selfComment], ["Manager", r.managerRating, r.managerComment], ["Final", r.finalRating, r.finalComment]];
  return (
    <dl className="mt-2 space-y-2 text-sm">
      {rows.filter(([, n]) => n).map(([label, n, c]) => (
        <div key={label} className="rounded-lg bg-bg p-3">
          <dt className="font-medium">{label}: {n} · {RATING_LABEL[n!]}</dt>
          {c && <dd className="mt-1 text-muted">{c}</dd>}
        </div>
      ))}
    </dl>
  );
}

export default async function PerformancePage() {
  const me = await requireUser("/performance");
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const hr = isHr(me.role.key);
  const manager = me.role.key === ROLES.MANAGER;
  const orgId = me.organizationId;
  const fmt = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric", year: "numeric" });

  const scope = await employeeScope(me, mine.id);
  const team = hr || manager ? await prisma.employee.findMany({ where: { AND: [scope, { id: { not: mine.id } }, { status: { not: "SEPARATED" } }] }, select: { id: true, firstName: true, lastName: true, employeeNo: true }, orderBy: { lastName: "asc" }, take: 300 }) : [];
  const teamIds = team.map((t) => t.id);

  const [myReviews, myGoals, waiting, finalReady, cycles, teamGoals] = await Promise.all([
    prisma.review.findMany({ where: { organizationId: orgId, employeeId: mine.id }, include: { cycle: true }, orderBy: { cycle: { startDate: "desc" } } }),
    prisma.goal.findMany({ where: { organizationId: orgId, employeeId: mine.id }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    hr || manager
      ? prisma.review.findMany({
          where: { organizationId: orgId, stage: "MANAGER", cycle: { status: "OPEN" }, employeeId: { not: mine.id }, ...(hr ? {} : { reviewerId: mine.id }) },
          include: { cycle: true, employee: { select: { firstName: true, lastName: true } } },
        })
      : [],
    hr ? prisma.review.findMany({ where: { organizationId: orgId, stage: "FINAL", cycle: { status: "OPEN" } }, include: { cycle: true, employee: { select: { firstName: true, lastName: true } } } }) : [],
    hr ? prisma.reviewCycle.findMany({ where: { organizationId: orgId }, orderBy: { startDate: "desc" }, include: { reviews: { select: { stage: true } } }, take: 12 }) : [],
    hr || manager ? prisma.goal.findMany({ where: { organizationId: orgId, employeeId: { in: teamIds } }, include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 }) : [],
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Performance" subtitle="Goals during the year, and review cycles: self-assessment, then your manager, then a final rating." />

      {/* My review */}
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">My reviews</h2>
        {myReviews.length === 0 ? (
          <p className="text-sm text-muted">No review cycle has included you yet.</p>
        ) : (
          myReviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{r.cycle.name} <span className="text-sm font-normal text-muted">{fmt(r.cycle.startDate)} – {fmt(r.cycle.endDate)}</span></p>
                <Badge tone={r.stage === "DONE" ? "success" : "warning"}>{STAGE[r.stage]}</Badge>
              </div>
              {r.stage === "SELF" && r.cycle.status === "OPEN" && (
                <div className="mt-3"><RatingForm reviewId={r.id} step="self" button="Submit my self-assessment" /></div>
              )}
              {r.stage !== "SELF" && <Ratings r={r} />}
              {r.stage === "DONE" && (r.acknowledgedAt ? <p className="mt-3 text-sm text-success">You acknowledged this review on {fmt(r.acknowledgedAt)}.</p> : <div className="mt-3"><AcknowledgeButton id={r.id} /></div>)}
            </div>
          ))
        )}
      </Card>

      {/* Manager and HR work */}
      {waiting.length > 0 && (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">Evaluations waiting for you <Badge tone="warning">{waiting.length}</Badge></h2>
          {waiting.map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-4">
              <p className="font-medium">{r.employee.firstName} {r.employee.lastName} <span className="text-sm font-normal text-muted">· {r.cycle.name}</span></p>
              <Ratings r={r} />
              <div className="mt-3"><RatingForm reviewId={r.id} step="manager" button="Submit my evaluation" /></div>
            </div>
          ))}
        </Card>
      )}
      {finalReady.length > 0 && (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">Ready for the final rating <Badge tone="warning">{finalReady.length}</Badge></h2>
          {finalReady.map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-4">
              <p className="font-medium">{r.employee.firstName} {r.employee.lastName} <span className="text-sm font-normal text-muted">· {r.cycle.name}</span></p>
              <Ratings r={r} />
              <div className="mt-3"><RatingForm reviewId={r.id} step="final" defaultRating={r.managerRating ?? r.selfRating ?? undefined} button="Save the final rating" /></div>
            </div>
          ))}
        </Card>
      )}

      {hr && (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Review cycles</h2>
            {cycles.length === 0 ? <EmptyState title="No cycles yet" hint="Start one to ask everyone for a self-assessment." /> : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {cycles.map((c) => {
                  const count = (s: string) => c.reviews.filter((r) => r.stage === s).length;
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                      <div>
                        <p className="font-medium">{c.name} <Badge tone={c.status === "OPEN" ? "success" : "neutral"}>{c.status === "OPEN" ? "Open" : "Closed"}</Badge></p>
                        <p className="text-muted">Self {count("SELF")} · Manager {count("MANAGER")} · Final {count("FINAL")} · Done {count("DONE")}</p>
                      </div>
                      {c.status === "OPEN" && <CloseCycleButton id={c.id} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="h-fit">
            <h2 className="mb-3 text-lg font-semibold">Start a review cycle</h2>
            <CreateCycleForm />
          </Card>
        </div>
      )}

      {/* Goals */}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">My goals</h2>
          {myGoals.length === 0 ? <p className="text-sm text-muted">No goals yet. Add one.</p> : (
            <ul className="space-y-3">
              {myGoals.map((g) => (
                <li key={g.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{g.title}</p>
                    <Badge tone={GOAL_STATUS[g.status][1]}>{GOAL_STATUS[g.status][0]}</Badge>
                  </div>
                  {g.description && <p className="text-sm text-muted">{g.description}</p>}
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full rounded-full bg-brand" style={{ width: `${g.progress}%` }} /></div>
                  <p className="mt-1 text-xs text-muted">{g.progress}%{g.targetDate ? ` · target ${fmt(g.targetDate)}` : ""}</p>
                  <GoalProgress id={g.id} progress={g.progress} status={g.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="h-fit">
          <h2 className="mb-3 text-lg font-semibold">Add a goal</h2>
          <GoalForm people={hr || manager ? team.map((t) => ({ id: t.id, label: `${t.lastName}, ${t.firstName} · ${t.employeeNo}` })) : undefined} />
        </Card>
      </div>

      {(hr || manager) && (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">{hr ? "Everyone's goals" : "My team's goals"}</h2>
          {teamGoals.length === 0 ? <p className="text-sm text-muted">No goals set for your team yet.</p> : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {teamGoals.map((g) => (
                <li key={g.id} className="px-3 py-3 text-sm">
                  <p><span className="font-medium">{g.employee.firstName} {g.employee.lastName}</span> · {g.title} <Badge tone={GOAL_STATUS[g.status][1]}>{GOAL_STATUS[g.status][0]}</Badge> <span className="text-muted">{g.progress}%</span></p>
                  <GoalProgress id={g.id} progress={g.progress} status={g.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
