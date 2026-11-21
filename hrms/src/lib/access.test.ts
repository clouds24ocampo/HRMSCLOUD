import { describe, expect, it } from "vitest";
import { accountProblem } from "./access";
import { effectivePerms } from "./permissions";

const actor = (key: string, extra: string[] = [], id = "me") => ({ id, role: { key }, organizationId: "o", perms: effectivePerms({ key }, extra) as ReadonlySet<string> });
const target = (key: string, over: { grants?: string[]; revokes?: string[]; id?: string; permissions?: string[] } = {}) => ({ id: over.id ?? "t", role: { key, permissions: over.permissions }, grants: over.grants ?? [], revokes: over.revokes ?? [] });

describe("who may change another account's sign-in, status or existence", () => {
  it("a Super Admin may change anyone", () => {
    expect(accountProblem(actor("SUPER_ADMIN"), target("HR_ADMIN"), "change")).toBeNull();
  });
  it("nobody else may touch an admin", () => {
    expect(accountProblem(actor("HR_ADMIN"), target("HR_ADMIN"), "delete")).toMatch(/Only a Super Admin/);
    expect(accountProblem(actor("MANAGER", ["employees.edit"]), target("SUPER_ADMIN"), "change")).toMatch(/Only a Super Admin/);
  });
  it("a small permission cannot take over an account that holds more", () => {
    const hrAssistant = actor("EMPLOYEE", ["employees.edit", "employees.deactivate"]);
    expect(accountProblem(hrAssistant, target("MANAGER"), "change")).toMatch(/holds access you do not have/);
    expect(accountProblem(hrAssistant, target("EMPLOYEE", { grants: ["payroll.view"] }), "change")).toMatch(/holds access you do not have/);
  });
  it("is allowed for accounts that hold nothing beyond the actor, and for yourself", () => {
    expect(accountProblem(actor("HR_ADMIN"), target("MANAGER"), "change")).toBeNull();
    expect(accountProblem(actor("EMPLOYEE", ["employees.edit"]), target("EMPLOYEE"), "change")).toBeNull();
    expect(accountProblem(actor("HR_ADMIN"), target("HR_ADMIN", { id: "me" }), "change")).toBeNull();
  });
  it("a removal on the target is respected", () => {
    const mgr = actor("EMPLOYEE", ["employees.edit", "team.manage", "schedule.insights", "incentives.award", "learning.enroll", "worksync.start_project"]);
    expect(accountProblem(mgr, target("MANAGER", { revokes: [] }), "change")).toBeNull();
  });
});
