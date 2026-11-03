// Question-by-question review of one submitted exam attempt, for HR and admin. Pure, so it can be tested.
import { parseOptions, pick, type Answers, type ExamKindKey, type Lang } from "@/lib/exams";

export type ReviewQuestion = { id: string; text: string; trait: string | null; options: unknown; sort: number };
export type ReviewRow = {
  n: number; text: string; trait: string | null;
  chosen: string | null; correct: string | null; // correct is only for knowledge exams
  points: number; max: number; right: boolean | null; // right is null for psychological exams
};

export function reviewAttempt(kind: ExamKindKey, questions: ReviewQuestion[], answers: Answers | null): ReviewRow[] {
  return [...questions].sort((a, b) => a.sort - b.sort).map((q, i) => {
    const opts = parseOptions(q.options);
    const pick = answers?.[q.id];
    const chosen = pick !== undefined ? opts[pick] : undefined;
    const best = opts.reduce((m, o) => (o.points > m.points ? o : m), opts[0] ?? { text: "", points: 0 });
    const points = chosen?.points ?? 0;
    return {
      n: i + 1, text: q.text, trait: q.trait, chosen: chosen?.text ?? null,
      correct: kind === "KNOWLEDGE" ? best.text : null, points, max: best.points,
      right: kind === "KNOWLEDGE" ? points === best.points && !!chosen : null,
    };
  });
}

export const durationMin = (startedAt: Date, submittedAt: Date | null) => (submittedAt ? Math.max(0, Math.round(((submittedAt.getTime() - startedAt.getTime()) / 60_000) * 10) / 10) : null);

// What the person themselves chose in the commitment exam, in the language they took it. No points and no best answer: the
// employee sees their own decisions, not the answer key. Questions they left blank show as "Not answered".
export type CommitmentQuestion = { id: string; text: string; textTl: string | null; trait: string | null; options: unknown; sort: number };
export function commitmentRecord(questions: CommitmentQuestion[], answers: Answers | null, lang: Lang) {
  return [...questions].sort((a, b) => a.sort - b.sort).map((q, i) => {
    const opts = parseOptions(q.options);
    const pickIdx = answers?.[q.id];
    const o = pickIdx !== undefined ? opts[pickIdx] : undefined;
    return { n: i + 1, trait: q.trait, question: pick(q.text, q.textTl, lang), chosen: o ? pick(o.text, o.textTl, lang) : null };
  });
}
