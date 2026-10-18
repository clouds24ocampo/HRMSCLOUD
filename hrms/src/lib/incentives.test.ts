import { describe, expect, it, vi, beforeEach } from "vitest";
import { awardIncentive, acceptIncentive, declineIncentive } from "./incentives";
import { prisma } from "./prisma";
import { audit } from "./audit";
import { notify } from "./notify";

vi.mock("./prisma", () => ({
  prisma: {
    employee: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    incentive: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    wsCard: { findFirst: vi.fn() },
  },
}));

vi.mock("./audit", () => ({
  audit: vi.fn(),
}));

vi.mock("./notify", () => ({
  notify: vi.fn(),
}));

vi.mock("./worksync-data", () => ({
  logActivity: vi.fn(),
}));

describe("Employee Incentive System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("awardIncentive", () => {
    it("creates a PENDING incentive, logs audit trail, and notifies employee", async () => {
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce({
        id: "emp-1",
        firstName: "Maria",
        lastName: "Santos",
        userId: "usr-emp-1",
      } as never);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "usr-lead-1",
        name: "Juan Lead",
      } as never);

      vi.mocked(prisma.incentive.create).mockResolvedValueOnce({
        id: "inc-101",
        organizationId: "org-1",
        employeeId: "emp-1",
        title: "Q4 Performance Milestone",
        amountCents: 500000,
        reason: "Exceeded delivery goals on time",
        status: "PENDING",
        awardedById: "usr-lead-1",
        projectId: null,
        cardId: null,
        createdAt: new Date(),
      } as never);

      const result = await awardIncentive({
        organizationId: "org-1",
        employeeId: "emp-1",
        title: "Q4 Performance Milestone",
        amountCents: 500000,
        reason: "Exceeded delivery goals on time",
        awardedById: "usr-lead-1",
      });

      expect(result.id).toBe("inc-101");
      expect(result.status).toBe("PENDING");

      // Verify audit was logged
      expect(audit).toHaveBeenCalledWith(
        "usr-lead-1",
        "incentive.awarded",
        "Incentive",
        "inc-101",
        expect.objectContaining({
          employeeId: "emp-1",
          employeeName: "Maria Santos",
          amountCents: 500000,
        }),
        "org-1",
      );

      // Verify notification sent to employee user ID
      expect(notify).toHaveBeenCalledWith(
        "org-1",
        ["usr-emp-1"],
        expect.objectContaining({
          title: expect.stringContaining("Incentive Award: ₱5,000.00"),
          href: "/incentives",
        }),
        "usr-lead-1",
      );
    });

    it("throws error if employee does not exist", async () => {
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(null);

      await expect(
        awardIncentive({
          organizationId: "org-1",
          employeeId: "nonexistent",
          title: "Bonus",
          amountCents: 100000,
          reason: "Good job",
          awardedById: "usr-lead-1",
        }),
      ).rejects.toThrow("Employee not found.");
    });
  });

  describe("awardIncentive guards", () => {
    it("looks the employee up inside the organization only", async () => {
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(null);
      await expect(awardIncentive({ organizationId: "org-1", employeeId: "emp-of-another-company", title: "Bonus", amountCents: 100, reason: "x y z", awardedById: "usr-lead-1" })).rejects.toThrow("Employee not found.");
      expect(vi.mocked(prisma.employee.findFirst).mock.calls[0][0]).toMatchObject({ where: { id: "emp-of-another-company", organizationId: "org-1" } });
      expect(prisma.incentive.create).not.toHaveBeenCalled();
    });
    it("refuses to award yourself", async () => {
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce({ id: "emp-9", firstName: "A", lastName: "B", userId: "usr-lead-1" } as never);
      await expect(awardIncentive({ organizationId: "org-1", employeeId: "emp-9", title: "Bonus", amountCents: 100, reason: "x y z", awardedById: "usr-lead-1" })).rejects.toThrow("yourself");
    });
    it("refuses a card that is not part of the project", async () => {
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce({ id: "emp-1", firstName: "A", lastName: "B", userId: "usr-1" } as never);
      vi.mocked(prisma.wsCard.findFirst).mockResolvedValueOnce(null);
      await expect(awardIncentive({ organizationId: "org-1", employeeId: "emp-1", title: "Bonus", amountCents: 100, reason: "x y z", awardedById: "usr-lead-1", projectId: "p1", cardId: "card-of-another-project" })).rejects.toThrow("not part of this project");
      expect(prisma.incentive.create).not.toHaveBeenCalled();
    });
  });

  describe("acceptIncentive", () => {
    it("allows the recipient employee to accept, updating status to ACCEPTED and recording timestamp", async () => {
      vi.mocked(prisma.incentive.findUnique).mockResolvedValueOnce({
        id: "inc-101",
        organizationId: "org-1",
        employeeId: "emp-1",
        title: "Milestone Bonus",
        amountCents: 300000,
        status: "PENDING",
        awardedById: "usr-lead-1",
        employee: {
          id: "emp-1",
          userId: "usr-emp-1",
          firstName: "Maria",
          lastName: "Santos",
        },
      } as never);

      const acceptedTime = new Date();
      vi.mocked(prisma.incentive.update).mockResolvedValueOnce({
        id: "inc-101",
        status: "ACCEPTED",
        acceptedAt: acceptedTime,
        employeeNote: "Thank you so much!",
      } as never);

      const result = await acceptIncentive("inc-101", "usr-emp-1", "Thank you so much!");

      expect(result.status).toBe("ACCEPTED");
      expect(prisma.incentive.update).toHaveBeenCalledWith({
        where: { id: "inc-101" },
        data: expect.objectContaining({
          status: "ACCEPTED",
          employeeNote: "Thank you so much!",
        }),
      });

      // Verify acceptance audit trail
      expect(audit).toHaveBeenCalledWith(
        "usr-emp-1",
        "incentive.accepted",
        "Incentive",
        "inc-101",
        expect.objectContaining({
          employeeId: "emp-1",
          amountCents: 300000,
          employeeNote: "Thank you so much!",
        }),
        "org-1",
      );

      // Verify awarder is notified of acceptance
      expect(notify).toHaveBeenCalledWith(
        "org-1",
        ["usr-lead-1"],
        expect.objectContaining({
          title: expect.stringContaining("Incentive Accepted by Maria Santos"),
        }),
        "usr-emp-1",
      );
    });

    it("prevents unauthorized users from accepting someone else's incentive", async () => {
      vi.mocked(prisma.incentive.findUnique).mockResolvedValueOnce({
        id: "inc-101",
        organizationId: "org-1",
        employeeId: "emp-1",
        status: "PENDING",
        employee: {
          id: "emp-1",
          userId: "usr-emp-1",
        },
      } as never);

      await expect(
        acceptIncentive("inc-101", "attacker-user-id"),
      ).rejects.toThrow("You are not authorized to accept this incentive.");
    });

    it("prevents re-accepting an already accepted incentive", async () => {
      vi.mocked(prisma.incentive.findUnique).mockResolvedValueOnce({
        id: "inc-101",
        organizationId: "org-1",
        employeeId: "emp-1",
        status: "ACCEPTED",
        employee: {
          id: "emp-1",
          userId: "usr-emp-1",
        },
      } as never);

      await expect(
        acceptIncentive("inc-101", "usr-emp-1"),
      ).rejects.toThrow("Incentive is already accepted.");
    });
  });

  describe("declineIncentive", () => {
    it("updates status to DECLINED with reason", async () => {
      vi.mocked(prisma.incentive.findUnique).mockResolvedValueOnce({
        id: "inc-101",
        organizationId: "org-1",
        employeeId: "emp-1",
        title: "Bonus",
        amountCents: 100000,
        status: "PENDING",
        employee: {
          id: "emp-1",
          userId: "usr-emp-1",
        },
      } as never);

      vi.mocked(prisma.incentive.update).mockResolvedValueOnce({
        id: "inc-101",
        status: "DECLINED",
        declinedAt: new Date(),
        employeeNote: "Declined per company compliance policy",
      } as never);

      const result = await declineIncentive("inc-101", "usr-emp-1", "Declined per company compliance policy");

      expect(result.status).toBe("DECLINED");
      expect(prisma.incentive.update).toHaveBeenCalledWith({
        where: { id: "inc-101" },
        data: expect.objectContaining({
          status: "DECLINED",
          employeeNote: "Declined per company compliance policy",
        }),
      });
    });
  });
});
