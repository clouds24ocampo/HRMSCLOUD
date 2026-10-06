import { describe, expect, it } from "vitest";
import { stampBlock, tripError, usedToday, type RuleEvent, type RuleStamp } from "./stamp-rules";

const t = (min: number) => new Date(2026, 9, 5, 8, min);
const ev = (type: RuleEvent["type"], min: number, id: string | null = null): RuleEvent => ({ type, at: t(min), stampTypeId: id });
const brk1: RuleStamp = { id: "b1", name: "Break 1", kind: "PAUSE", maxPerDay: 1, requiresOvertimeOver: null };
const brk3: RuleStamp = { id: "b3", name: "Break 3", kind: "PAUSE", maxPerDay: 1, requiresOvertimeOver: 120 };
const meal: RuleStamp = { id: "m", name: "Meal", kind: "PAUSE", maxPerDay: 2, requiresOvertimeOver: null };
const day = [ev("IN", 0)];

describe("stampBlock", () => {
  it("blocks a second Break 1 and allows the first", () => {
    expect(stampBlock(brk1, day, 0, false)).toBeNull();
    expect(stampBlock(brk1, [...day, ev("PAUSE_START", 10, "b1"), ev("PAUSE_END", 20, "b1")], 0, false)).toBe("Already used today");
  });
  it("allows Meal twice, blocks the third", () => {
    const one = [...day, ev("PAUSE_START", 10, "m"), ev("PAUSE_END", 20, "m")];
    const two = [...one, ev("PAUSE_START", 30, "m"), ev("PAUSE_END", 40, "m")];
    expect(stampBlock(meal, one, 0, false)).toBeNull();
    expect(stampBlock(meal, two, 0, false)).toBe("Already used today");
  });
  it("gates Break 3 on approved overtime strictly above 120 minutes", () => {
    expect(stampBlock(brk3, day, 0, false)).toBe("Needs approved overtime over 2 h");
    expect(stampBlock(brk3, day, 120, false)).toBe("Needs approved overtime over 2 h");
    expect(stampBlock(brk3, day, 121, false)).toBeNull();
  });
  it("never blocks ending the open pause", () => {
    expect(stampBlock(brk3, day, 0, true)).toBeNull();
  });
  it("counts only the current work day", () => {
    const yesterday = [ev("IN", -600), ev("PAUSE_START", -500, "b1"), ev("PAUSE_END", -490, "b1"), ev("OUT", -400)];
    expect(usedToday([...yesterday, ev("IN", 0)], "b1")).toBe(0);
  });
});

describe("tripError", () => {
  it("needs all three fields", () => {
    expect(tripError({ tripFrom: "Office", tripTo: "Client HQ" })).not.toBeNull();
    expect(tripError({ tripFrom: "Of", tripTo: "Client HQ", tripReason: "Meeting" })).not.toBeNull();
    expect(tripError({ tripFrom: "Office", tripTo: "Client HQ", tripReason: "Site visit" })).toBeNull();
  });
});
