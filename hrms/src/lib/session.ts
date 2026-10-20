import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const ttlMs = () => config.sessionTtlHours * 3600_000;

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs());
  await prisma.session.create({
    data: { tokenHash: hash(token), userId, expiresAt },
  });
  return { token, expiresAt };
}

// Returns the active user + role, or null if token unknown/expired/disabled.
export async function findSession(token: string) {
  const s = await prisma.session.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { include: { role: true, organization: true } } },
  });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  return s.user;
}

// The password check before a time stamp. The unlock lives on the session, lasts a short window and is used once.
export async function setPunchUnlock(token: string, until: Date | null) {
  await prisma.session.updateMany({ where: { tokenHash: hash(token) }, data: { punchUnlockedUntil: until } });
}

export async function getPunchUnlock(token: string): Promise<Date | null> {
  const s = await prisma.session.findUnique({ where: { tokenHash: hash(token) }, select: { punchUnlockedUntil: true } });
  return s?.punchUnlockedUntil ?? null;
}

// After a password change: sign out every other device, keep this one.
export async function deleteOtherSessions(userId: string, keepToken: string) {
  await prisma.session.deleteMany({ where: { userId, tokenHash: { not: hash(keepToken) } } });
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hash(token) } });
}
