import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, formatDay } from "@/lib/time";
import { durationMin } from "@/lib/exam-results";
import { KIND_LABEL, passed } from "@/lib/exams";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { RecruitmentTabs } from "../RecruitmentTabs";

// Every exam an applicant has handed in, newest first. Only HR and Super Admin can open Recruitment, so only they see results.
export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ exam?: string; kind?: string; q?: string }> }) {
  const me = await requireUser("/recruitment");
  const { exam = "", kind = "", q = "" } = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const [exams, rows] = await Promise.all([
    prisma.exam.findMany({ where: { organizationId: me.organizationId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.examAttempt.findMany({
      where: {
        submittedAt: { not: null },
        applicant: { organizationId: me.organizationId, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
        ...(exam ? { examId: exam } : {}),
        ...(kind === "KNOWLEDGE" || kind === "PSYCHOLOGICAL" ? { exam: { kind } } : {}),
      },
      orderBy: { submittedAt: "desc" },
      take: 300,
      include: { exam: { select: { title: true, kind: true, passingPct: true } }, applicant: { select: { id: true, name: true, jobId: true, job: { select: { title: true } }, profile: { select: { applicantNo: true } } } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Recruitment" subtitle={`Exam results. ${rows.length} ${rows.length === 1 ? "result" : "results"}${rows.length === 300 ? " (the latest 300)" : ""}. Open one to review every answer.`} />
      <RecruitmentTabs />
      <form className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 basis-48 text-sm font-medium">Applicant<input name="q" defaultValue={q} placeholder="Search by name" className={inputClass} /></label>
        <label className="block min-w-0 flex-1 basis-48 text-sm font-medium">
          Exam
          <select name="exam" defaultValue={exam} className={inputClass}><option value="">All exams</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
        </label>
        <label className="block min-w-0 flex-1 basis-40 text-sm font-medium">
          Type
          <select name="kind" defaultValue={kind} className={inputClass}><option value="">Both</option><option value="KNOWLEDGE">Position knowledge</option><option value="PSYCHOLOGICAL">Psychological</option></select>
        </label>
        <button className={buttonClass}>Filter</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No results yet" hint="Results appear as soon as an applicant submits an exam." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="text-left text-muted"><tr><th className="px-5 py-3 font-medium">Applicant</th><th className="px-2 py-3 font-medium">Position</th><th className="px-2 py-3 font-medium">Exam</th><th className="px-2 py-3 text-right font-medium">Score</th><th className="px-2 py-3 font-medium">Result</th><th className="px-2 py-3 text-right font-medium">Time</th><th className="px-2 py-3 font-medium">Language</th><th className="px-5 py-3 font-medium">Submitted</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((t) => {
                  const pct = t.maxScore ? Math.round(((t.score ?? 0) / t.maxScore) * 100) : 0;
                  const ok = t.exam.passingPct != null ? passed(pct, t.exam.passingPct) : null;
                  return (
                    <tr key={t.id} className="align-top transition hover:bg-bg">
                      <td className="px-5 py-3"><Link href={`/recruitment/applicants/${t.applicant.id}`} className="font-medium hover:text-brand hover:underline">{t.applicant.name}</Link>{t.applicant.profile && <p className="font-mono text-xs text-muted">{t.applicant.profile.applicantNo}</p>}</td>
                      <td className="px-2 py-3"><Link href={`/recruitment/${t.applicant.jobId}`} className="hover:text-brand hover:underline">{t.applicant.job.title}</Link></td>
                      <td className="px-2 py-3"><span className="font-medium">{t.exam.title}</span><p className="text-xs text-muted">{KIND_LABEL[t.exam.kind]}</p></td>
                      <td className="px-2 py-3 text-right font-semibold"><Link href={`/recruitment/results/${t.id}`} className="hover:text-brand hover:underline" title="Review every answer">{t.score}/{t.maxScore} <span className="font-normal text-muted">({pct}%)</span></Link></td>
                      <td className="px-2 py-3">{ok === null ? <Badge>Mindset score</Badge> : ok ? <Badge tone="success">Passed</Badge> : <Badge tone="danger">Below passing</Badge>}</td>
                      <td className="px-2 py-3 text-right text-muted">{durationMin(t.startedAt, t.submittedAt)} min</td>
                      <td className="px-2 py-3 text-muted">{t.lang === "tl" ? "Tagalog" : "English"}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted">{t.submittedAt && formatDay(dayKey(t.submittedAt, settings.timezone), { month: "short", day: "numeric", year: "numeric" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
