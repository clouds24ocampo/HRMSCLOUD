// Orientation day for applicants: when signing opens, and which company policies they must sign.
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/time";

// Signing opens on the first day of any scheduled orientation (in the organization's time zone) and stays open after it.
export function orientationOpen(scheduled: Date[], now: Date, tz: string): boolean {
  const today = dayKey(now, tz);
  return scheduled.some((d) => dayKey(d, tz) <= today);
}

// The current policies that need a signature, each marked signed or not for this applicant.
export async function requiredPolicies(organizationId: string, profileId: string) {
  const [policies, signed] = await Promise.all([
    prisma.policyDocument.findMany({ where: { organizationId, archivedAt: null, requiresSignature: true }, select: { id: true, title: true, kind: true, version: true }, orderBy: { createdAt: "asc" } }),
    prisma.applicantPolicySignature.findMany({ where: { profileId }, select: { policyId: true, createdAt: true } }),
  ]);
  const at = new Map(signed.map((s) => [s.policyId, s.createdAt]));
  return policies.map((p) => ({ ...p, signed: at.has(p.id), signedAt: at.get(p.id) ?? null }));
}
