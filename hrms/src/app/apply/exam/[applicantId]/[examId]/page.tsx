import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { closeRun, examsForJob, finalizeAttempt, shareGlobalAttempts } from "@/lib/applicants";
import { KIND_LABEL, asLang, secondsLeft, timeIsUp } from "@/lib/exams";
import { ExamPlayer, type PlayerInfo } from "./ExamPlayer";

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

  // The page never carries the questions. If a run is still open here, the person reloaded or left without the screen telling us:
  // that run is closed now and the next start is a new random order.
  let leaves = attempt?.leaves ?? 0;
  if (attempt?.runToken && (await closeRun(attempt.id))) leaves += 1;

  const info: PlayerInfo = {
    applicantId: app.id, examId: exam.id, title: exam.title, kindLabel: KIND_LABEL[exam.kind], jobTitle: app.job.title,
    questionCount: exam._count.questions, timeLimitMin: exam.timeLimitMin, instructions: exam.instructions,
    psychological: exam.kind === "PSYCHOLOGICAL", commitment: exam.kind === "COMMITMENT",
    resumed: attempt ? { lang: asLang(attempt.lang), minutesLeft: Math.max(1, Math.ceil(secondsLeft(attempt.startedAt, exam.timeLimitMin) / 60)), leaves } : null,
  };
  return <ExamPlayer info={info} />;
}
