// Phone-confirmed location for desktop time stamps (see app/(app)/locate/actions.ts). Server-only helpers.
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const hashLinkToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const linkTokenOk = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(t);

// Used by recordTime: takes the phone's fix once (it cannot be replayed for a second stamp).
export async function consumeLocationLink(userId: string, token: string) {
  if (!linkTokenOk(token)) return null;
  const link = await prisma.locationLink.findUnique({ where: { tokenHash: hashLinkToken(token) } });
  if (!link || link.userId !== userId || !link.fixedAt || link.usedAt || link.expiresAt < new Date() || link.lat == null || link.lng == null) return null;
  const n = await prisma.locationLink.updateMany({ where: { id: link.id, usedAt: null }, data: { usedAt: new Date() } });
  return n.count ? { lat: link.lat, lng: link.lng, accuracy: link.accuracy ?? 0 } : null;
}
