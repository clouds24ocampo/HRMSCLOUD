import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { examsForJob, finalizeAttempt, shareGlobalAttempts } from "@/lib/applicants";
import { KIND_LABEL, asLang, parseOptions, secondsLeft, shuffleSeeded, timeIsUp } from "@/lib/exams";
import { Card } from "@/components/ui";
import { StartExam } from "../../../ApplyForms";
import { ExamRunner } from "./ExamRunner";

export default async function ExamPage({ params }: { params: Promise<{ applicantId: string; examId: string }> }) {
  const { applicantId, examId } = await params;
  const me = await requireUser("/apply");
  const app = await prisma.applicant.findFirst({
    where: { id: applicantId, organizationId: me.organizationId, profile: { userId: me.id } },
    include: { attempts: true, job: { select: { title: true } } },
  });
  if (!app) notFound();
  const profile = await prisma.applicantProfile.findUnique({ where: { userId: me.id }, select: { resumeKey: true, idKey: true } });
  if (!profile?.resumeKey || !profile.idKey) redirect("/apply"); // documents come before the exams
  const exams = await examsForJob(me.organizationId, app.jobId);
  const i = exams.findIndex((e) => e.id === examId);
  if (i < 0) notFound();
  const exam = exams[i];
  const submitted = new Set(app.attempts.filter((t) => t.submittedAt).map((t) => t.examId));
  if (submitted.has(examId) || app.stage === "HIRED" || app.stage === "REJECTED") redirect("/apply");
  if (!exams.slice(0, i).every((e) => submitted.has(e.id))) redirect("/apply");

  const attempt = app.attempts.find((t) => t.examId === examId);
  // Time ran out while the person was away: close the exam with no answers instead of letting them continue.
  if (attempt && timeIsUp(attempt.startedAt, exam.timeLimitMin)) {
    await finalizeAttempt(attempt.id, examId, {});
    if (app.profileId) await shareGlobalAttempts(app.profileId);
    redirect("/apply");
  }

  const back = <Link href="/apply" className="text-sm font-medium text-muted hover:text-ink">← Back to my application</Link>;

  const rows = await prisma.examQuestion.findMany({ where: { examId }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }], select: { id: true, text: true, textTl: true, options: true } });

  if (!attempt) {
    return (
      <>
        {back}
        <Card>
          <p className="text-sm text-muted">{app.job.title} · {KIND_LABEL[exam.kind]}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{exam.title}</h1>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
            <li>{exam._count.questions} questions, one answer each.</li>
            <li>You have {exam.timeLimitMin} minutes. The timer starts when you press Start and cannot be paused.</li>
            <li>You can take this exam only once. It is sent when you press Submit, or when time is up.</li>
            {exam.kind === "PSYCHOLOGICAL" && <li>There are no right or wrong answers. Answer honestly.</li>}
          </ul>
          {exam.instructions && <p className="mt-4 whitespace-pre-line text-sm text-muted">{exam.instructions}</p>}
          <div className="mt-6"><StartExam applicantId={app.id} examId={exam.id} /></div>
        </Card>
      </>
    );
  }

  // Questions go to the browser without their points: the answer key stays on the server.
  // Every applicant gets their own order of questions and of answer choices (fixed for this attempt).
  // Each choice keeps its original position `i`, which is what is sent back and scored.
  const questions = shuffleSeeded(rows, attempt.id).map((q) => ({
    id: q.id, text: q.text, textTl: q.textTl,
    options: shuffleSeeded(parseOptions(q.options).map((o, i) => ({ i, text: o.text, textTl: o.textTl ?? null })), attempt.id + q.id),
  }));
  return (
    <>
      {back}
      <ExamRunner applicantId={app.id} examId={exam.id} title={exam.title} lang={asLang(attempt.lang)} questions={questions} secondsLeft={Math.max(0, secondsLeft(attempt.startedAt, exam.timeLimitMin))} />
    </>
  );
}
