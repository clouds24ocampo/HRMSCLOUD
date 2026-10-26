import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEmployeeContractContext, signContract } from "./contracts";
import { prisma } from "./prisma";

vi.mock("./prisma", () => ({
  prisma: {
    employee: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    compensation: { findFirst: vi.fn() },
    contract: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("./audit", () => ({ audit: vi.fn() }));
vi.mock("./notify", () => ({ notify: vi.fn() }));

describe("contract guards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks the employee up inside the organization, so another company's id is not found", async () => {
    vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ name: "Acme" } as never);
    vi.mocked(prisma.compensation.findFirst).mockResolvedValueOnce(null);
    await expect(getEmployeeContractContext("emp-of-another-company", "org-1")).rejects.toThrow("Employee not found.");
    expect(vi.mocked(prisma.employee.findFirst).mock.calls[0][0]).toMatchObject({ where: { id: "emp-of-another-company", organizationId: "org-1" } });
  });

  it.each([["DRAFT", "not available for signing"], ["SIGNED", "already been signed"], ["VOID", "cancelled"]])("refuses to sign a %s contract", async (status, message) => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({ id: "c1", status, employee: { userId: "usr-1" } } as never);
    await expect(signContract("c1", "usr-1")).rejects.toThrow(message);
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it("refuses a signature from someone who is not the employee", async () => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({ id: "c1", status: "ISSUED", employee: { userId: "usr-1" } } as never);
    await expect(signContract("c1", "usr-2")).rejects.toThrow("not authorized");
  });
});
