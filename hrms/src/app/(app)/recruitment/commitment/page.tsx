import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, formatDay } from "@/lib/time";
import { applicantMatch } from "@/lib/applicant-search";
import { COMMITMENT_BANDS, commitmentBand, traitExtremes, type Breakdown } from "@/lib/commitment-result";
import { STAGE_LABEL, STAGE_TONE } from "@/lib/stages";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { RecruitmentTabs } from "../RecruitmentTabs";

const SORTS = { newest: "Newest first", high: "Highest score first", low: "Lowest score first" } as const;

// Everyone's Corporate Commitment result in one table: score, how to read it, strongest and weakest area, and how many times they
// left the exam screen. Open a row to read every answer. HR and Super Admin only, like all of Recruitment.
export default async function CommitmentResultsPage({ searchParams }: { searchParams: Promise<{ q?: string; band?: string; sort?: string }> }) {
  const me = await requireUser("/recruitment");
  const { q = "", band = "", sort = "newest" } = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const day = (d: Date) => formatDay(dayKey(d, settings.timezone), { month: "short", day: "numeric", year: "numeric" });

  const [all, started] = await Promise.all([
    prisma.examAttempt.findMany({
      where: { submittedAt: { not: null }, exam: { organizationId: me.organizationId, kind: "COMMITMENT" }, applicant: { organizationId: me.organizationId, ...applicantMatch(q) } },
      orderBy: { submittedAt: "desc" },
      take: 600,
      select: {
        id: true, score: true, maxScore: true, breakdown: true, leaves: true, oathAt: true, submittedAt: true, lang: true,
        exam: { select: { title: true, active: true } },
        applicant: { select: { id: true, name: true, stage: true, profileId: true, job: { select: { title: true } }, profile: { select: { applicantNo: true } } } },
      },
    }),
    prisma.examAttempt.count({ where: { submittedAt: null, exam: { organizationId: me.organizationId, kind: "COMMITMENT", active: true } } }),
  ]);

  // The same exam taken once is copied onto each of a person's applications. Show each person once per exam version.
  const seen = new Set<string>();
  const people = all.filter((t) => {
    const key = `${t.applicant.profileId ?? t.applicant.id}:${t.exam.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((t) => {
    const pct = t.maxScore ? Math.round(((t.score ?? 0) / t.maxScore) * 100) : 0;
    return { t, pct, band: commitmentBand(pct), traits: traitExtremes(t.breakdown as Breakdown | null) };
  });

  const counts = Object.fromEntries(COMMITMENT_BANDS.map((b) => [b.key, people.filter((p) => p.band.key === b.key).length]));
  const average = people.length ? Math.round(people.reduce((s, p) => s + p.pct, 0) / people.length) : null;
  const shown = people
    .filter((p) => !band || p.band.key === band)
    .sort((a, b) => (sort === "high" ? b.pct - a.pct : sort === "low" ? a.pct - b.pct : 0));

  const link = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(band ? { band } : {}), ...(sort !== "newest" ? { sort } : {}), ...over });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/recruitment/commitment${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Recruitment"
        subtitle={`Corporate Commitment results. ${people.length} ${people.length === 1 ? "person has" : "people have"} finished it${started ? `, ${started} more ${started === 1 ? "has" : "have"} started` : ""}. The exam has no wrong answers: it shows what each person puts first when their own interest and the corporation's pull apart.`}
      />
      <RecruitmentTabs />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="text-center"><p className="text-3xl font-bold">{average === null ? "–" : `${average}%`}</p><p className="text-sm text-muted">Average score</p></Card>
        {COMMITMENT_BANDS.map((b) => (
          <Link key={b.key} href={link({ band: band === b.key ? "" : b.key })} aria-current={band === b.key ? "true" : undefined} title={b.hint}
            className={`rounded-2xl border bg-surface p-5 text-center shadow-sm transition hover:shadow-md ${band === b.key ? "border-brand ring-2 ring-brand/30" : "border-line"}`}>
            <p className="text-3xl font-bold">{counts[b.key]}</p>
            <p className="mt-1"><Badge tone={b.tone}>{b.label}</Badge></p>
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 basis-56 text-sm font-medium">Applicant<input name="q" defaultValue={q} placeholder="Search by name, email or applicant no." className={inputClass} /></label>
        <label className="block min-w-0 flex-1 basis-44 text-sm font-medium">
          Reading
          <select name="band" defaultValue={band} className={inputClass}><option value="">All</option>{COMMITMENT_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}</select>
        </label>
        <label className="block min-w-0 flex-1 basis-44 text-sm font-medium">
          Order
          <select name="sort" defaultValue={sort} className={inputClass}>{Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <button className={buttonClass}>Show</button>
        {(q || band || sort !== "newest") && <Link href="/recruitment/commitment" className="pb-2.5 text-sm font-medium text-muted hover:text-ink">Clear</Link>}
      </form>

      {shown.length === 0 ? (
        <EmptyState
          title={people.length === 0 && !q && !band ? "No commitment results yet" : "No one matches"}
          hint={people.length === 0 && !q && !band ? "Results appear as soon as an applicant submits the Corporate Commitment Exam." : "Try a different name or clear the filters."}
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead className="text-left text-muted">
                <tr><th className="px-5 py-3 font-medium">Applicant</th><th className="px-2 py-3 font-medium">Position</th><th className="px-2 py-3 text-right font-medium">Score</th><th className="px-2 py-3 font-medium">Reading</th><th className="px-2 py-3 font-medium">Strongest area</th><th className="px-2 py-3 font-medium">Weakest area</th><th className="px-2 py-3 font-medium">Left screen</th><th className="px-5 py-3 font-medium">Oath · Submitted</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map(({ t, pct, band: b, traits }) => (
                  <tr key={t.id} className="align-top transition hover:bg-bg">
                    <td className="px-5 py-3">
                      <Link href={`/recruitment/applicants/${t.applicant.id}`} className="font-medium hover:text-brand hover:underline">{t.applicant.name}</Link>
                      {t.applicant.profile && <p className="font-mono text-xs text-muted">{t.applicant.profile.applicantNo}</p>}
                      {!t.exam.active && <p className="mt-0.5 text-xs text-muted">Older version of the exam</p>}
                    </td>
                    <td className="px-2 py-3">{t.applicant.job.title}<p className="mt-0.5"><Badge tone={STAGE_TONE[t.applicant.stage]}>{STAGE_LABEL[t.applicant.stage]}</Badge></p></td>
                    <td className="px-2 py-3 text-right font-semibold"><Link href={`/recruitment/results/${t.id}`} className="hover:text-brand hover:underline" title="Read every answer">{pct}%<span className="block text-xs font-normal text-muted">{t.score}/{t.maxScore}</span></Link></td>
                    <td className="px-2 py-3"><Badge tone={b.tone}>{b.label}</Badge></td>
                    <td className="px-2 py-3">{traits ? <>{traits.best.name}<span className="ml-1 text-muted">{traits.best.pct}%</span></> : "–"}</td>
                    <td className="px-2 py-3">{traits ? <>{traits.worst.name}<span className="ml-1 text-muted">{traits.worst.pct}%</span></> : "–"}</td>
                    <td className="px-2 py-3">{t.leaves > 0 ? <Badge tone="warning">{t.leaves}×</Badge> : <span className="text-muted">Never</span>}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{t.oathAt ? day(t.oathAt) : "–"}<br />{t.submittedAt && day(t.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">How to read the score</h2>
        <ul className="space-y-1">{COMMITMENT_BANDS.map((b) => <li key={b.key}><Badge tone={b.tone}>{b.label}</Badge> <span className="text-muted">{b.hint}</span></li>)}</ul>
        <p className="text-muted">A guide, not a pass mark. Use it to decide what to ask at the interview, together with the other exams. Open a row to read every answer the person chose.</p>
      </Card>
    </div>
  );
}
