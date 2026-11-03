// What the browser gets while an exam is open. Pure, so it can be tested.
// The questions and the answer choices are mixed with a seed. The seed is the random token made at every Start, so every Start
// (the first one, a start after leaving the screen, a start after a reload) gives a new order that nobody can predict or repeat.
// Points never leave the server.
import { parseOptions, shuffleSeeded } from "@/lib/exams";

export type RunQuestion = { id: string; text: string; textTl: string | null; options: { i: number; text: string; textTl: string | null }[] };
export type ExamRun = { token: string; secondsLeft: number; lang: "en" | "tl"; questions: RunQuestion[] };
export type RunResult = { error: string } | { done: true } | { run: ExamRun };

export function questionsFor(rows: { id: string; text: string; textTl: string | null; options: unknown }[], seed: string): RunQuestion[] {
  return shuffleSeeded(rows, seed).map((q) => ({
    id: q.id, text: q.text, textTl: q.textTl,
    options: shuffleSeeded(parseOptions(q.options).map((o, i) => ({ i, text: o.text, textTl: o.textTl ?? null })), seed + q.id), // `i` is the original position: what is sent back and scored
  }));
}
