import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readStored, safeName } from "@/lib/documents";

// A policy PDF. Every signed-in person of the organization may read its policies.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/policies");
  const p = await prisma.policyDocument.findFirst({ where: { id, organizationId: me.organizationId }, select: { storageKey: true, fileName: true } });
  const bytes = p?.storageKey ? await readStored(p.storageKey, me.organizationId) : null;
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName(p!.fileName ?? "policy.pdf")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
