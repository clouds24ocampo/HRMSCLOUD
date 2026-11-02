import { describe, expect, it } from "vitest";
import { passed, scoreExam, secondsLeft, shuffleSeeded, timeIsUp, type Question } from "./exams";

const opt = (...pts: number[]) => pts.map((points, i) => ({ text: `o${i}`, points }));
const qs: Question[] = [
  { id: "a", trait: null, options: opt(0, 1, 0) },
  { id: "b", trait: null, options: opt(1, 0) },
];
const psy: Question[] = [
  { id: "p1", trait: "Teamwork", options: opt(0, 2, 4) },
  { id: "p2", trait: "Teamwork", options: opt(4, 0) },
  { id: "p3", trait: "Discipline", options: opt(1, 3) },
];

describe("scoreExam", () => {
  it("scores right answers and counts blanks as zero", () => {
    expect(scoreExam(qs, { a: 1, b: 1 })).toMatchObject({ score: 1, max: 2, pct: 50 });
    expect(scoreExam(qs, { a: 1, b: 0 }).pct).toBe(100);
    expect(scoreExam(qs, {}).pct).toBe(0);
  });
  it("ignores an out-of-range choice", () => {
    expect(scoreExam(qs, { a: 99, b: -1 }).score).toBe(0);
  });
  it("breaks psychological scores down by trait", () => {
    const r = scoreExam(psy, { p1: 2, p2: 1, p3: 1 });
    expect(r.breakdown).toEqual({ Teamwork: { score: 4, max: 8 }, Discipline: { score: 3, max: 3 } });
    expect(r).toMatchObject({ score: 7, max: 11 });
  });
  it("has no divide-by-zero on an empty exam", () => {
    expect(scoreExam([], {}).pct).toBe(0);
  });
});

describe("passed / timer", () => {
  it("passes at the threshold; no threshold always passes", () => {
    expect(passed(60, 60)).toBe(true);
    expect(passed(59, 60)).toBe(false);
    expect(passed(0, null)).toBe(true);
  });
  it("allows a short grace after the limit", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(secondsLeft(start, 10, new Date("2026-01-01T00:09:00Z"))).toBe(60);
    expect(timeIsUp(start, 10, new Date("2026-01-01T00:10:20Z"))).toBe(false);
    expect(timeIsUp(start, 10, new Date("2026-01-01T00:10:40Z"))).toBe(true);
  });
});

describe("shuffleSeeded", () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  it("keeps every item exactly once", () => {
    expect([...shuffleSeeded(items, "a")].sort((x, y) => x - y)).toEqual(items);
  });
  it("gives the same order for the same seed", () => {
    expect(shuffleSeeded(items, "attempt-1")).toEqual(shuffleSeeded(items, "attempt-1"));
  });
  it("gives different orders for different attempts", () => {
    const orders = new Set(Array.from({ length: 20 }, (_, n) => shuffleSeeded(items, `attempt-${n}`).join(",")));
    expect(orders.size).toBe(20);
  });
  it("does not change the input", () => {
    const copy = [...items];
    shuffleSeeded(items, "x");
    expect(items).toEqual(copy);
  });
});
