import { describe, expect, it } from "vitest";
import { ROLES, canAccess } from "./roles";

describe("canAccess", () => {
  it("lets every role open the dashboard", () => {
    for (const r of Object.values(ROLES)) expect(canAccess(r, "/dashboard")).toBe(true);
  });
  it("lets only Super Admin open user management", () => {
    expect(canAccess(ROLES.SUPER_ADMIN, "/admin/users")).toBe(true);
    for (const r of [ROLES.HR_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE]) {
      expect(canAccess(r, "/admin/users")).toBe(false);
      expect(canAccess(r, "/admin/users/123")).toBe(false);
    }
  });
  it("denies unlisted pages and unknown roles", () => {
    expect(canAccess(ROLES.SUPER_ADMIN, "/secret")).toBe(false);
    expect(canAccess("HACKER", "/dashboard")).toBe(false);
    expect(canAccess(ROLES.SUPER_ADMIN, "/admin/usersX")).toBe(false);
  });
});
