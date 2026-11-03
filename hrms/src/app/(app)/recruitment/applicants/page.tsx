import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { passed } from "@/lib/exams";
import { applicantMatch } from "@/lib/applicant-search";
import { DeleteApplicantButton } from "../RecruitmentForms";
import { RecruitmentTabs } from "../RecruitmentTabs";
import { STAGES, STAGE_LABEL, STAGE_TONE } from "@/lib/stages";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";

const STAGE = Object.fromEntries(STAGES.map((k) => [k, [STAGE_LABEL[k], STAGE_TONE[k]] as const]));

// Everyone who applied, one row per person, with every position they applied for and their exam results.
export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<{ job?: string; q?: string; hired?: string }> }) {
  const me = await requireUser("/recruitment");
  const { job = "", q = "", hired = "" } = await searchParams;
  // Once someone is hired they are an employee: they leave this list (and their applicant file) unless asked for.
  const gone = hired === "1" ? { profileIds: [] as string[], ids: [] as string[] } : await (async () => {
    const h = await prisma.applicant.findMany({ where: { organizationId: me.organizationId, stage: "HIRED" }, select: { id: true, profileId: true } });
    return { profileIds: h.map((x) => x.profileId).filter((x): x is string => !!x), ids: h.filter((x) => !x.profileId).map((x) => x.id) };
  })();
  const [jobs, rows] = await Promise.all([
    prisma.jobPosting.findMany({ where: { organizationId: me.organizationId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.applicant.findMany({
      where: { organizationId: me.organizationId, ...(gone.profileIds.length || gone.ids.length ? { NOT: [{ profileId: { in: gone.profileIds } }, { id: { in: gone.ids } }] } : {}), ...(job ? { jobId: job } : {}), ...applicantMatch(q) },
      orderBy: { createdAt: "desc" },
      include: { job: { select: { id: true, title: true } }, profile: true, attempts: { where: { submittedAt: { not: null } }, include: { exam: { select: { id: true, title: true, kind: true, passingPct: true } } } } },
    }),
  ]);

  // One person = one account (profile). People added by hand have no account: each is their own row.
  const people = new Map<string, { name: string; email: string | null; phone: string | null; no: string | null; docs: [boolean, boolean]; apps: typeof rows; exams: Map<string, { title: string; pct: number; passed: boolean | null }> }>();
  for (const a of rows) {
    const key = a.profileId ?? a.id;
    const p = people.get(key) ?? { name: a.name, email: a.email, phone: a.phone, no: a.profile?.applicantNo ?? null, docs: [!!a.profile?.resumeKey, !!a.profile?.idKey] as [boolean, boolean], apps: [] as typeof rows, exams: new Map() };
    p.apps.push(a);
    for (const t of a.attempts) {
      const pct = t.maxScore ? Math.round(((t.score ?? 0) / t.maxScore) * 100) : 0;
      if (!p.exams.has(t.exam.id)) p.exams.set(t.exam.id, { title: t.exam.title, pct, passed: t.exam.passingPct != null ? passed(pct, t.exam.passingPct) : null });
    }
    people.set(key, p);
  }
  const list = [...people.values()];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Recruitment" subtitle={`${list.length} ${list.length === 1 ? "person" : "people"}. Each shows the positions they applied for and their exam results. Hired people are now employees and are not listed.`} />
      <RecruitmentTabs />
      <form className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 basis-48 text-sm font-medium">Search by name, email or applicant no.<input name="q" defaultValue={q} className={inputClass} /></label>
        <label className="block min-w-0 flex-1 basis-48 text-sm font-medium">
          Position
          <select name="job" defaultValue={job} className={inputClass}>
            <option value="">All positions</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-3 text-sm font-medium"><input type="checkbox" name="hired" value="1" defaultChecked={hired === "1"} className="h-4 w-4 accent-brand" /> Include hired</label>
        <button className={buttonClass}>Filter</button>
      </form>
      {list.length === 0 ? (
        <EmptyState title="No applicants found" hint="Applicants appear here as soon as they apply on the careers page." />
      ) : (
        <ul className="space-y-3">
          {list.map((p) => (
            <li key={p.no ?? p.apps[0].id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold"><Link href={`/recruitment/applicants/${p.apps[0].id}`} className="hover:text-brand hover:underline">{p.name}</Link> {p.no && <span className="ml-1 font-mono text-sm font-normal text-muted">{p.no}</span>}</p>
                    <p className="text-sm text-muted">{[p.email, p.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {p.no && <><Badge tone={p.docs[0] ? "success" : "neutral"}>{p.docs[0] ? "Resume ✓" : "No resume"}</Badge><Badge tone={p.docs[1] ? "success" : "neutral"}>{p.docs[1] ? "ID ✓" : "No ID"}</Badge></>}
                    <DeleteApplicantButton id={p.apps[0].id} name={p.name} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.apps.map((a) => {
                    const [label, tone] = STAGE[a.stage] ?? [a.stage, "neutral" as const];
                    return (
                      <Link key={a.id} href={`/recruitment/${a.job.id}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm transition hover:bg-bg">
                        <span className="font-medium">{a.job.title}</span><Badge tone={tone}>{label}</Badge>
                      </Link>
                    );
                  })}
                </div>
                {p.exams.size === 0 && p.no && <p className="mt-3 text-sm text-muted">No exam taken yet.</p>}
                {p.exams.size > 0 && (
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    {[...p.exams.values()].map((e) => (
                      <span key={e.title}>{e.title}: <span className={`font-semibold ${e.passed === null ? "text-ink" : e.passed ? "text-success" : "text-danger"}`}>{e.pct}%</span></span>
                    ))}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
