import { describe, expect, it } from "vitest";
import { orientationOpen } from "./orientation";

const TZ = "Asia/Manila";
describe("orientationOpen", () => {
  const day = new Date("2026-11-10T01:00:00Z"); // 9:00 AM on 10 Nov in Manila
  it("is closed the day before, open on the day and after", () => {
    expect(orientationOpen([day], new Date("2026-11-09T15:00:00Z"), TZ)).toBe(false); // 11 PM on 9 Nov in Manila
    expect(orientationOpen([day], new Date("2026-11-09T16:30:00Z"), TZ)).toBe(true); // just after midnight on 10 Nov in Manila
    expect(orientationOpen([day], new Date("2026-11-20T00:00:00Z"), TZ)).toBe(true);
  });
  it("is closed when nothing is scheduled, and the earliest of several counts", () => {
    expect(orientationOpen([], new Date(), TZ)).toBe(false);
    expect(orientationOpen([new Date("2030-01-01T00:00:00Z"), day], new Date("2026-11-10T02:00:00Z"), TZ)).toBe(true);
  });
});
