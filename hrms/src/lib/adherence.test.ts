import { describe, expect, it } from "vitest";
import { summarize } from "./adherence";
import { liveState } from "./live";
import { zonedTimeToUtc } from "./time";
import type { DtrDay } from "./dtr";

const shift = { startTime: "08:00", endTime: "17:00", breakMinutes: 60 }; // 480 planned minutes
const row = (day: string, o: Partial<DtrDay>): DtrDay => ({
  day, status: "PRESENT", firstIn: null, lastOut: null, workedMinutes: 480, breakMinutes: 60, pauses: [], overLimitMinutes: 0,
  lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, shift, ...o,
});

describe("summarize", () => {
  it("scores late, undertime and absence against planned minutes", () => {
    const s = summarize([row("2026-10-01", {}), row("2026-10-02", { lateMinutes: 48 }), row("2026-10-03", { status: "ABSENT", workedMinutes: 0 }), row("2026-10-04", { undertimeMinutes: 24 })], "2026-10-06");
    expect(s).toMatchObject({ scheduledDays: 4, present: 3, absent: 1, lateDays: 1, lateMinutes: 48, undertimeMinutes: 24, attendancePct: 75, onTimePct: 50 });
    expect(s.adherencePct).toBe(Math.round(((480 + 432 + 0 + 456) / 1920) * 1000) / 10); // 71.3
    expect(s.verdict).toBe("NOT_ADHERING");
  });
  it("ignores today, future days, day off, leave and unscheduled days", () => {
    const s = summarize([row("2026-10-06", {}), row("2026-10-07", {}), row("2026-10-01", { status: "DAY_OFF", shift: null }), row("2026-10-02", { status: "LEAVE" })], "2026-10-06");
    expect(s.scheduledDays).toBe(0);
    expect(s.verdict).toBe("NO_DATA");
  });
  it("a perfect record is Adhering; a few late minutes is Minor", () => {
    expect(summarize([row("2026-10-01", {})], "2026-10-06").verdict).toBe("ADHERING");
    expect(summarize([row("2026-10-01", { lateMinutes: 60 })], "2026-10-06").verdict).toBe("MINOR"); // 420/480 = 87.5
  });
});

describe("liveState", () => {
  const TZ = "Asia/Manila";
  const base = { day: "2026-10-06", tz: TZ, shift, onLeave: false, clock: { state: "OUT" } as const, timedInToday: false, graceMinutes: 10 };
  const at = (hm: string) => zonedTimeToUtc("2026-10-06", Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)), TZ);
  it("walks from not-yet to late to absent-risk with no punch", () => {
    expect(liveState({ ...base, now: at("07:30") }).state).toBe("NOT_YET");
    expect(liveState({ ...base, now: at("08:05") }).state).toBe("NOT_YET"); // inside grace
    expect(liveState({ ...base, now: at("08:30") })).toEqual({ state: "LATE", detail: "30 min late" });
    expect(liveState({ ...base, now: at("10:00") }).state).toBe("ABSENT_RISK");
  });
  it("working, on break, done, day off, leave, no schedule", () => {
    expect(liveState({ ...base, now: at("09:00"), clock: { state: "IN" } }).state).toBe("WORKING");
    expect(liveState({ ...base, now: at("09:00"), clock: { state: "ON_PAUSE", pause: { typeId: "x", name: "Meal", since: at("09:00") } } })).toEqual({ state: "ON_BREAK", detail: "Meal" });
    expect(liveState({ ...base, now: at("18:00"), timedInToday: true }).state).toBe("DONE");
    expect(liveState({ ...base, now: at("09:00"), shift: null }).state).toBe("DAY_OFF");
    expect(liveState({ ...base, now: at("09:00"), onLeave: true }).state).toBe("ON_LEAVE");
    expect(liveState({ ...base, now: at("09:00"), shift: undefined }).state).toBe("NO_SCHEDULE");
  });
});
