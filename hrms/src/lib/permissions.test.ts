import { describe, expect, it } from "vitest";
import { ROLES } from "./roles";
import {
  GRANTABLE, PAGE_PERMS, PERMISSIONS, ROLE_DEFAULTS, ROLE_TEMPLATES, can, canAccessPath, effectivePerms, entryLevelProblem, hasElevated, isElevatedPerm, rolePerms, suggestRole,
} from "./permissions";

// The page rules exactly as they were before itemized access: the built-in roles must keep opening the same pages.
const ALL = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE", "SUBCONTRACTOR"];
const INTERNAL = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"];
const TEAM = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"];
const HR = ["SUPER_ADMIN", "HR_ADMIN"];
const BEFORE: Record<string, string[]> = {
  "/dashboard": ALL, "/employees": TEAM, "/organization": HR, "/schedule": ALL, "/schedule/live": TEAM, "/schedule/analytics": TEAM, "/dtr": ALL, "/leave": TEAM, "/overtime": TEAM,
  "/worksync": ALL, "/notifications": ALL, "/payroll": HR, "/payslips": INTERNAL, "/settings": HR, "/audit": HR, "/recruitment": HR, "/performance": TEAM, "/learning": TEAM,
  "/documents": HR, "/requests": INTERNAL, "/locate": ALL, "/id": TEAM, "/profile": ALL, "/id/design": HR, "/chat": ALL, "/policies": ALL, "/handbook": ALL, "/contracts": ALL,
  "/daily-report": ALL, "/cash-advance": ALL, "/incentives": ALL, "/announcements": HR, "/reports": HR, "/analytics": HR, "/admin/users": ["SUPER_ADMIN"],
};

describe("built-in roles keep their access", () => {
  it("opens exactly the same pages as before (golden)", () => {
    for (const role of ALL) {
      const perms = effectivePerms({ key: role });
      for (const [path, allowed] of Object.entries(BEFORE)) expect([role, path, canAccessPath(role, perms, path)]).toEqual([role, path, allowed.includes(role)]);
    }
  });
  it("applies the same rule to sub-pages (longest prefix wins) and denies unknown pages", () => {
    const hr = effectivePerms({ key: "HR_ADMIN" });
    expect(canAccessPath("HR_ADMIN", hr, "/payroll/setup")).toBe(true);
    expect(canAccessPath("HR_ADMIN", hr, "/recruitment/pipeline/screening")).toBe(true);
    expect(canAccessPath("MANAGER", effectivePerms({ key: "MANAGER" }), "/schedule/live")).toBe(true);
    expect(canAccessPath("HR_ADMIN", hr, "/nope")).toBe(false);
    expect(canAccessPath("HR_ADMIN", hr, "/admin/users")).toBe(false);
    expect(canAccessPath("HR_ADMIN", hr, "/admin/roles")).toBe(false);
  });
  it("the applicant only reaches the portal and the password page", () => {
    const p = effectivePerms({ key: "APPLICANT" });
    expect(canAccessPath("APPLICANT", p, "/apply")).toBe(true);
    expect(canAccessPath("APPLICANT", p, "/apply/pds")).toBe(true);
    expect(canAccessPath("APPLICANT", p, "/change-password")).toBe(true);
    for (const x of ["/dashboard", "/recruitment", "/payroll", "/chat", "/profile"]) expect(canAccessPath("APPLICANT", p, x)).toBe(false);
    expect(canAccessPath("EMPLOYEE", effectivePerms({ key: "EMPLOYEE" }), "/apply")).toBe(false);
  });
  it("the Super Admin has every permission and cannot lose any; HR has everything but access control", () => {
    const sa = effectivePerms({ key: ROLES.SUPER_ADMIN }, [], ["payroll.manage", "access.manage"]);
    expect(sa.size).toBe(PERMISSIONS.length);
    const hr = effectivePerms({ key: ROLES.HR_ADMIN });
    expect(hr.has("access.manage")).toBe(false);
    expect(hr.size).toBe(PERMISSIONS.length - 1);
  });
});

describe("itemized access", () => {
  const timekeeper = { key: "CUSTOM_x", permissions: ["dtr.view_all", "dtr.correct", "payslips.own"] };
  it("a custom role gives exactly the permissions chosen for it", () => {
    expect([...effectivePerms(timekeeper)].sort()).toEqual(["dtr.correct", "dtr.view_all", "payslips.own"]);
  });
  it("an account can be given extra permissions and have some removed", () => {
    const p = effectivePerms(timekeeper, ["leave.approve_all"], ["dtr.correct"]);
    expect([...p].sort()).toEqual(["dtr.view_all", "leave.approve_all", "payslips.own"]);
    expect(can({ perms: p }, "leave.approve_all")).toBe(true);
    expect(can({ perms: p }, "dtr.correct")).toBe(false);
  });
  it("a removal wins over the role, an extra is added, unknown names are ignored", () => {
    const p = effectivePerms({ key: "MANAGER" }, ["payroll.view", "made.up"], ["team.manage"]);
    expect(p.has("team.manage")).toBe(false);
    expect(p.has("payroll.view")).toBe(true);
    expect([...p].includes("made.up" as never)).toBe(false);
  });
  it("access.manage can never be given to a custom role or to one account", () => {
    expect(GRANTABLE.includes("access.manage")).toBe(false);
    expect(rolePerms({ key: "CUSTOM_y", permissions: ["access.manage", "dtr.view_all"] })).toEqual(["dtr.view_all"]);
    expect(effectivePerms({ key: "EMPLOYEE" }, ["access.manage"]).has("access.manage")).toBe(false);
  });
  it("opens a page when any one of its permissions is held", () => {
    const only = effectivePerms({ key: "CUSTOM_z", permissions: ["payslips.view_all"] });
    expect(canAccessPath("CUSTOM_z", only, "/payslips")).toBe(true);
    expect(canAccessPath("CUSTOM_z", only, "/payroll")).toBe(false);
    const payroll = effectivePerms({ key: "CUSTOM_z", permissions: ["payroll.view"] });
    expect(canAccessPath("CUSTOM_z", payroll, "/payroll/setup")).toBe(true);
  });
  it("every page rule only names real permissions, and every built-in default only names real ones", () => {
    const keys = new Set<string>(PERMISSIONS.map((p) => p.key));
    for (const rule of Object.values(PAGE_PERMS)) if (Array.isArray(rule)) for (const k of rule) expect(keys.has(k), k).toBe(true);
    for (const list of Object.values(ROLE_DEFAULTS)) for (const k of list) expect(keys.has(k), k).toBe(true);
    for (const t of ROLE_TEMPLATES) for (const k of t.perms) expect(keys.has(k), `${t.name}: ${k}`).toBe(true);
  });
  it("permission keys are unique and each has a label and an explanation", () => {
    expect(new Set(PERMISSIONS.map((p) => p.key)).size).toBe(PERMISSIONS.length);
    for (const p of PERMISSIONS) { expect(p.label.length).toBeGreaterThan(3); expect(p.help.length).toBeGreaterThan(10); }
  });
});

describe("entry-level positions", () => {
  it("cannot hold any elevated permission", () => {
    expect(entryLevelProblem("ENTRY", effectivePerms({ key: "MANAGER" }))).toMatch(/entry-level/);
    expect(entryLevelProblem("ENTRY", ["payroll.manage"])).toMatch(/Calculate, approve and finalize payroll/);
  });
  it("can hold the self-service permissions and a plain employee role", () => {
    expect(entryLevelProblem("ENTRY", effectivePerms({ key: "EMPLOYEE" }))).toBeNull();
    expect(entryLevelProblem("ENTRY", ["payslips.own", "requests.own"])).toBeNull();
  });
  it("team leader and above are not restricted, and neither is an account with no position", () => {
    for (const l of ["TEAM_LEAD", "MANAGER", "ASSISTANT_HEAD", "DEPT_HEAD", "EXECUTIVE"] as const) expect(entryLevelProblem(l, effectivePerms({ key: "HR_ADMIN" }))).toBeNull();
    expect(entryLevelProblem(null, effectivePerms({ key: "SUPER_ADMIN" }))).toBeNull();
  });
  it("knows which permissions are elevated", () => {
    expect(isElevatedPerm("payslips.own")).toBe(false);
    expect(isElevatedPerm("payroll.view")).toBe(true);
    expect(hasElevated(["payslips.own", "requests.own"])).toBe(false);
    expect(hasElevated(["payslips.own", "team.manage"])).toBe(true);
  });
});

describe("the role a position usually gets", () => {
  const roles = [{ key: "EMPLOYEE", name: "Employee" }, { key: "MANAGER", name: "Manager" }, { key: "CUSTOM_a", name: "Department Head" }, { key: "CUSTOM_b", name: "Team Leader" }];
  it("prefers a company role with the level's usual name, then the built-in one", () => {
    expect(suggestRole("ENTRY", roles)?.key).toBe("EMPLOYEE");
    expect(suggestRole("TEAM_LEAD", roles)?.key).toBe("CUSTOM_b");
    expect(suggestRole("DEPT_HEAD", roles)?.key).toBe("CUSTOM_a");
    expect(suggestRole("MANAGER", roles)?.key).toBe("MANAGER");
    expect(suggestRole("EXECUTIVE", roles)?.key).toBe("MANAGER"); // no Executive role installed yet
    expect(suggestRole(null, roles)).toBeNull();
  });
  it("the ready-made company roles only use permissions that can be given", () => {
    for (const t of ROLE_TEMPLATES) expect(t.perms.every((p) => GRANTABLE.includes(p)), t.name).toBe(true);
  });
});
