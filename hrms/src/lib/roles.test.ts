import { describe, expect, it } from "vitest";
import { ROLES, canAccess } from "./roles";

describe("canAccess", () => {
  it("lets every role open the dashboard", () => {
    for (const r of Object.values(ROLES).filter((x) => x !== ROLES.APPLICANT)) expect(canAccess(r, "/dashboard")).toBe(true);
  });
  it("keeps applicants inside the careers portal, and everyone else out of it", () => {
    expect(canAccess(ROLES.APPLICANT, "/apply")).toBe(true);
    expect(canAccess(ROLES.APPLICANT, "/apply/exam/1")).toBe(true);
    for (const p of ["/dashboard", "/employees", "/recruitment", "/chat", "/dtr", "/payslips", "/admin/users"]) expect(canAccess(ROLES.APPLICANT, p)).toBe(false);
    for (const r of Object.values(ROLES).filter((x) => x !== ROLES.APPLICANT)) expect(canAccess(r, "/apply")).toBe(false);
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
    expect(canAccess(ROLES.SUBCONTRACTOR, "/id")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/policies")).toBe(true);

    expect(canAccess(ROLES.SUBCONTRACTOR, "/payslips")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/leave")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/overtime")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/performance")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/learning")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/documents")).toBe(false);
    expect(canAccess(ROLES.SUBCONTRACTOR, "/requests")).toBe(false);
  });
  it("hides documents, digital ID, performance, learning, leave, and overtime from Employee role", () => {
    expect(canAccess(ROLES.EMPLOYEE, "/documents")).toBe(false);
    expect(canAccess(ROLES.EMPLOYEE, "/id")).toBe(false);
    expect(canAccess(ROLES.EMPLOYEE, "/performance")).toBe(false);
    expect(canAccess(ROLES.EMPLOYEE, "/learning")).toBe(false);
    expect(canAccess(ROLES.EMPLOYEE, "/leave")).toBe(false);
    expect(canAccess(ROLES.EMPLOYEE, "/overtime")).toBe(false);
  });
  it("denies unlisted pages and unknown roles", () => {
    expect(canAccess(ROLES.SUPER_ADMIN, "/secret")).toBe(false);
    expect(canAccess("HACKER", "/dashboard")).toBe(false);
    expect(canAccess(ROLES.SUPER_ADMIN, "/admin/usersX")).toBe(false);
  });
  it("gives every staff role a profile page, keeps the ID page to HR and supervisors, and gives applicants neither", () => {
    for (const r of Object.values(ROLES).filter((x) => x !== ROLES.APPLICANT)) {
      expect(canAccess(r, "/profile")).toBe(true);
    }
    expect(canAccess(ROLES.APPLICANT, "/profile")).toBe(false);
    expect(canAccess(ROLES.APPLICANT, "/id")).toBe(false);
    for (const r of [ROLES.EMPLOYEE, ROLES.SUBCONTRACTOR]) expect(canAccess(r, "/id")).toBe(false);
    for (const r of [ROLES.EMPLOYEE, ROLES.SUBCONTRACTOR, ROLES.MANAGER]) expect(canAccess(r, "/id/design")).toBe(false);
  });
});
