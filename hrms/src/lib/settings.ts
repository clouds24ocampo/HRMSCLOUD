import { prisma } from "@/lib/prisma";
import { DEFAULT_LEAVE_TYPES, shiftPresetFor } from "@/lib/defaults";

// Work settings for an organization. The first call creates them, plus industry-based starter shifts and leave types.
export async function getOrgSettings(organizationId: string) {
  const found = await prisma.orgSettings.findUnique({ where: { organizationId } });
  if (found) return found;

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { categoryKey: true } });
  return prisma.$transaction(async (tx) => {
    const settings = await tx.orgSettings.upsert({ where: { organizationId }, update: {}, create: { organizationId } });
    if ((await tx.shiftTemplate.count({ where: { organizationId } })) === 0) {
      await tx.shiftTemplate.createMany({ data: shiftPresetFor(org.categoryKey).map((s) => ({ ...s, organizationId })) });
    }
    if ((await tx.leaveType.count({ where: { organizationId } })) === 0) {
      await tx.leaveType.createMany({ data: DEFAULT_LEAVE_TYPES.map((l) => ({ ...l, organizationId })) });
    }
    return settings;
  });
}
