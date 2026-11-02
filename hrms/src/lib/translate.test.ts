import { describe, expect, it } from "vitest";
import { parseGoogle } from "./translate";

describe("parseGoogle", () => {
  it("joins the sentence pieces of a translation", () => {
    expect(parseGoogle([[["Aling index? ", "Which index? "], ["Mabilis.", "Fast."]], null, "en"])).toBe("Aling index? Mabilis.");
  });
  it("returns null for anything unexpected", () => {
    expect(parseGoogle(null)).toBeNull();
    expect(parseGoogle({ error: 1 })).toBeNull();
    expect(parseGoogle([[]])).toBeNull();
  });
});
