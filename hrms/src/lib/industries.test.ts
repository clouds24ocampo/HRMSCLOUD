import { describe, expect, it } from "vitest";
import { CATEGORIES, isValidChoice, sectorOf } from "./industries";

describe("industries", () => {
  it("accepts a real category + segment + size", () => {
    expect(isValidChoice("government", "lgu", "small")).toBe(true);
  });
  it("rejects a segment from another category, or unknown values", () => {
    expect(isValidChoice("government", "bpo", "small")).toBe(false);
    expect(isValidChoice("nope", "lgu", "small")).toBe(false);
    expect(isValidChoice("government", "lgu", "huge")).toBe(false);
  });
  it("maps sector from category", () => {
    expect(sectorOf("government")).toBe("GOVERNMENT");
    expect(sectorOf("nonprofit")).toBe("NONPROFIT");
    expect(sectorOf("bpo-it")).toBe("PRIVATE");
  });
  it("has unique keys and short lists", () => {
    const keys = CATEGORIES.flatMap((c) => c.segments.map((s) => s.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CATEGORIES) expect(c.segments.length).toBeLessThanOrEqual(4);
  });
});
