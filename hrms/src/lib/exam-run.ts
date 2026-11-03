// What the browser gets while an exam is open. Pure, so it can be tested.
// The questions are mixed with a seed made of the attempt and its round. Every time the person leaves the exam screen the
// round goes up, so the next start shows a new order of questions and of answer choices. Points never leave the server.
import { parseOptions, shuffleSeeded } from "@/lib/exams";

export type RunQuestion = { id: string; text: string; textTl: string | null; options: { i: number; text: string; textTl: string | null }[] };
export type ExamRun = { token: string; secondsLeft: number; lang: "en" | "tl"; questions: RunQuestion[] };
export type RunResult = { error: string } | { done: true } | { run: ExamRun };

export const runSeed = (attemptId: string, round: number) => `${attemptId}:${round}`;

export function questionsFor(rows: { id: string; text: string; textTl: string | null; options: unknown }[], seed: string): RunQuestion[] {
  return shuffleSeeded(rows, seed).map((q) => ({
    id: q.id, text: q.text, textTl: q.textTl,
    options: shuffleSeeded(parseOptions(q.options).map((o, i) => ({ i, text: o.text, textTl: o.textTl ?? null })), seed + q.id), // `i` is the original position: what is sent back and scored
  }));
}
