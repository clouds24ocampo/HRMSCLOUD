import { describe, expect, it } from "vitest";
import { ancestorIds, mayDecide, stepOf } from "./overtime";

// head -> lead -> agent; hr has no supervisor
const rows = [{ id: "head", managerId: null }, { id: "lead", managerId: "head" }, { id: "agent", managerId: "lead" }, { id: "hr", managerId: null }];
const base = { actorUserId: "u-x", employeeId: "agent", ancestors: ancestorIds(rows, "agent"), headApprovedById: null };

describe("overtime: department head, then HR", () => {
  it("walks the supervisor chain", () => expect(ancestorIds(rows, "agent")).toEqual(["lead", "head"]));
  it("starts at the head step when the employee has a supervisor, else goes straight to HR", () => {
    expect(stepOf({ headApprovedAt: null }, true)).toBe("HEAD");
    expect(stepOf({ headApprovedAt: new Date() }, true)).toBe("FINAL");
    expect(stepOf({ headApprovedAt: null }, false)).toBe("FINAL");
  });
  it("only someone above the employee approves step 1; HR must wait", () => {
    expect(mayDecide({ ...base, roleKey: "MANAGER", actorEmployeeId: "head", step: "HEAD" })).toBeNull();
    expect(mayDecide({ ...base, roleKey: "HR_ADMIN", actorEmployeeId: "hr", step: "HEAD" })).toMatch(/department head/);
  });
  it("only HR gives the final approval, and not the same person who approved as head", () => {
    expect(mayDecide({ ...base, roleKey: "MANAGER", actorEmployeeId: "head", step: "FINAL" })).toMatch(/HR gives/);
    expect(mayDecide({ ...base, roleKey: "HR_ADMIN", actorEmployeeId: "hr", step: "FINAL" })).toBeNull();
    expect(mayDecide({ ...base, roleKey: "HR_ADMIN", actorEmployeeId: "hr", actorUserId: "u-hr", headApprovedById: "u-hr", step: "FINAL" })).toMatch(/Another HR/);
  });
  it("nobody approves their own overtime", () => {
    expect(mayDecide({ ...base, roleKey: "HR_ADMIN", actorEmployeeId: "agent", step: "FINAL" })).toMatch(/own/);
  });
});
