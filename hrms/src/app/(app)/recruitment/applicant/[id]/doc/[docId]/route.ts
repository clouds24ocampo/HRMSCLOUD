import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { readStored, safeName } from "@/lib/documents";

// HR opens one of an applicant's 201 file requirement uploads. Every open is written to the audit log.
export async function GET(_: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const me = await requireUser("/recruitment");
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId }, select: { profileId: true } });
  const d = a?.profileId ? await prisma.applicantDocument.findFirst({ where: { id: docId, profileId: a.profileId, organizationId: me.organizationId } }) : null;
  if (!d) return new Response("Not found", { status: 404 });
  const bytes = await readStored(d.storageKey, me.organizationId);
  if (!bytes) return new Response("The file is missing from storage.", { status: 404 });
  await audit(me.id, "applicant.document_viewed", "Applicant", id, { title: d.title }, me.organizationId);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": d.mimeType,
      "Content-Disposition": `inline; filename="${safeName(d.fileName)}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
