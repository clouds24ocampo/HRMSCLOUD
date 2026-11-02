import { describe, expect, it } from "vitest";
import { maskGovId, parseGovId } from "./gov-ids";

describe("parseGovId", () => {
  it("writes each number with its dashes", () => {
    expect(parseGovId("sss", "3412345678")).toEqual({ ok: true, value: "34-1234567-8" });
    expect(parseGovId("philhealth", "12 345678901 2")).toEqual({ ok: true, value: "12-345678901-2" });
    expect(parseGovId("tin", "352869946")).toEqual({ ok: true, value: "352-869-946" });
    expect(parseGovId("tin", "352-869-946-000")).toEqual({ ok: true, value: "352-869-946-000" });
    expect(parseGovId("pagibig", "123456789012")).toEqual({ ok: true, value: "1234-5678-9012" });
  });
  it("clears on empty input", () => {
    expect(parseGovId("sss", "   ")).toEqual({ ok: true, value: null });
  });
  it("refuses letters and wrong lengths with a clear message", () => {
    expect(parseGovId("sss", "34-ABC")).toMatchObject({ ok: false, error: expect.stringContaining("only numbers") });
    expect(parseGovId("sss", "123")).toMatchObject({ ok: false, error: expect.stringContaining("10 digits") });
    expect(parseGovId("tin", "12345678901")).toMatchObject({ ok: false, error: expect.stringContaining("9 or 12") });
  });
});

describe("maskGovId", () => {
  it("hides all but the last three digits and keeps the dashes", () => {
    expect(maskGovId("352-869-946")).toBe("•••-•••-946");
    expect(maskGovId("34-1234567-8")!.replace(/\D/g, "")).toBe("678");
    expect(maskGovId("34-1234567-8")!.match(/\d/g)).toHaveLength(3);
  });
  it("returns null for nothing", () => {
    expect(maskGovId(null)).toBeNull();
    expect(maskGovId("")).toBeNull();
  });
});
