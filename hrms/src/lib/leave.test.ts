import { describe, expect, it } from "vitest";
import { countLeaveDays } from "./leave";

describe("countLeaveDays", () => {
  it("counts Monday to Friday when nothing is planned", () => {
    // 2026-10-05 is a Monday; Mon-Sun = 7 days
    expect(countLeaveDays("2026-10-05", "2026-10-11", new Map())).toBe(5);
  });
  it("skips planned days off and counts planned weekend shifts", () => {
    const plan = new Map([
      ["2026-10-06", false], // Tuesday off
      ["2026-10-10", true], // Saturday shift
    ]);
    expect(countLeaveDays("2026-10-05", "2026-10-11", plan)).toBe(5); // Mon, Wed, Thu, Fri, Sat
  });
  it("returns 0 when every day is a day off", () => {
    expect(countLeaveDays("2026-10-10", "2026-10-11", new Map())).toBe(0);
  });
  it("handles a single day", () => {
    expect(countLeaveDays("2026-10-07", "2026-10-07", new Map())).toBe(1);
  });
});
