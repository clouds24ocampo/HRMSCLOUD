import { describe, expect, it } from "vitest";
import { cell, csv } from "./csv";

describe("csv cell", () => {
  it("neutralises formulas", () => {
    expect(cell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(cell("+1+1")).toBe("'+1+1");
    expect(cell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(cell("-2+3")).toBe("'-2+3");
    expect(cell("\tcmd")).toBe("'\tcmd");
  });
  it("keeps numbers and ordinary text", () => {
    expect(cell("-1.00")).toBe("-1.00");
    expect(cell(-5)).toBe("-5");
    expect(cell("Juan Dela Cruz")).toBe("Juan Dela Cruz");
  });
  it("quotes commas and newlines", () => {
    expect(csv([["a,b", "c\nd"]])).toBe("\"a,b\",\"c\nd\"");
  });
});
