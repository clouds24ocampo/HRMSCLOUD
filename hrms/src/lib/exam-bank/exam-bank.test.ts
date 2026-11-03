import { describe, expect, it } from "vitest";
import { EXAM_ORDER, OATH, STARTER_POSITIONS } from "../exams";
import { COMMITMENT, KNOWLEDGE_BANK, PSYCH, ROLE_INFO, knowledgeOptions, psychOptions, roleFields } from "./index";

describe("knowledge bank", () => {
  it("covers every starter position with exactly 30 questions", () => {
    expect(Object.keys(KNOWLEDGE_BANK).sort()).toEqual([...STARTER_POSITIONS].sort());
    for (const [pos, qs] of Object.entries(KNOWLEDGE_BANK)) expect([pos, qs.length]).toEqual([pos, 30]);
  });
  it("has 4 distinct, non-empty choices and a unique question text per position", () => {
    for (const [pos, qs] of Object.entries(KNOWLEDGE_BANK)) {
      const texts = new Set<string>();
      for (const q of qs) {
        expect(q.length, pos).toBe(5);
        expect(q.every((t) => t.trim().length > 0), `${pos}: ${q[0]}`).toBe(true);
        expect(new Set(q.slice(1)).size, `${pos}: ${q[0]}`).toBe(4);
        expect(texts.has(q[0]), `${pos}: duplicate ${q[0]}`).toBe(false);
        texts.add(q[0]);
      }
    }
  });
  it("marks exactly one right choice and spreads it over A-D", () => {
    for (const [pos, qs] of Object.entries(KNOWLEDGE_BANK)) {
      const slots = [0, 0, 0, 0];
      qs.forEach((q, i) => {
        const o = knowledgeOptions(q, i, pos.length);
        expect(o.filter((c) => c.points === 1)).toHaveLength(1);
        expect(o.find((c) => c.points === 1)!.text).toBe(q[1]);
        slots[o.findIndex((c) => c.points === 1)]++;
      });
      for (const n of slots) expect(n, pos).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("psychological exam", () => {
  it("has 30 questions: 10 traits x 3", () => {
    expect(PSYCH).toHaveLength(30);
    const byTrait = new Map<string, number>();
    for (const q of PSYCH) byTrait.set(q[0], (byTrait.get(q[0]) ?? 0) + 1);
    expect(byTrait.size).toBe(10);
    for (const n of byTrait.values()) expect(n).toBe(3);
  });
  it("keeps points 4, 3, 1, 0 on every question, whatever the order shown", () => {
    PSYCH.forEach((q, i) => {
      const o = psychOptions(q, i);
      expect(o.map((c) => c.points).sort()).toEqual([0, 1, 3, 4]);
      expect(new Set(o.map((c) => c.text)).size).toBe(4);
    });
  });
});

const NL = String.fromCharCode(10);
describe("role descriptions", () => {
  it("gives every position a summary and 5 duties in English and Tagalog", () => {
    expect(Object.keys(ROLE_INFO).sort()).toEqual(Object.keys(KNOWLEDGE_BANK).sort());
    for (const [pos, r] of Object.entries(ROLE_INFO)) {
      expect(r.summary.every((t) => t.trim().length > 10), pos).toBe(true);
      expect(r.duties, pos).toHaveLength(5);
      for (const [en, tl] of r.duties) {
        expect(en.trim().length, pos).toBeGreaterThan(10);
        expect(tl.trim().length, pos).toBeGreaterThan(10);
        expect(tl, `${pos}: Tagalog must differ from English`).not.toBe(en);
      }
    }
  });
  it("stores duties one per line with the same count in both languages", () => {
    for (const pos of Object.keys(ROLE_INFO)) {
      const f = roleFields(pos)!;
      expect(f.duties.split(NL)).toHaveLength(f.dutiesTl.split(NL).length);
    }
    expect(roleFields("Unknown job")).toBeNull();
  });
});

describe("commitment exam", () => {
  it("has 30 questions: 10 traits x 3, each with 4 distinct choices", () => {
    expect(COMMITMENT).toHaveLength(30);
    const byTrait = new Map<string, number>();
    const texts = new Set<string>();
    for (const q of COMMITMENT) {
      byTrait.set(q[0], (byTrait.get(q[0]) ?? 0) + 1);
      expect(q).toHaveLength(6);
      expect(q.every((t) => t.trim().length > 0), q[1]).toBe(true);
      expect(new Set(q.slice(2)).size, q[1]).toBe(4);
      expect(texts.has(q[1]), `duplicate ${q[1]}`).toBe(false);
      texts.add(q[1]);
    }
    expect(byTrait.size).toBe(10);
    for (const [t, n] of byTrait) expect([t, n]).toEqual([t, 3]);
  });
  it("scores 4 3 1 0 and mixes where the best choice sits", () => {
    const slots = [0, 0, 0, 0];
    COMMITMENT.forEach((q, i) => {
      const o = psychOptions(q, i);
      expect(o.map((c) => c.points).sort()).toEqual([0, 1, 3, 4]);
      expect(o.find((c) => c.points === 4)!.text).toBe(q[2]);
      slots[o.findIndex((c) => c.points === 4)]++;
    });
    for (const n of slots) expect(n).toBeGreaterThanOrEqual(5);
  });
  it("is taken last, after the psychological and knowledge exams, and has an oath in both languages", () => {
    expect(EXAM_ORDER.PSYCHOLOGICAL).toBeLessThan(EXAM_ORDER.KNOWLEDGE);
    expect(EXAM_ORDER.KNOWLEDGE).toBeLessThan(EXAM_ORDER.COMMITMENT);
    for (const l of ["en", "tl"] as const) for (const k of ["title", "text", "check", "need"] as const) expect(OATH[l][k].length).toBeGreaterThan(10);
  });
});
