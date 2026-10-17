import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readStored, safeName, sniffType } from "@/lib/documents";
import { isHr } from "@/lib/scope";

// Proof of payment: HR and the employee the payslip belongs to.
export async function GET(_: Request, { params }: { params: Promise<{ id: string; payoutId: string }> }) {
  const { id, payoutId } = await params;
  const me = await requireUser("/payslips");
  const p = await prisma.payout.findFirst({ where: { id: payoutId, payslipId: id, organizationId: me.organizationId }, include: { payslip: { select: { employee: { select: { userId: true } } } } } });
  if (!p?.proofKey || !(isHr(me.role.key) || p.payslip.employee.userId === me.id)) return new Response("Not found", { status: 404 });
  const bytes = await readStored(p.proofKey, me.organizationId);
  if (!bytes) return new Response("The file is missing from storage.", { status: 404 });
  // The type comes from the stored bytes, never from what was saved with the record; only PDF/PNG/JPEG open inline.
  const type = sniffType(bytes);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type?.mime ?? "application/octet-stream",
      "Content-Disposition": `${type ? "inline" : "attachment"}; filename="${safeName(p.proofName ?? "proof")}"`,
      // Images get a sandbox; Chrome's PDF viewer will not open inside one, and a PDF cannot run script on this site anyway.
      ...(type?.mime === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" }),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
