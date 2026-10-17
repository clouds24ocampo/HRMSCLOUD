"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser, SESSION_COOKIE } from "@/lib/auth";
import { clockStatus } from "@/lib/dtr";
import { getMyEmployee } from "@/lib/employees";
import { STAMP_SELECT, toPunch } from "@/lib/punch";
import { stampBlock, tripError } from "@/lib/stamp-rules";
import { clearAttempts, tooManyAttempts } from "@/lib/rate-limit";
import { getOrgSettings } from "@/lib/settings";
import { isHr } from "@/lib/scope";
import { getPunchUnlock, setPunchUnlock } from "@/lib/session";
import { requestEvidence } from "@/lib/device";
import { consumeLocationLink } from "@/lib/location-link";
import { dayKey, dbDate, formatTime, parseHMS, zonedTimeToUtcWithSeconds } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const CONTEXTS = ["OFFICE", "FIELD", "REMOTE", "CLIENT_SITE"] as const;

export type ClockResult = { ok?: string; error?: string; needNote?: boolean; needTrip?: boolean; locked?: boolean; needPhone?: boolean };
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

const input = z.object({
  stampTypeId: z.string().min(1),
  workContext: z.enum(CONTEXTS).transform((v) => (v === "CLIENT_SITE" ? "FIELD" : v)),
  note: z.string().trim().max(300).optional(),
  tripFrom: z.string().trim().max(120).optional(),
  tripTo: z.string().trim().max(120).optional(),
  tripReason: z.string().trim().max(120).optional(),
  geo: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(1_000_000) })
    .nullable(),
  geoError: z.enum(["DENIED", "UNAVAILABLE"]).optional(),
  linkToken: z.string().max(64).optional(), // the phone confirmed the location (desktop stamps)
  allowRough: z.boolean().optional(), // desktop: stamp with the computer's rough location anyway (flagged, needs a note)
});

// The one way anyone records time. Server clock only; the browser supplies location, never the time.
export async function recordTime(raw: z.input<typeof input>): Promise<ClockResult> {
  const me = await requireUser("/dtr");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: "Something went wrong. Please try again." };
  const d = parsed.data;

  const settings = await getOrgSettings(me.organizationId);
  const emp = await getMyEmployee(me, settings.timezone);
  if (emp.status === "SEPARATED" || emp.status === "SUSPENDED") return { error: "Your status does not allow clocking in. Please contact HR." };

  const stamp = await prisma.timeStampType.findFirst({ where: { id: d.stampTypeId, organizationId: me.organizationId, archivedAt: null } });
  if (!stamp) return { error: "That time stamp is no longer available. Refresh the page." };

  // Password check (step 2). Kept after a failed attempt so the person can fix a note and retry; used up on success.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (settings.requirePunchPassword) {
    const until = token ? await getPunchUnlock(token) : null;
    if (!until || until.getTime() < Date.now()) return { locked: true, error: "Verify your password first." };
  }

  // Recent punches decide what is allowed next (36 hours back covers overnight shifts).
  const recent = await prisma.timeEvent.findMany({
    where: { employeeId: emp.id, organizationId: me.organizationId, voidedAt: null, at: { gte: new Date(Date.now() - 36 * 3600_000) } },
    select: { type: true, at: true, stampTypeId: true, stampType: { select: STAMP_SELECT } },
    orderBy: { at: "asc" },
  });
  const status = clockStatus(recent.map(toPunch));

  let type: "IN" | "OUT" | "PAUSE_START" | "PAUSE_END";
  let priorPauseTypeIdToClose: string | null = null;
  let priorPauseName: string | null = null;

  if (stamp.kind === "IN") {
    if (status.state === "OUT") {
      type = "IN";
    } else if (status.state === "ON_PAUSE") {
      // User is on a pause/issue (e.g. Heavy Rain, Break, Meal) and clicks "Time In" to resume working!
      type = "PAUSE_END";
      priorPauseTypeIdToClose = status.pause?.typeId ?? stamp.id;
      priorPauseName = status.pause?.name ?? "pause";
    } else {
      return { error: "You are already actively timed in and working." };
    }
  } else if (stamp.kind === "OUT") {
    if (status.state === "OUT") return { error: "You are not clocked in." };
    if (status.state === "ON_PAUSE" && status.pause?.typeId) {
      priorPauseTypeIdToClose = status.pause.typeId;
      priorPauseName = status.pause.name;
    }
    type = "OUT";
  } else if (status.state === "OUT") {
    return { error: "Time In first." };
  } else if (status.state === "IN") {
    type = "PAUSE_START";
  } else if (status.pause?.typeId === stamp.id) {
    type = "PAUSE_END"; // pressing the same pause again resumes work
    priorPauseName = stamp.name;
  } else {
    // User is on a pause/issue (e.g. Heavy Rain) and clicks another pause/tagging (e.g. Meal Break or Break)
    // Seamlessly change tagging: close the active pause and start the new one!
    priorPauseTypeIdToClose = status.pause?.typeId ?? null;
    priorPauseName = status.pause?.name ?? null;
    type = "PAUSE_START";
  }

  if (type === "PAUSE_START") {
    const ot = await prisma.overtimeRequest.findFirst({
      where: { employeeId: emp.id, organizationId: me.organizationId, status: "APPROVED", date: dbDate(dayKey(new Date(), settings.timezone)) },
      select: { minutes: true },
    });
    const blocked = stampBlock(stamp, recent, ot?.minutes ?? 0, false);
    if (blocked) return { error: `${stamp.name}: ${blocked}.` };
  }

  const isTrip = stamp.key === "ON_TRIP" && type === "PAUSE_START";
  if (isTrip) {
    const te = tripError(d);
    if (te) return { needTrip: true, error: te };
  }

  const lastAt = recent[recent.length - 1]?.at;
  if (lastAt && Date.now() - lastAt.getTime() < 3000) return { error: "Already recorded. Please wait a moment." };

  if (stamp.requiresNote && type !== "PAUSE_END" && (d.note ?? "").length < 3) {
    return { needNote: true, error: `${stamp.name} needs a short note. Add one and press again.` };
  }

  // Where the stamp was made. A phone reads GPS; a computer only estimates (Wi-Fi or IP), so on a computer a rough or
  // missing fix asks for the phone instead. The phone's fix arrives through a one-time link (see locate/actions.ts).
  const ev0 = await requestEvidence();
  let geo = d.geo;
  let locSource: "GPS" | "WIFI" | "PHONE_LINK" | "NONE" = geo ? (ev0.device === "DESKTOP" ? "WIFI" : "GPS") : "NONE";
  if (d.linkToken) {
    const phone = await consumeLocationLink(me.id, d.linkToken);
    if (!phone) return { needPhone: true, error: "The phone location expired or was already used. Scan the QR code again." };
    geo = phone;
    locSource = "PHONE_LINK";
  } else if (ev0.device === "DESKTOP" && (!geo || geo.accuracy > settings.lowAccuracyMeters) && !d.allowRough) {
    return { needPhone: true, error: `This computer cannot pinpoint where you are${geo ? ` (only ±${Math.round(geo.accuracy)} m)` : ""}. Scan the QR code with your phone to confirm your location.` };
  }
  if (d.allowRough && locSource === "WIFI" && geo && geo.accuracy > settings.lowAccuracyMeters) {
    if (settings.gpsPolicy === "BLOCK") return { needPhone: true, error: "Your organization requires an exact location. Confirm it with your phone." };
    if ((d.note ?? "").length < 3) return { needNote: true, error: "Add a short note on why you cannot confirm with your phone, and press again." };
  }
  let gpsStatus: "OK" | "LOW_ACCURACY" | "DENIED" | "UNAVAILABLE" = d.geoError ?? "UNAVAILABLE";
  if (geo) gpsStatus = geo.accuracy > settings.lowAccuracyMeters ? "LOW_ACCURACY" : "OK";
  if (!geo) {
    // A phone has GPS: no location from a phone means location is switched off or blocked, so the stamp is refused.
    if (ev0.device !== "DESKTOP") {
      return { error: d.geoError === "DENIED"
        ? "Location is blocked for this site. Allow location in your phone's browser settings, then press again. Time stamps need your location."
        : "Your phone could not find your location. Turn on Location (GPS), step near a window or outside, and press again." };
    }
    if (settings.gpsPolicy === "BLOCK") return { error: "Your organization requires your location. Allow location access and try again." };
    if ((d.note ?? "").length < 3) return { needNote: true, error: "We could not get your location. Add a short note (for example, “no signal at site”) and press again." };
  }

  const effectiveContext = (stamp.defaultContext === "CLIENT_SITE" ? "FIELD" : stamp.defaultContext) ?? d.workContext;

  // If changing tagging or clocking out while on pause, record PAUSE_END for the previous pause first
  if (priorPauseTypeIdToClose && (type === "PAUSE_START" || type === "OUT")) {
    await prisma.timeEvent.create({
      data: {
        organizationId: me.organizationId,
        employeeId: emp.id,
        type: "PAUSE_END",
        stampTypeId: priorPauseTypeIdToClose,
        source: "WEB",
        workContext: effectiveContext,
        lat: geo?.lat,
        lng: geo?.lng,
        accuracy: geo?.accuracy,
        gpsStatus,
        note: type === "OUT" ? `Shift ended while on ${priorPauseName}` : `Switched tagging to ${stamp.name}`,
        createdById: me.id,
        locSource,
        device: ev0.device,
        ipAddress: ev0.ipAddress,
        userAgent: ev0.userAgent,
        at: new Date(Date.now() - 500),
      },
    });
  }

  const eventStampTypeId = type === "PAUSE_END" && priorPauseTypeIdToClose ? priorPauseTypeIdToClose : stamp.id;
  const ev = await prisma.timeEvent.create({
    data: {
      organizationId: me.organizationId,
      employeeId: emp.id,
      type,
      stampTypeId: eventStampTypeId,
      source: "WEB",
      workContext: effectiveContext,
      ...(isTrip ? { tripFrom: d.tripFrom, tripTo: d.tripTo, tripReason: d.tripReason } : {}),
      lat: geo?.lat,
      lng: geo?.lng,
      accuracy: geo?.accuracy,
      gpsStatus,
      note: d.note || (stamp.kind === "IN" && type === "PAUSE_END" ? "Resumed work (Time In)" : null),
      createdById: me.id,
      locSource,
      device: ev0.device,
      ipAddress: ev0.ipAddress,
      userAgent: ev0.userAgent,
    },
  });
  if (token) await setPunchUnlock(token, null); // one unlock, one time stamp
  revalidatePath("/dtr");
  revalidatePath("/dashboard");

  const verb =
    type === "IN"
      ? "Timed in"
      : type === "OUT"
      ? "Timed out"
      : type === "PAUSE_END"
      ? (stamp.kind === "IN" ? `Resumed work (ended ${priorPauseName})` : `${stamp.name} ended`)
      : priorPauseTypeIdToClose
      ? `Switched to ${stamp.name} (ended ${priorPauseName})`
      : `${stamp.name} started`;
  const where = geo ? `location recorded (±${Math.round(geo.accuracy)} m${locSource === "PHONE_LINK" ? ", from your phone" : ""})` : "no location, flagged";
  return { ok: `${verb} at ${formatTime(ev.at, settings.timezone)}, ${where}.` };
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
