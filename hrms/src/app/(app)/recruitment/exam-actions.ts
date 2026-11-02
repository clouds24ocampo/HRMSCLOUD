"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { STARTER_POSITIONS } from "@/lib/exams";
import { ensureTagalog } from "@/lib/translate";
import { roleFields } from "@/lib/exam-bank";
import type { FormState } from "@/app/login/actions";

// Exams are HR-only, like the rest of recruitment (requireUser("/recruitment") applies the page rule).
const opt = z.string().optional().transform((v) => v?.trim() || undefined);
const done = (examId?: string) => {
  revalidatePath("/recruitment/exams");
  if (examId) revalidatePath(`/recruitment/exams/${examId}`);
};

const examOf = async (id: string, organizationId: string) => prisma.exam.findFirst({ where: { id, organizationId } });

export async function createExam(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const parsed = z
    .object({
      title: z.string().trim().min(3, "Give the exam a title.").max(100),
      kind: z.enum(["KNOWLEDGE", "PSYCHOLOGICAL"], { error: "Choose the exam type." }),
      jobId: opt, instructions: opt,
      timeLimitMin: z.coerce.number().int().min(1, "At least 1 minute.").max(300, "At most 300 minutes."),
      passingPct: z.union([z.literal(""), z.coerce.number().int().min(1).max(100)]).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.jobId && !(await prisma.jobPosting.findFirst({ where: { id: d.jobId, organizationId: me.organizationId } }))) return { error: "Choose a position from the list." };
  const exam = await prisma.exam.create({
    data: {
      organizationId: me.organizationId, title: d.title, kind: d.kind, jobId: d.jobId ?? null, instructions: d.instructions, timeLimitMin: d.timeLimitMin,
      passingPct: d.kind === "KNOWLEDGE" ? (d.passingPct === "" || d.passingPct === undefined ? 60 : d.passingPct) : null,
    },
  });
  await audit(me.id, "exam.created", "Exam", exam.id, { title: exam.title, kind: exam.kind }, me.organizationId);
  done();
  redirect(`/recruitment/exams/${exam.id}`);
}

export async function setExamActive(id: string, active: boolean) {
  const me = await requireUser("/recruitment");
  const exam = await examOf(id, me.organizationId);
  if (!exam) return;
  await prisma.exam.update({ where: { id }, data: { active } });
  await audit(me.id, active ? "exam.activated" : "exam.deactivated", "Exam", id, { title: exam.title }, me.organizationId);
  done(id);
}

export async function deleteExam(id: string) {
  const me = await requireUser("/recruitment");
  const exam = await examOf(id, me.organizationId);
  if (!exam) return;
  await prisma.exam.delete({ where: { id } }); // its questions and every applicant's attempt go with it
  await audit(me.id, "exam.deleted", "Exam", id, { title: exam.title }, me.organizationId);
  done();
  redirect("/recruitment/exams");
}

// One question. Knowledge: the "right" radio gets 1 point, others 0. Psychological: every option has its own points.
export async function addQuestion(examId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const exam = await examOf(examId, me.organizationId);
  if (!exam) return { error: "Exam not found." };
  const text = z.string().trim().min(3, "Write the question.").max(1000).safeParse(form.get("text"));
  if (!text.success) return { error: text.error.issues[0].message };
  const trait = String(form.get("trait") ?? "").trim().slice(0, 40) || null;
  const correct = Number(form.get("correct"));
  const options: { text: string; points: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const t = String(form.get(`opt${i}`) ?? "").trim().slice(0, 300);
    if (!t) continue;
    const pts = Math.round(Number(form.get(`pts${i}`) || 0));
    if (exam.kind === "KNOWLEDGE") options.push({ text: t, points: i === correct ? 1 : 0 });
    else {
      if (!Number.isFinite(pts) || pts < 0 || pts > 10) return { error: "Points must be from 0 to 10." };
      options.push({ text: t, points: pts });
    }
  }
  if (options.length < 2) return { error: "Give at least two answer choices." };
  if (exam.kind === "KNOWLEDGE" && !options.some((o) => o.points === 1)) return { error: "Mark which choice is correct." };
  const last = await prisma.examQuestion.findFirst({ where: { examId }, orderBy: { sort: "desc" }, select: { sort: true } });
  await prisma.examQuestion.create({ data: { examId, text: text.data, trait: exam.kind === "PSYCHOLOGICAL" ? trait : null, options, sort: (last?.sort ?? 0) + 1 } });
  await ensureTagalog(examId); // the system writes the Tagalog version; HR types English only
  await audit(me.id, "exam.question_added", "Exam", examId, undefined, me.organizationId);
  done(examId);
  return { ok: "Question added." };
}

export async function deleteQuestion(id: string) {
  const me = await requireUser("/recruitment");
  const q = await prisma.examQuestion.findFirst({ where: { id, exam: { organizationId: me.organizationId } } });
  if (!q) return;
  await prisma.examQuestion.delete({ where: { id } });
  await audit(me.id, "exam.question_deleted", "Exam", q.examId, undefined, me.organizationId);
  done(q.examId);
}

// Adds the standard positions the company hires for. A title that already exists is skipped, so it is safe to press twice.
export async function addStarterPositions(): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const have = new Set((await prisma.jobPosting.findMany({ where: { organizationId: me.organizationId }, select: { title: true } })).map((j) => j.title.toLowerCase()));
  const fresh = STARTER_POSITIONS.filter((t) => !have.has(t.toLowerCase()));
  if (!fresh.length) return { ok: "All the starter positions are already there." };
  await prisma.jobPosting.createMany({ data: fresh.map((title) => ({ organizationId: me.organizationId, title, ...roleFields(title), createdById: me.id })) });
  await audit(me.id, "job.starter_added", "JobPosting", undefined, { count: fresh.length }, me.organizationId);
  revalidatePath("/recruitment");
  return { ok: `Added ${fresh.length} position${fresh.length === 1 ? "" : "s"}. They are open for applications.` };
}
