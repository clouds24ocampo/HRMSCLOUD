import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { buildStats, isStalled, type Stage } from "@/lib/recruitment-stats";
import { drillHref } from "@/lib/recruitment-drill";
import { loadRecruitment, rangeLabel, rangeOf } from "@/lib/recruitment-data";
import { dayKey, formatDay } from "@/lib/time";
import { STAGE_LABEL } from "@/lib/stages";
import { PrintButton } from "@/components/PrintButton";
import { Card, ghostClass } from "@/components/ui";

const pct = (n: number | null) => (n === null ? "–" : `${n}%`);
const of = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "–");

function Table({ head, rows, right = [] }: { head: string[]; rows: (string | number | React.ReactNode)[][]; right?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead className="text-left text-muted"><tr>{head.map((h, i) => <th key={h} className={`px-3 py-2 font-medium ${right.includes(i) ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`px-3 py-2 ${right.includes(j) ? "text-right" : ""}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// The full written report: every number from the dashboard with its meaning, plus the lists HR acts on. Prints cleanly.
export default async function RecruitmentReport({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const me = await requireUser("/recruitment");
  const range = rangeOf((await searchParams).range);
  const settings = await getOrgSettings(me.organizationId);
  const now = new Date();
  const { jobs, apps } = await loadRecruitment(me.organizationId, range);
  const s = buildStats(apps, jobs, now, settings.timezone);
  const t = s.totals;
  const go = (kind: Parameters<typeof drillHref>[1], value?: string, stage?: string) => drillHref(range, kind, value, stage);
  const stalled = apps.filter((a) => isStalled(a, now));
  const noDocs = apps.filter((a) => !a.docsDone);
  const quiet = s.positions.filter((p) => p.status === "OPEN" && p.applications === 0);
  const best = s.positions.filter((p) => p.avgKnowledge !== null).sort((a, b) => (b.avgKnowledge ?? 0) - (a.avgKnowledge ?? 0));
  const biggestDrop = s.pipeline.slice(1).map((p, i) => ({ from: s.pipeline[i].label, to: p.label, lost: s.pipeline[i].n - p.n })).sort((a, b) => b.lost - a.lost)[0];
  const today = formatDay(dayKey(now, settings.timezone), { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const summary: string[] = t.applications === 0 ? ["There are no applications in this period."] : [
    `${t.people} ${t.people === 1 ? "person" : "people"} made ${t.applications} ${t.applications === 1 ? "application" : "applications"} (${rangeLabel(range).toLowerCase()}). ${t.active} ${t.active === 1 ? "is" : "are"} still in progress, ${t.hired} ${t.hired === 1 ? "was" : "were"} hired and ${t.rejected} ${t.rejected === 1 ? "was" : "were"} rejected.`,
    `${pct(t.docsRate)} of applications have both the resume and the valid ID.${biggestDrop && biggestDrop.lost > 0 ? ` The biggest drop is between "${biggestDrop.from}" and "${biggestDrop.to}": ${biggestDrop.lost} ${biggestDrop.lost === 1 ? "application" : "applications"} did not move on.` : ""}`,
    s.exams.length ? `Knowledge exams: ${s.exams.reduce((n, e) => n + e.taken, 0)} taken. ${best[0] ? `The highest average is ${best[0].title} (${best[0].avgKnowledge}%)${best.length > 1 ? `; the lowest is ${best[best.length - 1].title} (${best[best.length - 1].avgKnowledge}%)` : ""}.` : ""}` : "No knowledge exam has been taken yet.",
    s.psych.taken ? `Psychological exam: ${s.psych.taken} ${s.psych.taken === 1 ? "person" : "people"} took it, average ${s.psych.avg}%. Strongest trait: ${s.psych.traits[0]?.trait} (${s.psych.traits[0]?.pct}%). Weakest: ${s.psych.traits.at(-1)?.trait} (${s.psych.traits.at(-1)?.pct}%).` : "No psychological exam has been taken yet.",
    s.ranking.length ? `${s.ranking.length} ${s.ranking.length === 1 ? "candidate has" : "candidates have"} finished both exams. The best combined score is ${s.ranking[0].combined}% (${s.ranking[0].name}, ${s.ranking[0].jobTitle}).` : "No candidate has finished both exams yet.",
    `${stalled.length} ${stalled.length === 1 ? "application has" : "applications have"} been stuck at Applied for more than 3 days.${quiet.length ? ` ${quiet.length} open ${quiet.length === 1 ? "position has" : "positions have"} no applicants.` : ""}`,
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Recruitment report</h1>
          <p className="mt-1 text-muted">{me.organization.name} · {rangeLabel(range)} · prepared {today}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link href={`/recruitment/dashboard?range=${range}`} className={ghostClass}>← Dashboard</Link>
          <a href={`/recruitment/dashboard/export?range=${range}`} className={ghostClass}>Download all applicants (CSV)</a>
          <PrintButton />
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 print:hidden" aria-label="Period">{["30", "90", "365", "all"].map((k) => <Link key={k} href={`/recruitment/dashboard/report?range=${k}`} aria-current={range === k ? "true" : undefined} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${range === k ? "border-brand bg-brand/10 text-brand" : "border-line hover:bg-bg"}`}>{rangeLabel(k)}</Link>)}</nav>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">Summary</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">{summary.map((x) => <li key={x}>{x}</li>)}</ul>
      </Card>

      {t.applications > 0 && (
        <>
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Key numbers</h2>
            <Table head={["Measure", "Value", "Meaning"]} right={[1]} rows={[
              ["Applicants (people)", <Link key="p" href={go("all")} className="font-semibold hover:text-brand hover:underline">{t.people}</Link>, "Different applicant accounts"],
              ["Applications", <Link key="a" href={go("all")} className="font-semibold hover:text-brand hover:underline">{t.applications}</Link>, "One per person per position"],
              ["In progress", <Link key="i" href={go("active")} className="font-semibold hover:text-brand hover:underline">{t.active}</Link>, "Not hired and not rejected"],
              ["Hired", <Link key="h" href={go("stage", "HIRED")} className="font-semibold hover:text-brand hover:underline">{t.hired}</Link>, `${pct(t.hireRate)} of applications`],
              ["Rejected", <Link key="r" href={go("stage", "REJECTED")} className="font-semibold hover:text-brand hover:underline">{t.rejected}</Link>, `${pct(t.rejectRate)} of applications`],
              ["Resume and ID uploaded", <Link key="d" href={go("docs")} className="font-semibold hover:text-brand hover:underline">{pct(t.docsRate)}</Link>, "Share of applications with both files"],
              ["Average days to hire", t.avgDaysToHire ?? "–", "From applying to being hired"],
              ["Average time on knowledge exam", s.timing.knowledgeMin === null ? "–" : `${s.timing.knowledgeMin} min`, "From start to submit"],
              ["Average time on psychological exam", s.timing.psychologicalMin === null ? "–" : `${s.timing.psychologicalMin} min`, "From start to submit"],
              ["Open positions", t.openPositions, "Currently accepting applications"],
            ]} />
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-semibold">Stages</h2>
            <Table head={["Stage", "Applications", "Share"]} right={[1, 2]} rows={(Object.keys(STAGE_LABEL) as Stage[]).map((k) => [STAGE_LABEL[k], <Link key={k} href={go("stage", k)} className="font-semibold hover:text-brand hover:underline">{s.byStage[k]}</Link>, of(s.byStage[k], t.applications)])} />
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-semibold">How far applicants get</h2>
            <p className="mb-2 text-sm text-muted">Each step counts applications that got that far. &ldquo;Of the step before&rdquo; shows where people drop off.</p>
            <Table head={["Step", "Applications", "Of all applied", "Of the step before", "Dropped"]} right={[1, 2, 3, 4]} rows={s.pipeline.map((p, i) => [p.label, <Link key={i} href={go("pipeline", String(i))} className="font-semibold hover:text-brand hover:underline">{p.n}</Link>, of(p.n, s.pipeline[0].n), i === 0 ? "–" : of(p.n, s.pipeline[i - 1].n), i === 0 ? "–" : s.pipeline[i - 1].n - p.n])} />
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-semibold">By position</h2>
            <Table head={["Position", "Applied", "In progress", "Hired", "Rejected", "Openings filled", "Avg. knowledge", "Pass rate"]} right={[1, 2, 3, 4, 5, 6, 7]} rows={s.positions.map((p) => [<Link key={p.id} href={go("job", p.id)} className="font-medium hover:text-brand hover:underline">{p.title}{p.status !== "OPEN" ? " (closed)" : ""}</Link>, p.applications, p.active, p.hired, p.rejected, p.filled, pct(p.avgKnowledge), pct(p.passRate)])} />
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-semibold">Knowledge exams</h2>
            <Table head={["Exam", "Taken", "Average", "Best", "Lowest", "Pass rate"]} right={[1, 2, 3, 4, 5]} rows={s.exams.length ? s.exams.map((e) => [<Link key={e.id} href={go("exam", e.id)} className="font-medium hover:text-brand hover:underline">{e.title}</Link>, e.taken, pct(e.avg), pct(e.best), pct(e.lowest), pct(e.passRate)]) : [["No knowledge exam taken yet", "", "", "", "", ""]]} />
            <h3 className="mt-5 mb-2 font-semibold">Score distribution</h3>
            <Table head={["Score range", "Exams"]} right={[1]} rows={s.distribution.map((d, i) => [`${d.label}%`, <Link key={i} href={go("bucket", String(i))} className="font-semibold hover:text-brand hover:underline">{d.value}</Link>])} />
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-semibold">Psychological exam</h2>
            <p className="mb-2 text-sm text-muted">{s.psych.taken} {s.psych.taken === 1 ? "person" : "people"}, average {pct(s.psych.avg)}. Each trait is the average of that person group&apos;s score on the questions measuring it.</p>
            <Table head={["Trait", "Average", "Reading"]} right={[1]} rows={s.psych.traits.length ? s.psych.traits.map((x) => [<Link key={x.trait} href={go("trait", x.trait)} className="font-medium hover:text-brand hover:underline">{x.trait}</Link>, `${x.pct}%`, x.pct >= 70 ? "Strong" : x.pct >= 50 ? "Fair" : "Needs attention"]) : [["No psychological exam taken yet", "", ""]]} />
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-semibold">Candidate ranking</h2>
            <p className="mb-2 text-sm text-muted">Everyone who finished both exams and was not rejected. Combined = average of the knowledge and psychological scores.</p>
            <Table head={["#", "Candidate", "Position", "Stage", "Knowledge", "Mindset", "Combined"]} right={[4, 5, 6]} rows={s.ranking.length ? s.ranking.map((c, i) => [i + 1, <Link key={c.id} href={`/recruitment/applicants/${c.id}`} className="font-medium hover:text-brand hover:underline">{c.name}</Link>, c.jobTitle, STAGE_LABEL[c.stage], `${c.knowledge}%`, `${c.psychological}%`, <b key="c">{c.combined}%</b>]) : [["", "No one has finished both exams yet", "", "", "", "", ""]]} />
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-semibold">Needs attention</h2>
            <p className="mb-2 text-sm text-muted">Applicants who may need a reminder, and positions nobody applied to.</p>
            <h3 className="mb-1 font-semibold">Stuck at Applied for more than 3 days ({stalled.length})</h3>
            {stalled.length ? <ul className="mb-4 list-disc pl-5 text-sm">{stalled.slice(0, 25).map((a) => <li key={a.id}><Link href={`/recruitment/applicants/${a.id}`} className="font-medium hover:text-brand hover:underline">{a.name}</Link> · {a.jobTitle} · {a.hasResume && a.hasId ? "documents done, exams not finished" : a.hasResume || a.hasId ? "one document missing" : "no documents yet"}</li>)}{stalled.length > 25 && <li><Link href={go("stalled")} className="text-brand hover:underline">and {stalled.length - 25} more</Link></li>}</ul> : <p className="mb-4 text-sm text-muted">None.</p>}
            <h3 className="mb-1 font-semibold">Missing a resume or valid ID ({noDocs.length})</h3>
            <p className="mb-4 text-sm"><Link href={go("nodocs")} className="text-brand hover:underline">See the list</Link></p>
            <h3 className="mb-1 font-semibold">Open positions with no applicants ({quiet.length})</h3>
            {quiet.length ? <p className="text-sm">{quiet.map((p) => p.title).join(", ")}</p> : <p className="text-sm text-muted">None.</p>}
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-semibold">Sources and language</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <Table head={["Source", "Applications"]} right={[1]} rows={s.sources.map((x) => [x.label, <Link key={x.label} href={go("source", x.label)} className="font-semibold hover:text-brand hover:underline">{x.value}</Link>])} />
              <Table head={["Exam language", "Exams"]} right={[1]} rows={[["English", <Link key="en" href={go("lang", "en")} className="font-semibold hover:text-brand hover:underline">{s.language.en}</Link>], ["Tagalog", <Link key="tl" href={go("lang", "tl")} className="font-semibold hover:text-brand hover:underline">{s.language.tl}</Link>]]} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
