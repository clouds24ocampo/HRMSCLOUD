import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { readStored, safeName } from "@/lib/documents";
import { isHr } from "@/lib/scope";

// The only way to read a document. HR can open any in their organization; everyone else only their own.
// Opening someone else's file is written to the audit log.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/documents");
  const doc = await prisma.employeeDocument.findFirst({
    where: { id, organizationId: me.organizationId },
    include: { employee: { select: { userId: true } } },
  });
  const own = doc?.employee.userId === me.id;
  if (!doc || !(isHr(me.role.key) || own)) return new Response("Not found", { status: 404 });
  const bytes = await readStored(doc.storageKey, me.organizationId);
  if (!bytes) return new Response("The file is missing from storage.", { status: 404 });
  if (!own) await audit(me.id, "document.viewed", "EmployeeDocument", doc.id, { employeeId: doc.employeeId, title: doc.title }, me.organizationId);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${safeName(doc.fileName)}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
