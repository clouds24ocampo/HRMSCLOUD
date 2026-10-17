import { describe, expect, it } from "vitest";
import { ROLES, canAccess } from "./roles";

describe("canAccess", () => {
  it("lets every role open the dashboard", () => {
    for (const r of Object.values(ROLES)) expect(canAccess(r, "/dashboard")).toBe(true);
  });
  it("lets only Super Admin open user management", () => {
    expect(canAccess(ROLES.SUPER_ADMIN, "/admin/users")).toBe(true);
    for (const r of [ROLES.HR_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.SUBCONTRACTOR]) {
      expect(canAccess(r, "/admin/users")).toBe(false);
      expect(canAccess(r, "/admin/users/123")).toBe(false);
    }
  });
  it("restricts Sub Contractor from internal employee benefits and records", () => {
    expect(canAccess(ROLES.SUBCONTRACTOR, "/dtr")).toBe(true);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/schedule")).toBe(true);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/daily-report")).toBe(true);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/chat")).toBe(true);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/id")).toBe(true);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/policies")).toBe(true);

    expect(canAccess(ROLES.SUBCONTRACTOR, "/payslips")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/leave")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/overtime")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/performance")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/learning")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/documents")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/requests")).toBe(false);
  });
  it("denies unlisted pages and unknown roles", () => {
    expect(canAccess(ROLES.SUPER_ADMIN, "/secret")).toBe(false);
    expect(canAccess("HACKER", "/dashboard")).toBe(false);
    expect(canAccess(ROLES.SUPER_ADMIN, "/admin/usersX")).toBe(false);
  });
});
