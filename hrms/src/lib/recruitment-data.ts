// Loads the rows the recruitment analytics are built from. One place, so the dashboard, its click-through lists,
// the CSV export and the printed report always show the same numbers.
import { prisma } from "@/lib/prisma";
import { rangeStart, type AppRow, type JobRow } from "@/lib/recruitment-stats";

export const RANGES = [["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last year"], ["all", "All time"]] as const;
export const rangeOf = (r?: string) => (RANGES.some(([k]) => k === r) ? r! : "all");
export const rangeLabel = (r: string) => RANGES.find(([k]) => k === r)?.[1] ?? "All time";

export async function loadRecruitment(organizationId: string, range: string): Promise<{ jobs: JobRow[]; apps: AppRow[] }> {
  const since = rangeStart(range);
  const [jobs, rows] = await Promise.all([
    prisma.jobPosting.findMany({ where: { organizationId }, select: { id: true, title: true, openings: true, status: true } }),
    prisma.applicant.findMany({
      where: { organizationId, ...(since ? { createdAt: { gte: since } } : {}) },
      include: { job: { select: { title: true } }, profile: { select: { resumeKey: true, idKey: true, applicantNo: true } }, attempts: { include: { exam: { select: { kind: true, title: true, passingPct: true } } } } },
    }),
  ]);
  const apps: AppRow[] = rows.map((a) => ({
    id: a.id, name: a.name, jobId: a.jobId, jobTitle: a.job.title, stage: a.stage, source: a.source, createdAt: a.createdAt, updatedAt: a.updatedAt,
    personKey: a.profileId ?? a.id, docsDone: !!a.profile?.resumeKey && !!a.profile?.idKey,
    email: a.email, phone: a.phone, applicantNo: a.profile?.applicantNo ?? null, hasResume: !!a.profile?.resumeKey, hasId: !!a.profile?.idKey,
    attempts: a.attempts.map((t) => ({
      examId: t.examId, kind: t.exam.kind, examTitle: t.exam.title, passingPct: t.exam.passingPct, startedAt: t.startedAt, submittedAt: t.submittedAt,
      score: t.score, maxScore: t.maxScore, lang: t.lang, breakdown: (t.breakdown ?? null) as Record<string, { score: number; max: number }> | null,
    })),
  }));
  return { jobs, apps };
}
