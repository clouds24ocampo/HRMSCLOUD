import { prisma } from "@/lib/prisma";
import { DEFAULT_STAMP_TYPES } from "@/lib/defaults";

// The time stamp buttons of an organization. Starter set is created the first time they are needed.
export async function getStampTypes(organizationId: string, includeArchived = false) {
  const find = () =>
    prisma.timeStampType.findMany({
      where: { organizationId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  const any = await prisma.timeStampType.count({ where: { organizationId } });
  if (any === 0) {
    await prisma.timeStampType.createMany({ data: DEFAULT_STAMP_TYPES.map((t) => ({ ...t, organizationId })), skipDuplicates: true });
  }
  return find();
}
