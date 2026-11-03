import { describe, expect, it } from "vitest";
import { commitmentRecord } from "./exam-results";

const q = (id: string, sort: number, tl: string | null) => ({
  id, sort, text: `Q${sort}`, textTl: tl, trait: "Loyalty",
  options: [{ text: "Best", textTl: "Pinakamahusay", points: 4 }, { text: "Worst", points: 0 }],
});

describe("commitmentRecord", () => {
  it("lists the person's own choices in question order, with no points", () => {
    const r = commitmentRecord([q("b", 2, null), q("a", 1, "T1")], { a: 1, b: 0 }, "en");
    expect(r.map((x) => [x.n, x.question, x.chosen])).toEqual([[1, "Q1", "Worst"], [2, "Q2", "Best"]]);
    expect(JSON.stringify(r)).not.toMatch(/points|correct/i);
  });
  it("uses Tagalog when the exam was taken in Tagalog, English where no Tagalog exists, and shows blanks", () => {
    const r = commitmentRecord([q("a", 1, "T1"), q("b", 2, null)], { a: 0 }, "tl");
    expect(r[0]).toMatchObject({ question: "T1", chosen: "Pinakamahusay" });
    expect(r[1]).toMatchObject({ question: "Q2", chosen: null });
  });
});
