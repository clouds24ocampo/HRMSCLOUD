import { describe, expect, it } from "vitest";
import { COMMITMENT_BANDS, commitmentBand, traitExtremes } from "./commitment-result";

describe("commitmentBand", () => {
  it("splits at 80, 65 and 50", () => {
    expect([100, 80, 79, 65, 64, 50, 49, 0].map((p) => commitmentBand(p).key)).toEqual(["strong", "strong", "committed", "committed", "follow", "follow", "low", "low"]);
  });
  it("has four distinct bands", () => {
    expect(new Set(COMMITMENT_BANDS.map((b) => b.key)).size).toBe(4);
  });
});

describe("traitExtremes", () => {
  it("finds the strongest and the weakest area", () => {
    const r = traitExtremes({ Loyalty: { score: 6, max: 12 }, Honesty: { score: 12, max: 12 }, Rules: { score: 3, max: 12 } });
    expect(r?.best).toEqual({ name: "Honesty", pct: 100 });
    expect(r?.worst).toEqual({ name: "Rules", pct: 25 });
  });
  it("returns null with nothing to compare, and survives a zero maximum", () => {
    expect(traitExtremes(null)).toBeNull();
    expect(traitExtremes({})).toBeNull();
    expect(traitExtremes({ A: { score: 0, max: 0 } })?.best.pct).toBe(0);
  });
});
