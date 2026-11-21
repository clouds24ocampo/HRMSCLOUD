import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, formatDay } from "@/lib/time";
import { loadBoard, loadHired, stageCounts } from "@/lib/stage-board";
import { NEXT_STAGE, progressTone, type BoardStage } from "@/lib/stage-progress";
import { Meter } from "@/components/Charts";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { RecruitmentTabs } from "../../RecruitmentTabs";
import { STAGE_TABS, StageTabs, type StageSlug } from "../StageTabs";
import { StageRowActions } from "../StageRowActions";

const SORTS = { progress: "Most complete first", waiting: "Waiting the longest first", name: "Name A to Z" } as const;
type Sort = keyof typeof SORTS;

// One stage of the hiring road: who is in it, how complete each person is, and what is still missing before they move on.
export default async function StagePage({ params, searchParams }: { params: Promise<{ stage: string }>; searchParams: Promise<{ q?: string; job?: string; sort?: string }> }) {
  const { stage: slug } = await params;
  const tab = STAGE_TABS.find(([s]) => s === slug);
  if (!tab) notFound();
  const [, key, label, blurb] = tab;
  const me = await requireUser("/recruitment");
  const { q = "", job = "", sort: sortRaw = "progress" } = await searchParams;
  const sort: Sort = sortRaw in SORTS ? (sortRaw as Sort) : "progress";
  const settings = await getOrgSettings(me.organizationId);
  const day = (d: Date) => formatDay(dayKey(d, settings.timezone), { month: "short", day: "numeric", year: "numeric" });
  const [counts, jobs] = await Promise.all([
    stageCounts(me.organizationId),
    prisma.jobPosting.findMany({ where: { organizationId: me.organizationId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  const filters = (
    <form className="flex flex-wrap items-end gap-3">
      <label className="block min-w-0 flex-1 basis-56 text-sm font-medium">Applicant<input name="q" defaultValue={q} placeholder="Search by name, email or applicant no." className={inputClass} /></label>
      <label className="block min-w-0 flex-1 basis-44 text-sm font-medium">
        Position
        <select name="job" defaultValue={job} className={inputClass}><option value="">All positions</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
      </label>
      {key !== "HIRED" && (
        <label className="block min-w-0 flex-1 basis-44 text-sm font-medium">
          Order
          <select name="sort" defaultValue={sort} className={inputClass}>{Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
      )}
      <button className={buttonClass}>Show</button>
      {(q || job || sort !== "progress") && <Link href={`/recruitment/pipeline/${slug}`} className="pb-2.5 text-sm font-medium text-muted hover:text-ink">Clear</Link>}
    </form>
  );
  const head = (
    <>
      <PageHeader title="Recruitment" subtitle="Pipeline. Each stage is its own tab, with how complete everyone is before they move on." />
      <RecruitmentTabs />
      <StageTabs active={slug as StageSlug} counts={counts} />
    </>
  );

  // ----- Hired
  if (key === "HIRED") {
    const rows = await loadHired(me.organizationId, { q, jobId: job });
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        {head}
        <p className="text-sm text-muted">{blurb}</p>
        {filters}
        {rows.length === 0 ? <EmptyState title="No one hired yet" hint="People appear here after you hire them from the Orientation & contract stage." /> : (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="text-left text-muted"><tr><th className="px-5 py-3 font-medium">Person</th><th className="px-2 py-3 font-medium">Position</th><th className="px-2 py-3 font-medium">Hired as</th><th className="px-2 py-3 font-medium">Employee no.</th><th className="px-5 py-3 font-medium">Start date</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition hover:bg-bg">
                      <td className="px-5 py-3"><Link href={`/recruitment/applicants/${r.id}`} className="font-medium hover:text-brand hover:underline">{r.name}</Link></td>
                      <td className="px-2 py-3">{r.jobTitle}</td>
                      <td className="px-2 py-3"><Badge tone={r.type === "Sub Contractor" ? "warning" : "success"}>{r.type}</Badge></td>
                      <td className="px-2 py-3 font-mono text-xs">{r.employeeId ? <Link href={`/employees/${r.employeeId}`} className="hover:text-brand hover:underline">{r.employeeNo}</Link> : "–"}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted">{r.hiredOn ? formatDay(r.hiredOn.toISOString().slice(0, 10), { month: "short", day: "numeric", year: "numeric" }) : "–"}</td>
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

  // ----- The five working stages
  const stage = key as BoardStage;
  const all = await loadBoard(me.organizationId, stage, { q, jobId: job });
  const rows = [...all].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name)
      : sort === "waiting" ? a.since.getTime() - b.since.getTime()
        : Number(b.progress.ready) - Number(a.progress.ready) || b.progress.pct - a.progress.pct || a.since.getTime() - b.since.getTime());
  const ready = all.filter((r) => r.progress.ready).length;
  const average = all.length ? Math.round(all.reduce((s, r) => s + r.progress.pct, 0) / all.length) : null;
  const next = NEXT_STAGE[stage];
  const nowMs = new Date().getTime();
  const days = (d: Date) => Math.max(0, Math.floor((nowMs - d.getTime()) / 86_400_000));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {head}
      <p className="text-sm text-muted">{blurb}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="text-center"><p className="text-3xl font-bold">{all.length}</p><p className="text-sm text-muted">In {label}</p></Card>
        <Card className="text-center"><p className="text-3xl font-bold text-success">{ready}</p><p className="text-sm text-muted">{next === "HIRE" ? "Ready to hire" : "Ready to move on"}</p></Card>
        <Card className="text-center"><p className="text-3xl font-bold">{average === null ? "–" : `${average}%`}</p><p className="text-sm text-muted">Average complete</p></Card>
      </div>
      {filters}
      {rows.length === 0 ? (
        <EmptyState title={all.length === 0 && !q && !job ? `No one in ${label} right now` : "No one matches"} hint={all.length === 0 && !q && !job ? "People appear here as they move through the stages." : "Try a different name or clear the filters."} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const tone = progressTone(r.progress.pct);
            const d = days(r.since);
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold"><Link href={`/recruitment/applicants/${r.id}`} className="hover:text-brand hover:underline">{r.name}</Link>{r.applicantNo && <span className="ml-2 font-mono text-xs font-normal text-muted">{r.applicantNo}</span>}</p>
                    <p className="text-sm text-muted">{r.jobTitle} · {d === 0 ? "here since today" : `${d} ${d === 1 ? "day" : "days"} in this stage`} ({day(r.since)}){!r.hasAccount && <> · <span className="text-warning">no account yet</span></>}</p>
                  </div>
                  <StageRowActions id={r.id} name={r.name} jobId={r.jobId} next={next} ready={r.progress.ready} missing={r.progress.missing} />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1"><Meter value={r.progress.pct} tone={tone} /></div>
                  <span className="w-12 shrink-0 text-right text-sm font-bold">{r.progress.pct}%</span>
                  {r.progress.ready ? <Badge tone="success">{next === "HIRE" ? "Ready to hire" : "Ready to move on"}</Badge> : <Badge tone="warning">{r.progress.missing.length} to go</Badge>}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-brand">What is done and what is missing</summary>
                  <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                    {r.progress.items.map((it) => (
                      <li key={it.label} className="flex items-center gap-2">
                        <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${it.done ? "bg-success text-white" : "bg-line text-muted"}`}>{it.done ? "✓" : "·"}</span>
                        <span className={it.done ? "" : "font-medium"}>{it.label}</span>
                        <span className="text-muted">{it.detail}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">Overall, {r.overall}% of the road to being hired is done (account, exams, interview, requirements, orientation, contract).</p>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
