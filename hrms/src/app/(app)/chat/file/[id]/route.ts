import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readStored, safeName } from "@/lib/documents";

// The only way to read a chat attachment: signed in, and a member of the conversation it was sent in.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/chat");
  const m = await prisma.message.findFirst({
    where: { id, attachmentKey: { not: null }, conversation: { organizationId: me.organizationId, members: { some: { userId: me.id } } } },
    select: { attachmentKey: true, attachmentName: true, attachmentMime: true },
  });
  const bytes = m?.attachmentKey ? await readStored(m.attachmentKey, me.organizationId) : null;
  if (!m || !bytes) return new Response("Not found", { status: 404 });
  const mime = m.attachmentMime ?? "application/octet-stream";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      // Pictures show in the chat; everything else downloads instead of running in the browser.
      "Content-Disposition": `${mime.startsWith("image/") ? "inline" : "attachment"}; filename="${safeName(m.attachmentName ?? "file")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
