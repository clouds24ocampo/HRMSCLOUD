import { describe, expect, it } from "vitest";
import { initialsOf, readableOn } from "./id-card-style";

describe("readableOn", () => {
  it("uses white on dark colors and dark text on light ones", () => {
    expect(readableOn("#2563eb")).toBe("#ffffff");
    expect(readableOn("#111827")).toBe("#ffffff");
    expect(readableOn("#fde047")).toBe("#0f172a");
    expect(readableOn("#ffffff")).toBe("#0f172a");
  });
  it("falls back to white text for something that is not a color", () => {
    expect(readableOn("blue")).toBe("#ffffff");
  });
});

describe("initialsOf", () => {
  it("takes the first letters of the first two words", () => {
    expect(initialsOf("Quantum Cloud Corporation")).toBe("QC");
    expect(initialsOf("jay")).toBe("J");
    expect(initialsOf("  ")).toBe("?");
  });
});
