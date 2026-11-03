import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { questionsFor } from "./exam-run";

const rows = Array.from({ length: 30 }, (_, n) => ({
  id: `q${n}`, text: `Question ${n}`, textTl: null,
  options: [{ text: "A", points: 4 }, { text: "B", points: 3 }, { text: "C", points: 1 }, { text: "D", points: 0 }],
}));
const qOrder = (seed: string) => questionsFor(rows, seed).map((q) => q.id).join();
const cOrder = (seed: string) => questionsFor(rows, seed).map((q) => q.options.map((o) => o.i).join("")).join("|");

describe("exam run", () => {
  it("gives the same order for the same seed", () => {
    expect(qOrder("s1")).toBe(qOrder("s1"));
  });
  it("gives a different order of questions and of choices at every Start (200 random starts, none repeats)", () => {
    const seeds = Array.from({ length: 200 }, () => randomUUID());
    expect(new Set(seeds.map(qOrder)).size).toBe(200);
    expect(new Set(seeds.map(cOrder)).size).toBe(200);
  });
  it("moves questions around: no question stays at the same place across starts", () => {
    const first = qOrder("a").split(",");
    const same = Array.from({ length: 30 }, (_, i) => i).filter((i) => Array.from({ length: 20 }, (_, k) => qOrder(`seed${k}`).split(",")[i]).every((id) => id === first[i]));
    expect(same).toHaveLength(0);
  });
  it("keeps each choice's original position and never sends points", () => {
    for (const q of questionsFor(rows, "x")) expect(q.options.map((o) => o.i).sort()).toEqual([0, 1, 2, 3]);
    expect(JSON.stringify(questionsFor(rows, "s"))).not.toMatch(/points/);
  });
});
