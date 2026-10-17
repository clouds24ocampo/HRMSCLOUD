import { describe, expect, it } from "vitest";
import { projectCutoffGross, remainingPlannedMinutes } from "./dashboard-insights";
import type { DtrDay } from "./dtr";

const shift = { startTime: "08:00", endTime: "17:00", breakMinutes: 60 }; // 480 planned minutes
const row = (day: string, o: Partial<DtrDay> = {}): DtrDay => ({
  day, status: "NO_SCHEDULE", firstIn: null, lastOut: null, workedMinutes: 0, breakMinutes: 0, pauses: [], overLimitMinutes: 0,
  lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, shift, ...o,
});

describe("remainingPlannedMinutes", () => {
  it("counts only scheduled days after today, skipping leave and days off", () => {
    const rows = [row("2026-10-16"), row("2026-10-17"), row("2026-10-18"), row("2026-10-19", { status: "LEAVE" }), row("2026-10-20", { shift: null, status: "DAY_OFF" }), row("2026-10-21")];
    expect(remainingPlannedMinutes(rows, "2026-10-17", 480)).toBe(960);
  });
  it("caps a long shift at a normal day", () => {
    const long = { startTime: "07:00", endTime: "19:00", breakMinutes: 60 }; // 660
    expect(remainingPlannedMinutes([row("2026-10-18", { shift: long })], "2026-10-17", 480)).toBe(480);
  });
});

describe("projectCutoffGross", () => {
  it("adds basic pay for remaining minutes; people without a rate add nothing", () => {
    const r = projectCutoffGross(100_000, new Map([["a", 960], ["b", 480]]), new Map([["a", 10_000]]));
    expect(r).toEqual({ ahead: 160_000, projected: 260_000 });
  });
});
