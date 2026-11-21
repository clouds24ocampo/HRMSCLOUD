import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { EMPLOYEE_RESTRICT_TABLES } from "./employee-delete";

describe("deleting an employee", () => {
  it("handles every table that would block it (a new table that points at Employee must be added to the delete)", async () => {
    const rows = await prisma.$queryRaw<{ tbl: string }[]>`
      select distinct c.conrelid::regclass::text as tbl
      from pg_constraint c
      where c.contype = 'f' and c.confrelid = '"Employee"'::regclass and c.conrelid <> '"Employee"'::regclass and c.confdeltype in ('a', 'r')`;
    const found = rows.map((r) => r.tbl.replace(/"/g, "")).sort();
    expect(found).toEqual([...EMPLOYEE_RESTRICT_TABLES].sort());
  });
  it("handles every table that would block deleting the sign-in (only the applicant account does, and it is removed first)", async () => {
    const rows = await prisma.$queryRaw<{ tbl: string }[]>`
      select distinct c.conrelid::regclass::text as tbl
      from pg_constraint c
      where c.contype = 'f' and c.confrelid = '"User"'::regclass and c.conrelid <> '"User"'::regclass and c.confdeltype in ('a', 'r')`;
    expect(rows.map((r) => r.tbl.replace(/"/g, "")).sort()).toEqual(["ApplicantProfile"]);
  });
});
