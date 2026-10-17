import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { imageResponse } from "@/lib/documents";
import { isHr } from "@/lib/scope";

// A signature image: the signer and HR only.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/policies");
  const s = await prisma.policySignature.findFirst({ where: { id, organizationId: me.organizationId }, select: { signatureKey: true, employee: { select: { userId: true } } } });
  if (!s || !(isHr(me.role.key) || s.employee.userId === me.id)) return new Response("Not found", { status: 404 });
  return imageResponse(s.signatureKey, me.organizationId);
}
