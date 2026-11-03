import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { scoresOf } from "@/lib/recruitment-stats";
import { drillApps, drillQuery, drillTitle, groupByPerson, parseDrill } from "@/lib/recruitment-drill";
import { loadRecruitment, rangeLabel, rangeOf } from "@/lib/recruitment-data";
import { formatDay, dayKey } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, ghostClass } from "@/components/ui";
import { STAGE_LABEL, STAGE_TONE } from "@/lib/stages";
import { RecruitmentTabs } from "../../RecruitmentTabs";

const pct = (n: number | null) => (n === null ? "–" : `${n}%`);

// The people behind one number on the dashboard, with everything known about each application.
export default async function DrillPage({ searchParams }: { searchParams: Promise<{ kind?: string; value?: string; stage?: string; range?: string }> }) {
  const me = await requireUser("/recruitment");
  const q = await searchParams;
  const range = rangeOf(q.range);
  const drill = parseDrill(q);
  const settings = await getOrgSettings(me.organizationId);
  const { jobs, apps } = await loadRecruitment(me.organizationId, range);
  const rows = drillApps(apps, drill, settings.timezone);
  const people = groupByPerson(rows, apps);
  const title = drillTitle(drill, apps, jobs);
  const qs = drillQuery(range, drill.kind, drill.value, drill.stage);
  const hasNote = people.some((p) => p.note);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={title}
        subtitle={`${people.length} ${people.length === 1 ? "applicant" : "applicants"} · ${rows.length} matching ${rows.length === 1 ? "application" : "applications"} · ${rangeLabel(range)}`}
        action={<div className="flex flex-wrap gap-2 print:hidden"><Link href={`/recruitment/dashboard?range=${range}`} className={ghostClass}>← Dashboard</Link><a href={`/recruitment/dashboard/export?${qs}`} className={ghostClass}>Download this list (CSV)</a></div>}
      />
      <div className="print:hidden"><RecruitmentTabs /></div>
      {people.length === 0 ? (
        <EmptyState title="No one here" hint="Nothing matches this number in the chosen period." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Applicant</th><th className="px-2 py-3 font-medium">Contact</th><th className="px-2 py-3 font-medium">Positions and stages</th>
                  <th className="px-2 py-3 font-medium">First applied</th><th className="px-2 py-3 font-medium">Documents</th><th className="px-2 py-3 text-right font-medium">Mindset</th><th className="px-2 py-3 text-right font-medium">Best combined</th>
                  {hasNote && <th className="px-5 py-3 text-right font-medium">Detail</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {people.map((p) => (
                  <tr key={p.key} className="align-top">
                    <td className="px-5 py-3"><Link href={`/recruitment/applicants/${p.apps[0].app.id}`} className="font-medium hover:text-brand hover:underline">{p.name}</Link>{p.applicantNo && <p className="font-mono text-xs text-muted">{p.applicantNo}</p>}</td>
                    <td className="px-2 py-3 text-muted">{p.email ?? "–"}{p.phone && <p>{p.phone}</p>}</td>
                    <td className="px-2 py-3">
                      <ul className="space-y-1.5">
                        {p.apps.map(({ app: a, match }) => {
                          const sc = scoresOf(a);
                          return (
                            <li key={a.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${match ? "" : "opacity-60"}`}>
                              <Link href={`/recruitment/${a.jobId}`} className="font-medium hover:text-brand hover:underline">{a.jobTitle}</Link>
                              <Link href={`/recruitment/dashboard/detail?${drillQuery(range, "stage", a.stage)}`}><Badge tone={STAGE_TONE[a.stage]}>{STAGE_LABEL[a.stage]}</Badge></Link>
                              {sc.knowledge !== null && <span className="text-xs text-muted">knowledge {sc.knowledge}%</span>}
                              {!match && <span className="text-xs text-muted">(other application)</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-muted">{formatDay(dayKey(p.firstApplied, settings.timezone), { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-2 py-3">
                      <span className="flex gap-3">
                        {p.hasResume ? <a href={`/recruitment/applicant/${p.apps[0].app.id}/resume`} target="_blank" className="font-medium text-brand hover:underline">Resume</a> : <span className="text-muted">No resume</span>}
                        {p.hasId ? <a href={`/recruitment/applicant/${p.apps[0].app.id}/id`} target="_blank" className="font-medium text-brand hover:underline">ID</a> : <span className="text-muted">No ID</span>}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right">{pct(p.psychological)}</td><td className="px-2 py-3 text-right font-semibold">{pct(p.bestCombined)}</td>
                    {hasNote && <td className="px-5 py-3 text-right font-semibold">{p.note ?? "–"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
