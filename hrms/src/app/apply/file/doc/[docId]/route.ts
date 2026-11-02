import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readStored, safeName } from "@/lib/documents";

// The applicant opens one of their own 201 file uploads.
export async function GET(_: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const me = await requireUser("/apply");
  const d = await prisma.applicantDocument.findFirst({ where: { id: docId, profile: { userId: me.id }, organizationId: me.organizationId } });
  if (!d) return new Response("Not found", { status: 404 });
  const bytes = await readStored(d.storageKey, me.organizationId);
  if (!bytes) return new Response("The file is missing from storage.", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": d.mimeType, "Content-Disposition": `inline; filename="${safeName(d.fileName)}"`, "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox", "Cache-Control": "private, no-store",
    },
  });
}
