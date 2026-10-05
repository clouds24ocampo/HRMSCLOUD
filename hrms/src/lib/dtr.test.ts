import { describe, expect, it } from "vitest";
import { buildDtr, clockStatus, type Punch, type ShiftTimes, type StampInfo } from "./dtr";
import { dayKey, minutesOfDay, weekStart, zonedTimeToUtc } from "./time";

const TZ = "Asia/Manila"; // UTC+8, no daylight saving
const at = (day: string, hm: string) => zonedTimeToUtc(day, Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)), TZ);
const day: ShiftTimes = { startTime: "08:00", endTime: "17:00", breakMinutes: 60 };
const night: ShiftTimes = { startTime: "22:00", endTime: "07:00", breakMinutes: 60 };
const MEAL: StampInfo = { id: "meal", name: "Meal", paid: false, allowedMinutes: 60 };
const BREAK: StampInfo = { id: "brk", name: "Break", paid: true, allowedMinutes: 15 };
const TRIP: StampInfo = { id: "trip", name: "On Trip", paid: true, allowedMinutes: null };

function run(punches: Punch[], days: string[], sched: [string, ShiftTimes | null][], leave: string[] = [], today = "2026-10-10") {
  return buildDtr({ days, punches, schedule: new Map(sched), leaveDays: new Set(leave), today, tz: TZ, graceMinutes: 10 });
}
const p = (type: Punch["type"], d: string, hm: string, stamp?: StampInfo): Punch => ({ type, at: at(d, hm), stamp });

describe("time helpers", () => {
  it("converts wall-clock time in the org timezone to UTC and back", () => {
    const d = at("2026-10-05", "08:00");
    expect(d.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(dayKey(d, TZ)).toBe("2026-10-05");
    expect(minutesOfDay(d, TZ)).toBe(480);
  });
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-10-04")).toBe("2026-09-28");
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
  });
});

describe("buildDtr", () => {
  it("takes unpaid pauses out of worked time and counts late, undertime", () => {
    const [r] = run(
      [p("IN", "2026-10-05", "08:25"), p("PAUSE_START", "2026-10-05", "12:00", MEAL), p("PAUSE_END", "2026-10-05", "13:00", MEAL), p("OUT", "2026-10-05", "16:30")],
      ["2026-10-05"], [["2026-10-05", day]],
    );
    expect(r.status).toBe("PRESENT");
    expect(r.workedMinutes).toBe(7 * 60 + 5); // 08:25-16:30 minus the unpaid meal
    expect(r.breakMinutes).toBe(60);
    expect(r.lateMinutes).toBe(25);
    expect(r.undertimeMinutes).toBe(30);
    expect(r.pauses).toEqual([{ name: "Meal", count: 1, minutes: 60, paid: false, overMinutes: 0 }]);
  });

  it("keeps paid pauses (break, on trip, system issue) inside worked time", () => {
    const [r] = run(
      [p("IN", "2026-10-05", "08:00"), p("PAUSE_START", "2026-10-05", "10:00", BREAK), p("PAUSE_END", "2026-10-05", "10:15", BREAK),
       p("PAUSE_START", "2026-10-05", "13:00", TRIP), p("PAUSE_END", "2026-10-05", "15:00", TRIP), p("OUT", "2026-10-05", "17:00")],
      ["2026-10-05"], [["2026-10-05", day]],
    );
    expect(r.workedMinutes).toBe(9 * 60); // nothing unpaid
    expect(r.breakMinutes).toBe(0);
    expect(r.pauses.map((x) => [x.name, x.minutes])).toEqual([["Break", 15], ["On Trip", 120]]);
  });

  it("flags a pause that ran longer than allowed, each pause on its own", () => {
    const [r] = run(
      [p("IN", "2026-10-05", "08:00"), p("PAUSE_START", "2026-10-05", "10:00", BREAK), p("PAUSE_END", "2026-10-05", "10:27", BREAK),
       p("PAUSE_START", "2026-10-05", "15:00", BREAK), p("PAUSE_END", "2026-10-05", "15:10", BREAK), p("OUT", "2026-10-05", "17:00")],
      ["2026-10-05"], [["2026-10-05", day]],
    );
    expect(r.overLimitMinutes).toBe(12); // 27 - 15; the 10-minute break is fine
    expect(r.pauses[0]).toMatchObject({ name: "Break", count: 2, minutes: 37, overMinutes: 12 });
  });

  it("does not count lateness inside the grace period", () => {
    const [r] = run([p("IN", "2026-10-05", "08:10"), p("OUT", "2026-10-05", "17:00")], ["2026-10-05"], [["2026-10-05", day]]);
    expect(r.lateMinutes).toBe(0);
  });

  it("keeps an overnight shift on the day it started", () => {
    const rows = run(
      [p("IN", "2026-10-05", "21:55"), p("OUT", "2026-10-06", "07:20")],
      ["2026-10-05", "2026-10-06"], [["2026-10-05", night], ["2026-10-06", null]],
    );
    expect(rows[0].status).toBe("PRESENT");
    expect(rows[0].workedMinutes).toBe(9 * 60 + 25);
    expect(rows[0].overtimeMinutes).toBe(20);
    expect(rows[1].status).toBe("DAY_OFF");
  });

  it("clocking out while paused ends the pause at that moment", () => {
    const [r] = run([p("IN", "2026-10-05", "08:00"), p("PAUSE_START", "2026-10-05", "16:30", MEAL), p("OUT", "2026-10-05", "17:00")], ["2026-10-05"], [["2026-10-05", day]]);
    expect(r.status).toBe("PRESENT");
    expect(r.breakMinutes).toBe(30);
    expect(r.workedMinutes).toBe(8 * 60 + 30);
  });

  it("treats a stamp-less pause as an unpaid break (older records)", () => {
    const [r] = run([p("IN", "2026-10-05", "08:00"), p("PAUSE_START", "2026-10-05", "12:00"), p("PAUSE_END", "2026-10-05", "13:00"), p("OUT", "2026-10-05", "17:00")], ["2026-10-05"], [["2026-10-05", day]]);
    expect(r.workedMinutes).toBe(8 * 60);
  });

  it("flags a missing clock-out as incomplete", () => {
    const [r] = run([p("IN", "2026-10-05", "08:00")], ["2026-10-05"], [["2026-10-05", day]]);
    expect(r.status).toBe("INCOMPLETE");
    expect(r.lastOut).toBeNull();
  });

  it("marks a scheduled past day with no punches absent, unless on leave", () => {
    const sched: [string, ShiftTimes | null][] = [["2026-10-05", day], ["2026-10-06", day], ["2026-10-07", null]];
    const rows = run([], ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-20"], sched, ["2026-10-06"]);
    expect(rows.map((r) => r.status)).toEqual(["ABSENT", "LEAVE", "DAY_OFF", "NO_SCHEDULE"]);
  });

  it("ignores a duplicate IN and an OUT with no IN", () => {
    const [r] = run(
      [p("OUT", "2026-10-05", "07:00"), p("IN", "2026-10-05", "08:00"), p("IN", "2026-10-05", "08:01"), p("OUT", "2026-10-05", "12:00")],
      ["2026-10-05"], [["2026-10-05", day]],
    );
    expect(r.workedMinutes).toBe(240);
  });
});

describe("clockStatus", () => {
  const q = (type: Punch["type"], hm: string, stamp?: StampInfo): Punch => p(type, "2026-10-05", hm, stamp);
  it("follows the punch sequence", () => {
    expect(clockStatus([]).state).toBe("OUT");
    expect(clockStatus([q("IN", "08:00")]).state).toBe("IN");
    expect(clockStatus([q("IN", "08:00"), q("OUT", "17:00")]).state).toBe("OUT");
  });
  it("says which pause is running", () => {
    const s = clockStatus([q("IN", "08:00"), q("PAUSE_START", "12:00", MEAL)]);
    expect(s.state).toBe("ON_PAUSE");
    expect(s.pause).toMatchObject({ typeId: "meal", name: "Meal" });
    expect(clockStatus([q("IN", "08:00"), q("PAUSE_START", "12:00", MEAL), q("PAUSE_END", "13:00", MEAL)]).state).toBe("IN");
  });
  it("supports several different pauses in a day", () => {
    const s = clockStatus([q("IN", "08:00"), q("PAUSE_START", "10:00", BREAK), q("PAUSE_END", "10:15", BREAK), q("PAUSE_START", "12:00", MEAL)]);
    expect(s.pause?.name).toBe("Meal");
  });
});
