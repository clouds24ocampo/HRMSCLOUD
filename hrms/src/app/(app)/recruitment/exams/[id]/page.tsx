import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { KIND_LABEL, parseOptions } from "@/lib/exams";
import { Badge, Card, PageHeader } from "@/components/ui";
import { DeleteQuestionButton, ExamControls, QuestionForm } from "../ExamForms";

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/recruitment");
  const exam = await prisma.exam.findFirst({
    where: { id, organizationId: me.organizationId },
    include: { job: { select: { title: true } }, questions: { orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }, _count: { select: { attempts: true } } },
  });
  if (!exam) notFound();
  const knowledge = exam.kind === "KNOWLEDGE";
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/recruitment/exams" className="text-sm font-medium text-muted hover:text-ink">← All exams</Link>
      <PageHeader
        title={exam.title}
        subtitle={`${KIND_LABEL[exam.kind]} · ${exam.job?.title ?? "Every position"} · ${exam.timeLimitMin} min${exam.passingPct ? ` · pass at ${exam.passingPct}%` : ""} · taken ${exam._count.attempts}×`}
        action={<div className="flex items-center gap-2"><Badge tone={exam.active ? "success" : "neutral"}>{exam.active ? "On" : "Off"}</Badge><ExamControls id={exam.id} active={exam.active} /></div>}
      />
      {exam._count.attempts > 0 && <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">Applicants already took this exam. Their scores stay as they were; new questions only count for the next applicants.</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <section aria-label="Questions">
          <h2 className="mb-3 font-semibold">Questions ({exam.questions.length})</h2>
          {exam.questions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">No questions yet. Applicants skip an exam with no questions.</p>
          ) : (
            <ol className="space-y-3">
              {exam.questions.map((q, n) => (
                <li key={q.id}>
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium"><p><span className="text-muted">{n + 1}.</span> {q.text}</p>{q.textTl && <p className="mt-0.5 text-sm font-normal text-muted">TL: {q.textTl}</p>}</div>
                      <DeleteQuestionButton id={q.id} />
                    </div>
                    {q.trait && <p className="mt-1 text-xs text-muted">Trait: {q.trait}</p>}
                    <ul className="mt-2 space-y-1 text-sm">
                      {parseOptions(q.options).map((o, i) => (
                        <li key={i} className={knowledge && o.points > 0 ? "font-medium text-success" : ""}>
                          {String.fromCharCode(65 + i)}. {o.text}{o.textTl && <span className="text-muted"> / {o.textTl}</span>}{" "}
                          {knowledge ? (o.points > 0 ? "✓" : "") : <span className="text-muted">({o.points} pt{o.points === 1 ? "" : "s"})</span>}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </section>
        <Card className="h-fit">
          <h2 className="mb-3 text-lg font-semibold">Add a question</h2>
          <QuestionForm examId={exam.id} kind={exam.kind} />
        </Card>
      </div>
    </div>
  );
}
