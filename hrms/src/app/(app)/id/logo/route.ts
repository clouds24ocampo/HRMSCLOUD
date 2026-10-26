import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { imageResponse } from "@/lib/documents";

// The company logo shown on every ID card of the organization.
export async function GET() {
  const me = await requireUser("/id");
  const s = await prisma.idCardSettings.findUnique({ where: { organizationId: me.organizationId }, select: { logoKey: true } });
  return imageResponse(s?.logoKey, me.organizationId);
}
