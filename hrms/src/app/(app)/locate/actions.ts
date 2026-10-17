"use server";

import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requestEvidence } from "@/lib/device";
import { hashLinkToken as hash, linkTokenOk as tokenOk } from "@/lib/location-link";

// Desktop and laptop browsers cannot read GPS. The desktop asks for a one-time link, shows it as a QR code, and the same
// person opens it on their phone: the phone's GPS fix is then used for the desktop's next time stamp.
const TTL_MS = 10 * 60_000;

export async function createLocationLink(): Promise<{ token: string; url: string; qr: string }> {
  const me = await requireUser("/dtr");
  const token = randomBytes(24).toString("base64url");
  await prisma.locationLink.deleteMany({ where: { userId: me.id, OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } }); // tidy old ones
  await prisma.locationLink.create({ data: { tokenHash: hash(token), userId: me.id, expiresAt: new Date(Date.now() + TTL_MS) } });
  const url = `${(await requestEvidence()).origin}/locate/${token}`;
  return { token, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
}

const geo = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100_000) });

// Called from the phone. Only the person who made the link can fill it, and only from a phone or tablet.
export async function submitLocationFix(token: string, raw: z.input<typeof geo>): Promise<{ ok?: string; error?: string }> {
  const me = await requireUser("/locate");
  if (!tokenOk(token)) return { error: "This link is not valid." };
  const g = geo.safeParse(raw);
  if (!g.success) return { error: "The location could not be read. Try again." };
  if ((await requestEvidence()).device === "DESKTOP") return { error: "Open this link on your phone, not on a computer." };
  const link = await prisma.locationLink.findUnique({ where: { tokenHash: hash(token) } });
  if (!link || link.userId !== me.id) return { error: "This link belongs to another account. Sign in as yourself on the phone." };
  if (link.usedAt || link.expiresAt < new Date()) return { error: "This link has expired. Make a new one on the computer." };
  await prisma.locationLink.update({ where: { id: link.id }, data: { lat: g.data.lat, lng: g.data.lng, accuracy: g.data.accuracy, fixedAt: new Date() } });
  return { ok: `Location sent (±${Math.round(g.data.accuracy)} m). Go back to the computer and press your time stamp.` };
}

// Polled by the desktop while the QR code is on screen.
export async function checkLocationLink(token: string): Promise<{ accuracy: number } | null> {
  const me = await requireUser("/dtr");
  if (!tokenOk(token)) return null;
  const link = await prisma.locationLink.findUnique({ where: { tokenHash: hash(token) }, select: { userId: true, accuracy: true, fixedAt: true, usedAt: true, expiresAt: true } });
  if (!link || link.userId !== me.id || !link.fixedAt || link.usedAt || link.expiresAt < new Date()) return null;
  return { accuracy: link.accuracy ?? 0 };
}
