"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getClockInfo } from "@/lib/clock";
import { requestEvidence } from "@/lib/device";
import { DB_DOWN_MESSAGE, isDbDown } from "@/lib/db-health";
import { clearAttempts, isLimited, recordHit } from "@/lib/rate-limit";
import { getOrgSettings } from "@/lib/settings";
import { applyStamp, parseStampInput, type ClockResult, type StampInput } from "@/lib/stamp";

// Time stamp from the login page: employee number + password, no sign-in, no session. The password is checked again on
// every call (nothing is remembered between the two steps), and the stamp goes through the same engine as the DTR clock.
// Employee numbers are only unique inside one company, so the password decides which person it is.
const DUMMY_HASH = "$2b$12$.8/s7sFJBbRqj2ALc2LmZOUc5Gee/y.W2KgmsEwT0Uf259A/eA1FW";
const WRONG = "Wrong ID number or password.";

export type KioskInfo = { name: string; org: string; clock: Awaited<ReturnType<typeof getClockInfo>> };
export type KioskLookup = { error?: string; info?: KioskInfo };
export type KioskStampResult = ClockResult & { info?: KioskInfo };

async function verify(idNo: unknown, password: unknown) {
  const id = typeof idNo === "string" ? idNo.trim() : "";
  if (!id || id.length > 40 || typeof password !== "string" || !password || password.length > 200) return { error: "Enter your ID number and password." } as const;
  const ev = await requestEvidence();
  const idKey = `kiosk:id:${id.toLowerCase()}`;
  const ipKey = `kiosk:ip:${ev.ipAddress ?? "unknown"}`;
  // Only failures count, so a busy shared phone is never locked out by honest stamps. One ID is limited tightly (5);
  // one network address loosely (100), because a whole office shares it and typos add up. It stops guessing across many IDs.
  if (isLimited(idKey, 5) || isLimited(ipKey, 100)) return { error: "Too many wrong attempts. Try again in 15 minutes." } as const;

  const candidates = await prisma.employee.findMany({
    where: { employeeNo: { equals: id, mode: "insensitive" }, userId: { not: null }, user: { active: true } },
    select: { id: true, organizationId: true, status: true, firstName: true, lastName: true, user: { select: { id: true, passwordHash: true, mustChangePassword: true } }, organization: { select: { name: true } } },
    take: 5,
  });
  const checks = await Promise.all((candidates.length ? candidates : [null]).map(async (c) => ({ c, ok: await bcrypt.compare(password, c?.user?.passwordHash ?? DUMMY_HASH) })));
  const hits = checks.filter((x) => x.ok && x.c);
  if (hits.length === 0) {
    recordHit(idKey);
    recordHit(ipKey);
    await audit(null, "kiosk.failed", "Employee", undefined, { idNo: id });
    return { error: WRONG } as const;
  }
  if (hits.length > 1) return { error: "This ID number and password match more than one account. Please contact HR." } as const;
  const c = hits[0].c!;
  clearAttempts(idKey);
  if (c.user!.mustChangePassword) return { error: "Sign in once and choose your own password first. Then you can time stamp from here." } as const;
  return { employee: c, userId: c.user!.id, org: c.organization.name } as const;
}

async function info(v: Exclude<Awaited<ReturnType<typeof verify>>, { error: string }>): Promise<KioskInfo> {
  const settings = await getOrgSettings(v.employee.organizationId);
  return { name: `${v.employee.firstName} ${v.employee.lastName}`, org: v.org, clock: await getClockInfo(v.employee.organizationId, v.employee.id, settings.timezone) };
}

// Step 1: who is this, and what can they do right now.
export async function kioskLookup(idNo: string, password: string): Promise<KioskLookup> {
  try {
    const v = await verify(idNo, password);
    if ("error" in v) return { error: v.error };
    if (v.employee.status === "SEPARATED" || v.employee.status === "SUSPENDED") return { error: "Your status does not allow clocking in. Please contact HR." };
    return { info: await info(v) };
  } catch (e) {
    if (isDbDown(e)) return { error: DB_DOWN_MESSAGE };
    throw e;
  }
}

// Step 2: the stamp itself. The server clock is used; the phone only supplies its location.
export async function kioskStamp(idNo: string, password: string, raw: StampInput): Promise<KioskStampResult> {
  try {
    const v = await verify(idNo, password);
    if ("error" in v) return { error: v.error };
    const parsed = parseStampInput(raw);
    if (!parsed.success) return { error: "Something went wrong. Please try again." };
    const settings = await getOrgSettings(v.employee.organizationId);
    // No phone link on this page (it needs a session): a computer may stamp with its rough location, flagged, with a note.
    const result = await applyStamp({ organizationId: v.employee.organizationId, userId: v.userId, employee: v.employee, settings, d: { ...parsed.data, linkToken: undefined }, source: "KIOSK" });
    if (!result.ok) return result;
    revalidatePath("/dtr");
    revalidatePath("/dashboard");
    return { ...result, info: await info(v) };
  } catch (e) {
    if (isDbDown(e)) return { error: DB_DOWN_MESSAGE };
    throw e;
  }
}
