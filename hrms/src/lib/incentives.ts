import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/worksync-data";

export type AwardIncentiveParams = {
  organizationId: string;
  employeeId: string;
  title: string;
  amountCents: number;
  reason: string;
  awardedById: string; // User id
  projectId?: string | null;
  cardId?: string | null;
};

/**
 * Award an incentive to an employee. Recorded as PENDING until employee explicitly accepts.
 */
export async function awardIncentive(params: AwardIncentiveParams) {
  const { organizationId, employeeId, title, amountCents, reason, awardedById, projectId, cardId } = params;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, firstName: true, lastName: true, userId: true },
  });
  if (!employee) throw new Error("Employee not found.");

  const awarder = await prisma.user.findUnique({
    where: { id: awardedById },
    select: { id: true, name: true },
  });

  const incentive = await prisma.incentive.create({
    data: {
      organizationId,
      employeeId,
      title: title.trim(),
      amountCents,
      reason: reason.trim(),
      status: "PENDING",
      awardedById,
      projectId: projectId || null,
      cardId: cardId || null,
    },
  });

  // Global system audit trail
  await audit(
    awardedById,
    "incentive.awarded",
    "Incentive",
    incentive.id,
    {
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      title,
      amountCents,
      reason,
      projectId,
      cardId,
    },
    organizationId,
  );

  // If tied to a WorkSync card, log activity on the card
  if (projectId && cardId) {
    const card = await prisma.wsCard.findUnique({ where: { id: cardId }, select: { title: true } });
    await logActivity(prisma, {
      organizationId,
      projectId,
      cardId,
      cardTitle: card?.title ?? "Card",
      actorId: awardedById,
      type: "EDITED",
      detail: `🎁 awarded ₱${(amountCents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })} incentive to ${employee.firstName} ${employee.lastName}: ${title}`,
    });
  }

  // Notify recipient
  if (employee.userId) {
    await notify(
      organizationId,
      [employee.userId],
      {
        title: `🎁 Incentive Award: ₱${(amountCents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
        body: `${awarder?.name ?? "Management"} awarded you an incentive for "${title}". Click to accept.`,
        href: "/incentives",
      },
      awardedById,
    );
  }

  return incentive;
}

/**
 * Employee explicitly accepts an incentive.
 */
export async function acceptIncentive(incentiveId: string, employeeUserId: string, employeeNote?: string | null) {
  const incentive = await prisma.incentive.findUnique({
    where: { id: incentiveId },
    include: { employee: true },
  });
  if (!incentive) throw new Error("Incentive not found.");

  if (incentive.employee.userId !== employeeUserId) {
    throw new Error("You are not authorized to accept this incentive.");
  }

  if (incentive.status !== "PENDING") {
    throw new Error(`Incentive is already ${incentive.status.toLowerCase()}.`);
  }

  const updated = await prisma.incentive.update({
    where: { id: incentiveId },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      employeeNote: employeeNote?.trim() || null,
    },
  });

  await audit(
    employeeUserId,
    "incentive.accepted",
    "Incentive",
    incentiveId,
    {
      employeeId: incentive.employeeId,
      amountCents: incentive.amountCents,
      acceptedAt: updated.acceptedAt,
      employeeNote,
    },
    incentive.organizationId,
  );

  // Notify the awarder
  await notify(
    incentive.organizationId,
    [incentive.awardedById],
    {
      title: `Incentive Accepted by ${incentive.employee.firstName} ${incentive.employee.lastName}`,
      body: `Accepted ₱${(incentive.amountCents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })} for "${incentive.title}". Credited to upcoming payroll.`,
      href: "/incentives",
    },
    employeeUserId,
  );

  return updated;
}

/**
 * Employee declines an incentive.
 */
export async function declineIncentive(incentiveId: string, employeeUserId: string, reason?: string | null) {
  const incentive = await prisma.incentive.findUnique({
    where: { id: incentiveId },
    include: { employee: true },
  });
  if (!incentive) throw new Error("Incentive not found.");

  if (incentive.employee.userId !== employeeUserId) {
    throw new Error("You are not authorized to decline this incentive.");
  }

  if (incentive.status !== "PENDING") {
    throw new Error(`Incentive is already ${incentive.status.toLowerCase()}.`);
  }

  const updated = await prisma.incentive.update({
    where: { id: incentiveId },
    data: {
      status: "DECLINED",
      declinedAt: new Date(),
      employeeNote: reason?.trim() || "Declined by employee",
    },
  });

  await audit(
    employeeUserId,
    "incentive.declined",
    "Incentive",
    incentiveId,
    {
      employeeId: incentive.employeeId,
      amountCents: incentive.amountCents,
      reason,
    },
    incentive.organizationId,
  );

  return updated;
}
