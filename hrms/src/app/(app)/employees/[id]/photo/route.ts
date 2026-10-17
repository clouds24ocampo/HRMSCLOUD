import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { imageResponse } from "@/lib/documents";
import { canViewEmployee } from "@/lib/scope";

// Profile picture. Same visibility as the profile itself: yourself, your supervisor chain, HR.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/dashboard");
  const mine = await getMyEmployee(me);
  if (!(await canViewEmployee(me, mine.id, id))) return new Response("Not found", { status: 404 });
  const e = await prisma.employee.findFirst({ where: { id, organizationId: me.organizationId }, select: { photoKey: true } });
  return imageResponse(e?.photoKey, me.organizationId);
}
