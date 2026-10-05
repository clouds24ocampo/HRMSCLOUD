import { describe, expect, it } from "vitest";
import { descendantIds } from "./scope";

const rows = [
  { id: "ceo", managerId: null },
  { id: "mgr", managerId: "ceo" },
  { id: "lead", managerId: "mgr" },
  { id: "agent1", managerId: "lead" },
  { id: "agent2", managerId: "lead" },
  { id: "other-mgr", managerId: "ceo" },
  { id: "other-agent", managerId: "other-mgr" },
];

describe("descendantIds", () => {
  it("returns self plus everyone below, at any depth", () => {
    expect(descendantIds(rows, "mgr").sort()).toEqual(["agent1", "agent2", "lead", "mgr"]);
  });
  it("an entry-level person sees only self", () => {
    expect(descendantIds(rows, "agent1")).toEqual(["agent1"]);
  });
  it("never reaches sideways or upward", () => {
    const ids = descendantIds(rows, "lead");
    expect(ids).not.toContain("mgr");
    expect(ids).not.toContain("other-agent");
  });
  it("survives a reporting cycle", () => {
    const cyclic = [{ id: "a", managerId: "b" }, { id: "b", managerId: "a" }];
    expect(descendantIds(cyclic, "a").sort()).toEqual(["a", "b"]);
  });
});
