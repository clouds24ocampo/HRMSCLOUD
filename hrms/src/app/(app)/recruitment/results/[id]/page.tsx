import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getOrgSettings } from "@/lib/settings";
import { durationMin, reviewAttempt } from "@/lib/exam-results";
import { KIND_LABEL, passed, type Answers } from "@/lib/exams";
import { STAGE_LABEL, STAGE_TONE } from "@/lib/stages";
import { Badge, Card, PageHeader, ghostClass } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { Meter } from "@/components/Charts";
import { commitmentBand } from "@/lib/commitment-result";
import { dayKey, formatDay } from "@/lib/time";

// One handed-in exam, answer by answer. For knowledge exams: what the applicant chose against the right answer.
// For the psychological exam: what they chose and the points it carries, and the score per trait.
export default async function ResultDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/recruitment");
  const t = await prisma.examAttempt.findFirst({
    where: { id, submittedAt: { not: null }, applicant: { organizationId: me.organizationId } },
    include: {
      exam: { include: { questions: true } },
      applicant: { include: { job: { select: { title: true } }, profile: { select: { applicantNo: true } } } },
    },
  });
  if (!t) notFound();
  const settings = await getOrgSettings(me.organizationId);
  await audit(me.id, "exam.result_viewed", "ExamAttempt", id, { applicantId: t.applicantId }, me.organizationId);

  const rows = reviewAttempt(t.exam.kind, t.exam.questions, (t.answers ?? {}) as Answers);
  const pct = t.maxScore ? Math.round(((t.score ?? 0) / t.maxScore) * 100) : 0;
  const ok = t.exam.passingPct != null ? passed(pct, t.exam.passingPct) : null;
  const traits = Object.entries((t.breakdown ?? {}) as Record<string, { score: number; max: number }>).map(([name, v]) => ({ name, pct: v.max ? Math.round((v.score / v.max) * 100) : 0 })).sort((a, b) => b.pct - a.pct);
  const right = rows.filter((r) => r.right).length;
  const blank = rows.filter((r) => r.chosen === null).length;
  const a = t.applicant;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t.exam.title}
        subtitle={`${a.name}${a.profile ? ` · ${a.profile.applicantNo}` : ""} · ${a.job.title}`}
        action={<div className="flex flex-wrap gap-2 print:hidden"><Link href="/recruitment/results" className={ghostClass}>← All results</Link><Link href={`/recruitment/applicants/${a.id}`} className={ghostClass}>Applicant profile</Link><Link href={`/recruitment/${a.jobId}`} className={ghostClass}>Applicant card</Link><PrintButton /></div>}
      />
      <Card>
        <div className="grid gap-4 sm:grid-cols-4">
          <div><p className="text-sm text-muted">Score</p><p className="text-3xl font-bold">{pct}%</p><p className="text-sm text-muted">{t.score} of {t.maxScore} points</p></div>
          <div><p className="text-sm text-muted">Result</p><p className="mt-1">{ok === null ? (t.exam.kind === "COMMITMENT" ? <Badge tone={commitmentBand(pct).tone}>{commitmentBand(pct).label}</Badge> : <Badge>Mindset score</Badge>) : ok ? <Badge tone="success">Passed (needs {t.exam.passingPct}%)</Badge> : <Badge tone="danger">Below passing ({t.exam.passingPct}%)</Badge>}</p><p className="mt-1 text-sm text-muted">{KIND_LABEL[t.exam.kind]}</p>{t.leaves > 0 && <p className="mt-1"><Badge tone="warning">Left the exam screen {t.leaves}×</Badge></p>}</div>
          <div><p className="text-sm text-muted">Time taken</p><p className="text-xl font-semibold">{durationMin(t.startedAt, t.submittedAt)} min</p><p className="text-sm text-muted">of {t.exam.timeLimitMin} allowed</p></div>
          <div><p className="text-sm text-muted">Language</p><p className="text-xl font-semibold">{t.lang === "tl" ? "Tagalog" : "English"}</p><p className="mt-1"><Badge tone={STAGE_TONE[a.stage]}>{STAGE_LABEL[a.stage]}</Badge></p></div>
        </div>
        <p className="mt-4 text-sm text-muted">Submitted {t.submittedAt && formatDay(dayKey(t.submittedAt, settings.timezone), { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.{t.leaves > 0 && <> Changed tab, minimized or reloaded {t.leaves} {t.leaves === 1 ? "time" : "times"} during the exam; each time it went back to the start with the questions mixed again.</>}{t.oathAt && <> Oath to the corporation taken {formatDay(dayKey(t.oathAt, settings.timezone), { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.</>}{t.exam.kind === "KNOWLEDGE" ? ` ${right} right, ${rows.length - right - blank} wrong, ${blank} not answered.` : blank ? ` ${blank} not answered.` : ""}</p>
      </Card>

      {traits.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.exam.kind === "COMMITMENT" ? "Corporate commitment by area" : "Mindset by trait"}</h2>
          <ul className="space-y-3">{traits.map((x) => (
            <li key={x.name}><div className="flex justify-between text-sm"><span>{x.name}</span><span className="font-semibold">{x.pct}%</span></div><div className="mt-1"><Meter value={x.pct} tone={x.pct >= 70 ? "success" : x.pct >= 50 ? "warning" : "danger"} /></div></li>
          ))}</ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Every answer</h2>
        <p className="mb-4 text-sm text-muted">Shown in English, in the order the questions are stored (the applicant saw them in a random order).</p>
        <ol className="space-y-4">
          {rows.map((r) => (
            <li key={r.n} className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium"><span className="text-muted">{r.n}.</span> {r.text}</p>
                {r.right === null ? <Badge>{r.points}/{r.max} pts</Badge> : r.right ? <Badge tone="success">Right</Badge> : <Badge tone="danger">{r.chosen ? "Wrong" : "No answer"}</Badge>}
              </div>
              {r.trait && <p className="mt-1 text-xs text-muted">Trait: {r.trait}</p>}
              <p className="mt-2 text-sm"><span className="text-muted">Answered: </span><span className={r.right === false ? "font-medium text-danger" : "font-medium"}>{r.chosen ?? "No answer"}</span></p>
              {r.correct && r.right !== true && <p className="text-sm"><span className="text-muted">Right answer: </span><span className="font-medium text-success">{r.correct}</span></p>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
