import { describe, expect, it } from "vitest";
import { questionsFor, runSeed } from "./exam-run";

const rows = Array.from({ length: 30 }, (_, n) => ({
  id: `q${n}`, text: `Question ${n}`, textTl: null,
  options: [{ text: "A", points: 4 }, { text: "B", points: 3 }, { text: "C", points: 1 }, { text: "D", points: 0 }],
}));

describe("exam run", () => {
  it("keeps the same order for the same round and changes it after a leave", () => {
    const ids = (r: number) => questionsFor(rows, runSeed("att1", r)).map((q) => q.id).join();
    expect(ids(0)).toBe(ids(0));
    expect(ids(1)).not.toBe(ids(0));
    expect(ids(2)).not.toBe(ids(1));
  });
  it("mixes the answer choices too, and keeps each choice's original position", () => {
    const a = questionsFor(rows, runSeed("att1", 0)), b = questionsFor(rows, runSeed("att1", 1));
    const order = (qs: typeof a) => qs.map((q) => q.options.map((o) => o.i).join("")).join("|");
    expect(order(a)).not.toBe(order(b));
    for (const q of a) expect(q.options.map((o) => o.i).sort()).toEqual([0, 1, 2, 3]);
  });
  it("never sends points", () => {
    expect(JSON.stringify(questionsFor(rows, "s"))).not.toMatch(/points/);
  });
});
