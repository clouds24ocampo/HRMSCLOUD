import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { readStored, safeName } from "@/lib/documents";

// HR opens an applicant's resume or valid ID. Every open is written to the audit log (a valid ID is sensitive).
export async function GET(_: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  const me = await requireUser("/recruitment");
  if (kind !== "resume" && kind !== "id") return new Response("Not found", { status: 404 });
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId }, include: { profile: true } });
  const p = a?.profile;
  const [key, name, mime] = kind === "resume" ? [p?.resumeKey, p?.resumeName, p?.resumeMime] : [p?.idKey, p?.idName, p?.idMime];
  if (!a || !key || !mime) return new Response("Not found", { status: 404 });
  const bytes = await readStored(key, me.organizationId);
  if (!bytes) return new Response("The file is missing from storage.", { status: 404 });
  await audit(me.id, "applicant.document_viewed", "Applicant", id, { kind }, me.organizationId);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="${safeName(name ?? kind)}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
