import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readStored, safeName } from "@/lib/documents";

// A policy that HR published as a PDF, opened by an applicant on orientation day.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/apply");
  const p = await prisma.policyDocument.findFirst({ where: { id, organizationId: me.organizationId, archivedAt: null, requiresSignature: true } });
  if (!p?.storageKey) return new Response("Not found", { status: 404 });
  const bytes = await readStored(p.storageKey, me.organizationId);
  if (!bytes) return new Response("The file is missing from storage.", { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${safeName(p.fileName ?? "policy.pdf")}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
