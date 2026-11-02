import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readStored, safeName } from "@/lib/documents";

// The applicant opens their own resume or valid ID. Nobody else's: the file is found through the signed-in user.
export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const me = await requireUser("/apply");
  if (kind !== "resume" && kind !== "id") return new Response("Not found", { status: 404 });
  const p = await prisma.applicantProfile.findUnique({ where: { userId: me.id } });
  const [key, name, mime] = kind === "resume" ? [p?.resumeKey, p?.resumeName, p?.resumeMime] : [p?.idKey, p?.idName, p?.idMime];
  if (!p || !key || !mime) return new Response("Not found", { status: 404 });
  const bytes = await readStored(key, me.organizationId);
  if (!bytes) return new Response("The file is missing from storage.", { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mime, "Content-Disposition": `inline; filename="${safeName(name ?? kind)}"`, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox", "Cache-Control": "private, no-store" } });
}

