import { prisma } from "@/lib/prisma";

export function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  detail?: object,
  organizationId?: string,
) {
  return prisma.auditLog.create({
    data: { actorId, action, entity, entityId, detail, organizationId },
  });
}
