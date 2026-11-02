// Applicant portal rules in one place: which org the careers page belongs to, which exams a job needs,
// how an attempt is closed, and when an application is complete.
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { ROLES } from "@/lib/roles";
import { parseOptions, scoreExam, type Answers } from "@/lib/exams";

// One company per install, so the careers page belongs to the first organization.
// ponytail: with ALLOW_MULTIPLE_ORGS (tests only) this is still the first one; add an org slug to the URL if that ever matters.
export const careersOrg = () => prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });

export const openJobs = (organizationId: string) =>
  prisma.jobPosting.findMany({ where: { organizationId, status: "OPEN" }, orderBy: { title: "asc" }, select: { id: true, title: true, description: true, descriptionTl: true, duties: true, dutiesTl: true, openings: true, department: { select: { name: true } } } });

// Exams an applicant of this job must take, in order: psychological first, then position knowledge. Empty exams are skipped.
export const examsForJob = (organizationId: string, jobId: string) =>
  prisma.exam.findMany({
    where: { organizationId, active: true, OR: [{ jobId }, { jobId: null }], questions: { some: {} } },
    orderBy: [{ kind: "desc" }, { createdAt: "asc" }], // enum order is KNOWLEDGE, PSYCHOLOGICAL: descending puts psychological first
    select: { id: true, kind: true, title: true, instructions: true, timeLimitMin: true, _count: { select: { questions: true } } },
  });

// An exam that is not tied to one position (jobId null, e.g. the psychological exam) is taken once per person.
// Their result is copied onto every one of their applications, so applying for more positions never repeats it.
export async function shareGlobalAttempts(profileId: string) {
  const apps = await prisma.applicant.findMany({
    where: { profileId },
    select: { id: true, attempts: { select: { examId: true, startedAt: true, submittedAt: true, lang: true, answers: true, score: true, maxScore: true, breakdown: true, exam: { select: { jobId: true } } } } },
  });
  const done = new Map<string, (typeof apps)[number]["attempts"][number]>();
  for (const a of apps) for (const t of a.attempts) if (t.submittedAt && t.exam.jobId === null) done.set(t.examId, t);
  const rows = [];
  for (const a of apps) {
    const have = new Set(a.attempts.map((t) => t.examId));
    for (const [examId, t] of done) {
      if (have.has(examId)) continue;
      rows.push({ applicantId: a.id, examId, lang: t.lang, startedAt: t.startedAt, submittedAt: t.submittedAt, answers: t.answers ?? undefined, score: t.score, maxScore: t.maxScore, breakdown: t.breakdown ?? undefined });
    }
  }
  if (rows.length) await prisma.examAttempt.createMany({ data: rows, skipDuplicates: true });
}

// Closes an attempt exactly once (a second call changes nothing) and stores the score.
export async function finalizeAttempt(attemptId: string, examId: string, answers: Answers) {
  const qs = await prisma.examQuestion.findMany({ where: { examId }, select: { id: true, trait: true, options: true } });
  const r = scoreExam(qs.map((q) => ({ id: q.id, trait: q.trait, options: parseOptions(q.options) })), answers);
  const res = await prisma.examAttempt.updateMany({
    where: { id: attemptId, submittedAt: null },
    data: { submittedAt: new Date(), answers, score: r.score, maxScore: r.max, breakdown: r.breakdown },
  });
  return res.count === 1;
}

// When a person has taken every exam and uploaded the resume and ID, their application moves to Screening
// and HR is told. Runs after each exam and each upload.
export async function advanceIfComplete(profileId: string) {
  const profile = await prisma.applicantProfile.findUnique({ where: { id: profileId }, include: { user: { select: { name: true } } } });
  if (!profile?.resumeKey || !profile.idKey) return;
  const apps = await prisma.applicant.findMany({ where: { profileId, stage: "APPLIED" }, include: { job: { select: { title: true } }, attempts: { where: { submittedAt: { not: null } }, select: { examId: true } } } });
  for (const a of apps) {
    const need = await examsForJob(profile.organizationId, a.jobId);
    const done = new Set(a.attempts.map((t) => t.examId));
    if (!need.every((e) => done.has(e.id))) continue;
    await prisma.$transaction([
      prisma.applicant.update({ where: { id: a.id }, data: { stage: "SCREENING" } }),
      prisma.applicantNote.create({ data: { organizationId: profile.organizationId, applicantId: a.id, stage: "SCREENING", text: "Completed the exams and uploaded the resume and valid ID." } }),
    ]);
    const hr = await prisma.user.findMany({ where: { organizationId: profile.organizationId, active: true, role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN] } } }, select: { id: true } });
    await notify(profile.organizationId, hr.map((u) => u.id), { title: `${profile.user.name} finished applying for ${a.job.title}`, href: `/recruitment/${a.jobId}` });
  }
}
