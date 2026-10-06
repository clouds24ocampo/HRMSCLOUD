import { describe, expect, it } from "vitest";
import { becomeCustom, describeDays, followersOf, hasRegular, resolveDay, resolveRange, teamOf, type RegularRow, type ShiftLite, type TeamRow } from "./schedule";

const day: ShiftLite = { name: "Day", startTime: "08:00", endTime: "17:00", breakMinutes: 60 };
const night: ShiftLite = { name: "Night", startTime: "22:00", endTime: "07:00", breakMinutes: 60 };
const MON_FRI = [1, 2, 3, 4, 5];
// 2026-10-05 is a Monday
const regulars: RegularRow[] = [
  { effectiveFrom: "2026-09-01", workDays: MON_FRI, shift: day },
  { effectiveFrom: "2026-10-07", workDays: [2, 3, 4, 5, 6], shift: night }, // changed on Wednesday 7 Oct
];

describe("resolveDay", () => {
  it("returns nothing when there is no schedule at all", () => {
    expect(resolveDay("2026-10-05", undefined, [])).toBeNull();
    expect(hasRegular([], "2026-10-05")).toBe(false);
  });
  it("uses the regular schedule on its work days and treats other days as off", () => {
    expect(resolveDay("2026-10-05", undefined, regulars)).toEqual({ shift: day, source: "regular" }); // Monday
    expect(resolveDay("2026-10-04", undefined, regulars)).toEqual({ shift: null, source: "regular" }); // Sunday
  });
  it("keeps the old schedule for days before a change (history is not rewritten)", () => {
    expect(resolveDay("2026-10-06", undefined, regulars)?.shift).toBe(day); // Tuesday before the change
    expect(resolveDay("2026-10-07", undefined, regulars)?.shift).toBe(night); // from the effective date on
    expect(resolveDay("2026-10-10", undefined, regulars)?.shift).toBe(night); // Saturday is now a work day
    expect(resolveDay("2026-10-12", undefined, regulars)?.shift).toBeNull(); // Monday is now off
  });
  it("does not apply a regular schedule before it started", () => {
    expect(resolveDay("2026-08-31", undefined, regulars)).toBeNull();
    expect(hasRegular(regulars, "2026-08-31")).toBe(false);
  });
  it("a specific-day override beats the regular schedule, including a day off", () => {
    expect(resolveDay("2026-10-05", { shift: night }, regulars)).toEqual({ shift: night, source: "override" });
    expect(resolveDay("2026-10-05", { shift: null }, regulars)).toEqual({ shift: null, source: "override" });
  });
  it("an override still works for someone with no regular schedule", () => {
    expect(resolveDay("2026-10-05", { shift: day }, [])?.shift).toBe(day);
  });
});

describe("resolveRange", () => {
  it("builds one entry per scheduled day and skips unknown days", () => {
    const m = resolveRange(["2026-08-30", "2026-10-05", "2026-10-06"], new Map([["2026-10-06", { shift: null }]]), regulars);
    expect([...m.keys()]).toEqual(["2026-10-05", "2026-10-06"]);
    expect(m.get("2026-10-06")?.source).toBe("override");
  });
});

describe("describeDays", () => {
  it("writes weekdays the way people say them", () => {
    expect(describeDays([1, 2, 3, 4, 5])).toBe("Mon–Fri");
    expect(describeDays([2, 3, 4, 5, 6])).toBe("Tue–Sat");
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(describeDays([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(describeDays([6, 0])).toBe("Sat, Sun");
  });
});

describe("team-linked schedules", () => {
  // head -> lead -> a, b (b is Custom) ; lead2 -> c
  const rows: TeamRow[] = [
    { id: "head", managerId: null, scheduleLinked: true },
    { id: "lead", managerId: "head", scheduleLinked: true },
    { id: "a", managerId: "lead", scheduleLinked: true },
    { id: "b", managerId: "lead", scheduleLinked: false },
    { id: "lead2", managerId: "head", scheduleLinked: true },
    { id: "c", managerId: "lead2", scheduleLinked: true },
  ];
  it("a leader's change flows to linked people below, skipping Custom ones", () => {
    expect(followersOf(rows, ["lead"]).sort()).toEqual(["a"]);
  });
  it("a department head's change flows through leaders to members", () => {
    expect(followersOf(rows, ["head"]).sort()).toEqual(["a", "c", "lead", "lead2"]);
  });
  it("people edited in the same batch are never overwritten by propagation", () => {
    expect(followersOf(rows, ["lead", "a"])).toEqual([]);
  });
  it("editing one member alone makes them Custom; editing leader and member together does not", () => {
    expect(becomeCustom(rows, ["a"])).toEqual(["a"]);
    expect(becomeCustom(rows, ["lead", "a"])).toEqual(["lead"]); // lead differs from head; a still follows lead
    expect(becomeCustom(rows, ["head"])).toEqual([]); // no supervisor
  });
  it("teamOf returns the leader and everyone below", () => {
    expect(teamOf(rows, "lead").sort()).toEqual(["a", "b", "lead"]);
  });
});
