import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { buildStats, type Stage } from "@/lib/recruitment-stats";
import { drillHref, type DrillKind } from "@/lib/recruitment-drill";
import { RANGES, loadRecruitment, rangeOf } from "@/lib/recruitment-data";
import { LinkBars, Meter } from "@/components/Charts";
import { Badge, Card, EmptyState, PageHeader, Stat, ghostClass } from "@/components/ui";
import { STAGE_LABEL, STAGE_TONE } from "@/lib/stages";
import { RecruitmentTabs } from "../RecruitmentTabs";

const pctText = (n: number | null) => (n === null ? "–" : `${n}%`);
const tone = (n: number | null): "success" | "warning" | "danger" | "neutral" => (n === null ? "neutral" : n >= 70 ? "success" : n >= 50 ? "warning" : "danger");
const hoverLink = "hover:text-brand hover:underline";

function BarRow({ label, value, of, hint, color, href }: { label: string; value: number; of: number; hint?: string; color?: "success" | "warning" | "danger" | "neutral"; href: string }) {
  const w = of ? Math.round((value / of) * 100) : 0;
  return (
    <li>
      <Link href={href} className="group block rounded-lg px-2 py-1 transition hover:bg-bg" title="Click to see who">
        <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate group-hover:text-brand">{label}</span><span className="shrink-0 font-semibold">{value}{hint && <span className="ml-1 font-normal text-muted">{hint}</span>}</span></div>
        <div className="mt-1"><Meter value={w} tone={color ?? "success"} /></div>
      </Link>
    </li>
  );
}

export default async function RecruitmentDashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const me = await requireUser("/recruitment");
  const range = rangeOf((await searchParams).range);
  const settings = await getOrgSettings(me.organizationId);
  const { jobs, apps } = await loadRecruitment(me.organizationId, range);
  const s = buildStats(apps, jobs, new Date(), settings.timezone);
  const t = s.totals;
  const go = (kind: DrillKind, value?: string, stage?: string) => drillHref(range, kind, value, stage);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Recruitment"
        subtitle="Where applicants come from, how far they get, and how they score. Click any number to see who is behind it."
        action={<div className="flex flex-wrap gap-2">{RANGES.map(([k, l]) => <Link key={k} href={`/recruitment/dashboard?range=${k}`} aria-current={range === k ? "true" : undefined} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${range === k ? "border-brand bg-brand/10 text-brand" : "border-line hover:bg-bg"}`}>{l}</Link>)}</div>}
      />
      <RecruitmentTabs />
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link href={`/recruitment/dashboard/report?range=${range}`} className={ghostClass}>Detailed report</Link>
        <a href={`/recruitment/dashboard/export?range=${range}`} className={ghostClass}>Download all applicants (CSV)</a>
      </div>

      {t.applications === 0 ? (
        <EmptyState title="No applications in this period" hint="Numbers appear here as soon as people apply on the careers page." action={<Link href="/careers" target="_blank" className="font-semibold text-brand hover:underline">Open the careers page ↗</Link>} />
      ) : (
        <>
          <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            <Stat label="Applicants" value={t.people} hint={`${t.applications} applications`} href={go("all")} />
            <Stat label="Open positions" value={t.openPositions} href="/recruitment" />
            <Stat label="In progress" value={t.active} href={go("active")} />
            <Stat label="Hired" value={t.hired} hint={`${pctText(t.hireRate)} of applications`} tone="success" href={go("stage", "HIRED")} />
            <Stat label="Rejected" value={t.rejected} hint={`${pctText(t.rejectRate)} of applications`} tone={t.rejected ? "danger" : "neutral"} href={go("stage", "REJECTED")} />
            <Stat label="Uploaded resume and ID" value={pctText(t.docsRate)} tone={tone(t.docsRate)} hint="of applications" href={go("docs")} />
            <Stat label="Missing documents" value={s.pipeline[0].n - s.pipeline[1].n} tone="warning" href={go("nodocs")} />
            <Stat label="Stuck at Applied 3+ days" value={s.stalled} tone={s.stalled ? "warning" : "neutral"} href={go("stalled")} />
            <Stat label="Psychological exams taken" value={s.psych.taken} hint={s.psych.avg === null ? undefined : `average ${s.psych.avg}%`} tone={tone(s.psych.avg)} href={go("psych")} />
            <Stat label="Avg. days to hire" value={t.avgDaysToHire ?? "–"} href={go("stage", "HIRED")} />
            <Stat label="Avg. time on knowledge exam" value={s.timing.knowledgeMin === null ? "–" : `${s.timing.knowledgeMin} min`} href={go("pipeline", "3")} />
            <Stat label="Avg. time on psychological exam" value={s.timing.psychologicalMin === null ? "–" : `${s.timing.psychologicalMin} min`} href={go("psych")} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Where applications stand</h2>
              <ul className="space-y-1">
                {(Object.keys(STAGE_LABEL) as Stage[]).map((k) => <BarRow key={k} href={go("stage", k)} label={STAGE_LABEL[k]} value={s.byStage[k]} of={t.applications} hint={`${Math.round((s.byStage[k] / t.applications) * 100)}%`} color={k === "REJECTED" ? "danger" : k === "HIRED" ? "success" : "warning"} />)}
              </ul>
            </Card>
            <Card>
              <h2 className="mb-3 text-lg font-semibold">How far applicants get</h2>
              <ul className="space-y-1">
                {s.pipeline.map((p, i) => <BarRow key={p.label} href={go("pipeline", String(i))} label={p.label} value={p.n} of={s.pipeline[0].n} hint={`${Math.round((p.n / (s.pipeline[0].n || 1)) * 100)}%`} />)}
              </ul>
            </Card>
          </div>

          <Card>
            <h2 className="mb-1 text-lg font-semibold">New applications, last 30 days</h2>
            <p className="mb-2 text-sm text-muted">{s.daily.reduce((n, d) => n + d.value, 0)} in the period. Click a day to see who applied. Latest day on the right.</p>
            <LinkBars data={s.daily.map((d) => ({ label: d.key, value: d.value, href: go("day", d.key) }))} unit=" applications" />
            <div className="flex justify-between text-xs text-muted"><span>{s.daily[0].label}</span><span>{s.daily[29].label}</span></div>
          </Card>

          <Card className="p-0">
            <h2 className="px-5 pt-5 text-lg font-semibold">By position</h2>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full min-w-[44rem] text-sm">
                <thead className="text-left text-muted"><tr><th className="px-5 py-2 font-medium">Position</th><th className="px-2 py-2 text-right font-medium">Applied</th><th className="px-2 py-2 text-right font-medium">In progress</th><th className="px-2 py-2 text-right font-medium">Hired</th><th className="px-2 py-2 text-right font-medium">Rejected</th><th className="px-2 py-2 text-right font-medium">Filled</th><th className="px-2 py-2 text-right font-medium">Avg. knowledge</th><th className="px-5 py-2 text-right font-medium">Pass rate</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {s.positions.map((p) => {
                    const cell = (n: number | string, stage?: string) => (typeof n === "number" && n === 0 ? <span className="text-muted">0</span> : <Link href={go("job", p.id, stage)} className={`${hoverLink} font-medium`}>{n}</Link>);
                    return (
                      <tr key={p.id} className={p.applications ? "" : "text-muted"}>
                        <td className="px-5 py-2"><Link href={`/recruitment/${p.id}`} className={`font-medium ${hoverLink}`}>{p.title}</Link>{p.status !== "OPEN" && <span className="ml-2"><Badge>Closed</Badge></span>}</td>
                        <td className="px-2 py-2 text-right font-semibold">{cell(p.applications)}</td><td className="px-2 py-2 text-right">{cell(p.active, "ACTIVE")}</td><td className="px-2 py-2 text-right">{cell(p.hired, "HIRED")}</td><td className="px-2 py-2 text-right">{cell(p.rejected, "REJECTED")}</td><td className="px-2 py-2 text-right">{p.filled}</td>
                        <td className="px-2 py-2 text-right">{pctText(p.avgKnowledge)}</td><td className="px-5 py-2 text-right">{pctText(p.passRate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-1 text-lg font-semibold">Knowledge exam scores</h2>
              <p className="mb-2 text-sm text-muted">How many exams fell in each score range (percent). Click a column to see who.</p>
              <LinkBars data={s.distribution.map((d, i) => ({ ...d, href: go("bucket", String(i)) }))} unit=" exams" />
              <div className="flex justify-between text-xs text-muted"><span>0%</span><span>100%</span></div>
              <ul className="mt-4 divide-y divide-line text-sm">
                {s.exams.length === 0 && <li className="py-2 text-muted">No knowledge exam taken yet.</li>}
                {s.exams.map((e) => (
                  <li key={e.id}>
                    <Link href={go("exam", e.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-1 py-2 transition hover:bg-bg" title="Click to see who took it">
                      <span className="min-w-0 truncate font-medium">{e.title}</span>
                      <span className="flex shrink-0 gap-3 text-muted"><span>{e.taken} taken</span><span>avg <b className="text-ink">{pctText(e.avg)}</b></span><span>pass <b className="text-ink">{pctText(e.passRate)}</b></span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className="mb-1 text-lg font-semibold">Psychological exam: mindset by trait</h2>
              <p className="mb-3 text-sm text-muted">Average across {s.psych.taken} {s.psych.taken === 1 ? "person" : "people"}. Click a trait to see each person&apos;s score. Higher means a better fit for teamwork and dependability.</p>
              {s.psych.traits.length === 0 ? <p className="text-sm text-muted">No psychological exam taken yet.</p> : (
                <ul className="space-y-1">{s.psych.traits.map((x) => <BarRow key={x.trait} href={go("trait", x.trait)} label={x.trait} value={x.pct} of={100} hint="%" color={x.pct >= 70 ? "success" : x.pct >= 50 ? "warning" : "danger"} />)}</ul>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="mb-1 text-lg font-semibold">Top candidates</h2>
            <p className="mb-3 text-sm text-muted">People who finished both exams and are still in the running. The combined score gives the two exams equal weight. The full ranking is in the detailed report.</p>
            {s.leaderboard.length === 0 ? <p className="text-sm text-muted">No one has finished both exams yet.</p> : (
              <ol className="divide-y divide-line">
                {s.leaderboard.map((c, i) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="flex min-w-0 items-center gap-3"><span className="w-6 text-center font-bold text-muted">{i + 1}</span><div className="min-w-0"><Link href={`/recruitment/applicants/${c.id}`} className={`font-medium ${hoverLink}`}>{c.name}</Link><p className="truncate text-sm text-muted"><Link href={go("job", c.jobId)} className={hoverLink}>{c.jobTitle}</Link></p></div></div>
                    <div className="flex items-center gap-3 text-sm"><span className="text-muted">Knowledge <b className="text-ink">{c.knowledge}%</b></span><span className="text-muted">Mindset <b className="text-ink">{c.psychological}%</b></span><Badge tone={tone(c.combined)}>{c.combined}% combined</Badge><Link href={go("stage", c.stage)}><Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge></Link></div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Where applicants came from</h2>
              <ul className="space-y-1">{s.sources.map((x) => <BarRow key={x.label} href={go("source", x.label)} label={x.label} value={x.value} of={t.applications} color="neutral" />)}</ul>
            </Card>
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Exam language chosen</h2>
              {s.language.en + s.language.tl === 0 ? <p className="text-sm text-muted">No exam taken yet.</p> : (
                <ul className="space-y-1"><BarRow href={go("lang", "en")} label="English" value={s.language.en} of={s.language.en + s.language.tl} color="neutral" /><BarRow href={go("lang", "tl")} label="Tagalog" value={s.language.tl} of={s.language.en + s.language.tl} color="neutral" /></ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
