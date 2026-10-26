import { describe, expect, it } from "vitest";
import { goalOutcome } from "./goals";

describe("goalOutcome", () => {
  it("reaching 100% makes the goal achieved", () => {
    expect(goalOutcome(100, "ACTIVE")).toEqual({ progress: 100, status: "ACHIEVED" });
  });
  it("achieved means 100%", () => {
    expect(goalOutcome(40, "ACHIEVED")).toEqual({ progress: 100, status: "ACHIEVED" });
  });
  it("below 100% stays in progress, and a dropped goal stays dropped", () => {
    expect(goalOutcome(99, "ACTIVE")).toEqual({ progress: 99, status: "ACTIVE" });
    expect(goalOutcome(100, "DROPPED")).toEqual({ progress: 100, status: "DROPPED" });
  });
});
