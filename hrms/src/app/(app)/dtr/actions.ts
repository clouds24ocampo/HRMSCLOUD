"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser, SESSION_COOKIE } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { clearAttempts, tooManyAttempts } from "@/lib/rate-limit";
import { getOrgSettings } from "@/lib/settings";
import { isHr } from "@/lib/scope";
import { getPunchUnlock, setPunchUnlock } from "@/lib/session";
import { applyStamp, parseStampInput, type ClockResult as StampResult, type StampInput } from "@/lib/stamp";
import { parseHMS, zonedTimeToUtcWithSeconds } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

export type UnlockResult = { ok?: boolean; error?: string; seconds?: number };

// Step 2 of the time stamp: prove it is really you. Unlocks one time stamp for a short window.
export async function unlockPunch(password: string): Promise<UnlockResult> {
  const me = await requireUser("/dtr");
  if (typeof password !== "string" || !password) return { error: "Enter your password." };
  const key = `punch:${me.id}`;
  if (tooManyAttempts(key)) return { error: "Too many attempts. Try again in 15 minutes." };
  if (!(await bcrypt.compare(password, me.passwordHash))) return { error: "Wrong password." };
  clearAttempts(key);
  const settings = await getOrgSettings(me.organizationId);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await setPunchUnlock(token, new Date(Date.now() + settings.punchUnlockSeconds * 1000));
  return { ok: true, seconds: settings.punchUnlockSeconds };
}

export type ClockResult = StampResult;

// The one way a signed-in person records time. Server clock only; the browser supplies location, never the time.
export async function recordTime(raw: StampInput): Promise<ClockResult> {
  const me = await requireUser("/dtr");
  const parsed = parseStampInput(raw);
  if (!parsed.success) return { error: "Something went wrong. Please try again." };

  const settings = await getOrgSettings(me.organizationId);
  const emp = await getMyEmployee(me, settings.timezone);

  // Password check (step 2). Kept after a failed attempt so the person can fix a note and retry; used up on success.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (settings.requirePunchPassword) {
    const until = token ? await getPunchUnlock(token) : null;
    if (!until || until.getTime() < Date.now()) return { locked: true, error: "Verify your password first." };
  }

  const result = await applyStamp({ organizationId: me.organizationId, userId: me.id, employee: emp, settings, d: parsed.data, source: "WEB" });
  if (result.ok && token) await setPunchUnlock(token, null); // one unlock, one time stamp
  if (result.ok) {
    revalidatePath("/dtr");
    revalidatePath("/dashboard");
  }
  return result;
}

// HR adds a missed punch. It is a new MANUAL row with a reason, never an edit of an old one.
// `stamp` is "<typeId>|<phase>" where phase is MAIN (Time In/Out), START or END (pauses).
export async function addManualPunch(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/dtr");
  if (!isHr(me.role.key)) return { error: "Only HR can add a missed punch." };
  const parsed = z
    .object({
      employeeId: z.string().min(1, "Choose an employee."),
      stamp: z.string().regex(/^[^|]+\|(MAIN|START|END)$/, "Choose the time stamp."),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date."),
      time: z.string().refine((v) => parseHMS(v) !== null, "Choose the time."),
      reason: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(300),

    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [typeId, phase] = d.stamp.split("|");

  const [emp, stamp] = await Promise.all([
    prisma.employee.findFirst({ where: { id: d.employeeId, organizationId: me.organizationId } }),
    prisma.timeStampType.findFirst({ where: { id: typeId, organizationId: me.organizationId } }),
  ]);
  if (!emp) return { error: "Employee not found." };
  if (!stamp) return { error: "Choose the time stamp." };
  const type = stamp.kind === "IN" ? "IN" : stamp.kind === "OUT" ? "OUT" : phase === "END" ? "PAUSE_END" : "PAUSE_START";

  const settings = await getOrgSettings(me.organizationId);
  const parsedTime = parseHMS(d.time)!;
  const at = zonedTimeToUtcWithSeconds(d.date, parsedTime.minutes, parsedTime.seconds, settings.timezone);
  if (at.getTime() > Date.now() + 5 * 60_000) return { error: "A punch cannot be in the future." };


  const ev = await prisma.timeEvent.create({
    data: {
      organizationId: me.organizationId, employeeId: emp.id, type, stampTypeId: stamp.id, at, source: "MANUAL", gpsStatus: "NOT_CAPTURED",
      workContext: stamp.defaultContext ?? "OFFICE", note: d.reason, createdById: me.id,
    },
  });
  await audit(me.id, "time_event.manual_added", "TimeEvent", ev.id, { employeeId: emp.id, stamp: stamp.name, type, at: at.toISOString(), reason: d.reason }, me.organizationId);
  revalidatePath("/dtr");
  return { ok: "Missed punch added. It is marked as a manual entry." };
}

export async function voidPunch(eventId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/dtr");
  if (!isHr(me.role.key)) return { error: "Only HR can void a punch." };
  const reason = z.string().trim().min(5, "Give a reason (at least 5 characters).").max(300).safeParse(form.get("reason"));
  if (!reason.success) return { error: reason.error.issues[0].message };
  const ev = await prisma.timeEvent.findFirst({ where: { id: eventId, organizationId: me.organizationId, voidedAt: null } });
  if (!ev) return { error: "Punch not found." };
  await prisma.timeEvent.update({ where: { id: ev.id }, data: { voidedAt: new Date(), voidedById: me.id, voidReason: reason.data } });
  await audit(me.id, "time_event.voided", "TimeEvent", ev.id, { employeeId: ev.employeeId, type: ev.type, reason: reason.data }, me.organizationId);
  revalidatePath("/dtr");
  return { ok: "Punch voided. It stays on record, marked as voided." };
}
