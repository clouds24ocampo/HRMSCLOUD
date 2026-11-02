import { prisma } from "@/lib/prisma";

// What applicants do for themselves on the careers portal (sign in, apply, exams, uploads) is recorded under "portal.".
// The operations audit log, activity analytics and the Home feed leave those out; HR's own actions on applicants
// (applicant.moved, applicant.hired, ...) stay in.
export const PORTAL_PREFIX = "portal.";
export const NOT_PORTAL = { NOT: { action: { startsWith: PORTAL_PREFIX } } } as const;

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
