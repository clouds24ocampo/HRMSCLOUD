import { prisma } from "@/lib/prisma";

// Tenant boundary: always pass the signed-in user's organizationId, never a client value.
export function listOrgUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    select: { id: true, name: true, email: true, active: true, mustChangePassword: true, roleId: true, role: { select: { key: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 200, // ponytail: no pagination until user count needs it
  });
}
