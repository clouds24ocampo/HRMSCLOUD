import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canViewEmployee, employeeScope, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { addDays, dayKey, formatDay, formatDuration, formatDurationPrecise, keyOfDbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { computeDailyAdherence, summarizeDailyAdherence, VERDICT } from "@/lib/adherence";
import { loadDtr } from "@/lib/dtr-data";
import { loadTeamDtr } from "@/lib/team-dtr";
import { ScheduleAdherenceSection } from "./ScheduleAdherenceSection";
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

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ employee?: string; days?: string }> }) {
  const me = await requireUser("/performance");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  // Opened from someone's profile: show that person's reviews, goals, and schedule adherence (read-only), never your own.
  if (sp.employee && sp.employee !== mine.id) return <PersonPerformance meId={mine.id} employeeId={sp.employee} me={me} daysParam={sp.days} />;
  const hr = isHr(me.role.key);
  const manager = me.role.key === ROLES.MANAGER;
  const orgId = me.organizationId;
  const fmt = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric", year: "numeric" });

  const span = [7, 14, 30].includes(Number(sp.days)) ? Number(sp.days) : 14;
  const today = dayKey(new Date(), tz);
  const from = addDays(today, -(span - 1));

  const scope = await employeeScope(me, mine.id);
  const team = hr || manager ? await prisma.employee.findMany({ where: { AND: [scope, { id: { not: mine.id } }, { status: { not: "SEPARATED" } }] }, select: { id: true, firstName: true, lastName: true, employeeNo: true }, orderBy: { lastName: "asc" }, take: 300 }) : [];
  const teamIds = team.map((t) => t.id);

  const [myDtr, myReviews, myGoals, waiting, finalReady, cycles, teamGoals, teamDtrMap] = await Promise.all([
    loadDtr(me, mine.id, mine.id, from, today, tz, settings.graceMinutes),
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
    (hr || manager) && teamIds.length > 0 ? loadTeamDtr(orgId, teamIds, from, today, tz, settings.graceMinutes) : Promise.resolve(new Map()),
  ]);

  const myDaily = (myDtr?.rows ?? []).map(computeDailyAdherence);
  const mySummary = summarizeDailyAdherence(myDaily, today);

  const teamAdherence = team.map((t) => {
    const rows = teamDtrMap.get(t.id) ?? [];
    const daily = rows.map(computeDailyAdherence);
    const sum = summarizeDailyAdherence(daily, today);
    return { emp: t, summary: sum };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Performance" subtitle="Schedule adherence, goals during the year, and review cycles." />

      {/* Schedule Adherence & Daily Performance */}
      <ScheduleAdherenceSection
        daily={myDaily}
        summary={mySummary}
        today={today}
        selectedDays={span}
        baseUrl="/performance"
        title="Schedule Adherence & Time Performance"
        subtitle="Daily adherence to scheduled hours and break rules (1h 30m break allowance + 15m per 2 hours overtime)."
      />

      {/* Team Schedule Adherence Table for Managers/HR */}
      {(hr || manager) && teamAdherence.length > 0 && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <h2 className="text-lg font-semibold">{hr ? "Organization Schedule Adherence" : "My Team's Schedule Adherence"}</h2>
              <p className="text-xs text-muted">Schedule adherence across your direct downline for the past {span} days</p>
            </div>
            <Link href={`/schedule/analytics?days=${span}`} className="text-xs font-medium text-brand hover:underline">
              Detailed Schedule Analytics →
            </Link>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs font-semibold text-muted">
                <tr>
                  <th className="px-3.5 py-2.5">Employee</th>
                  <th className="px-3 py-2.5 text-right">Adherence</th>
                  <th className="px-3 py-2.5 text-right">Productive Work</th>
                  <th className="px-3 py-2.5 text-right">Breaks Taken</th>
                  <th className="px-3 py-2.5 text-right">Break Overages</th>
                  <th className="px-3 py-2.5 text-right">Verdict</th>
                  <th className="px-3.5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {teamAdherence.map((t) => {
                  const tv = VERDICT[t.summary.verdict];
                  return (
                    <tr key={t.emp.id} className="transition hover:bg-surface/60">
                      <td className="px-3.5 py-2.5 font-medium text-ink">
                        {t.emp.lastName}, {t.emp.firstName} <span className="text-xs text-muted">· {t.emp.employeeNo}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                        {t.summary.overallAdherencePct !== null ? `${t.summary.overallAdherencePct}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs text-emerald-600 font-medium">
                        {formatDurationPrecise(t.summary.totalProductiveSeconds)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted">
                        {formatDuration(t.summary.totalBreakMinutes)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                        {t.summary.totalExcessBreakMinutes > 0 ? (
                          <Badge tone="warning">+{formatDuration(t.summary.totalExcessBreakMinutes)}</Badge>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Badge tone={tv.tone}>{tv.label}</Badge>
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-xs">
                        <Link href={`/performance?employee=${t.emp.id}`} className="font-semibold text-brand hover:underline">
                          View details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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

async function PersonPerformance({
  me,
  meId,
  employeeId,
  daysParam,
}: {
  me: Awaited<ReturnType<typeof requireUser>>;
  meId: string;
  employeeId: string;
  daysParam?: string;
}) {
  if (!(await canViewEmployee(me, meId, employeeId))) notFound();
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const span = [7, 14, 30].includes(Number(daysParam)) ? Number(daysParam) : 14;
  const today = dayKey(new Date(), tz);
  const from = addDays(today, -(span - 1));

  const [person, reviews, goals, personDtr] = await Promise.all([
    prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, select: { id: true, firstName: true, lastName: true, employeeNo: true } }),
    prisma.review.findMany({ where: { organizationId: me.organizationId, employeeId }, include: { cycle: true }, orderBy: { cycle: { startDate: "desc" } } }),
    prisma.goal.findMany({ where: { organizationId: me.organizationId, employeeId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    loadDtr(me, meId, employeeId, from, today, tz, settings.graceMinutes),
  ]);
  if (!person) notFound();

  const daily = (personDtr?.rows ?? []).map(computeDailyAdherence);
  const summary = summarizeDailyAdherence(daily, today);
  const fmt = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href={`/employees/${person.id}`} className="text-sm font-medium text-muted hover:text-ink">← {person.firstName} {person.lastName}</Link>
      <PageHeader title={`Performance of ${person.firstName} ${person.lastName}`} subtitle="Schedule adherence, reviews, and goals." />

      <ScheduleAdherenceSection
        daily={daily}
        summary={summary}
        today={today}
        selectedDays={span}
        baseUrl={`/performance?employee=${person.id}`}
        title={`Schedule Adherence · ${person.firstName} ${person.lastName}`}
        subtitle={`Daily adherence to working hours and break limits (1h 30m break allowance + 15m per 2 hours overtime).`}
      />
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {reviews.length === 0 ? <p className="text-sm text-muted">No review cycle has included them yet.</p> : reviews.map((r) => (
          <div key={r.id} className="rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{r.cycle.name} <span className="text-sm font-normal text-muted">{fmt(r.cycle.startDate)} – {fmt(r.cycle.endDate)}</span></p>
              <Badge tone={r.stage === "DONE" ? "success" : "warning"}>{STAGE[r.stage]}</Badge>
            </div>
            <Ratings r={r} />
          </div>
        ))}
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Goals</h2>
        {goals.length === 0 ? <EmptyState title="No goals yet" /> : (
          <ul className="space-y-3">
            {goals.map((g) => (
              <li key={g.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{g.title}</p>
                  <Badge tone={GOAL_STATUS[g.status][1]}>{GOAL_STATUS[g.status][0]}</Badge>
                </div>
                {g.description && <p className="text-sm text-muted">{g.description}</p>}
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full rounded-full bg-brand" style={{ width: `${g.progress}%` }} /></div>
                <p className="mt-1 text-xs text-muted">{g.progress}%{g.targetDate ? ` · target ${fmt(g.targetDate)}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
