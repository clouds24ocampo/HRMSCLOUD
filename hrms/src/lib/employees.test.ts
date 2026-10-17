import { describe, expect, it } from "vitest";
import { nextEmployeeNo } from "./employees";

describe("nextEmployeeNo", () => {
  it("formats employee number as YYYYMMDD-0001 based on date", async () => {
    const orgId = "org_1";
    const testDate = new Date("2026-10-17T08:00:00Z");

    const mockDb = {
      employee: {
        findMany: async () => [],
        findUnique: async () => null,
      },
    } as unknown as Parameters<typeof nextEmployeeNo>[0];

    const no = await nextEmployeeNo(mockDb, orgId, testDate, "Asia/Manila");
    expect(no).toBe("20261017-0001");
  });

  it("increments the sequence for employees created on the same day", async () => {
    const orgId = "org_1";
    const testDate = new Date("2026-10-17T08:00:00Z");

    const mockDb = {
      employee: {
        findMany: async () => [{ employeeNo: "20261017-0001" }, { employeeNo: "20261017-0002" }],
        findUnique: async () => null,
      },
    } as unknown as Parameters<typeof nextEmployeeNo>[0];

    const no = await nextEmployeeNo(mockDb, orgId, testDate, "Asia/Manila");
    expect(no).toBe("20261017-0003");
  });
});
