import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { imageResponse } from "@/lib/documents";

// The ID card signatory's signature, shown on every card of the organization.
export async function GET() {
  const me = await requireUser("/id");
  const s = await prisma.idCardSettings.findUnique({ where: { organizationId: me.organizationId }, select: { signatureKey: true } });
  return imageResponse(s?.signatureKey, me.organizationId);
}
