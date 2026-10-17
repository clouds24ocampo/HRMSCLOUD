"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { parseHM } from "@/lib/time";
import { STAMP_ICONS, STAMP_TONES } from "@/lib/defaults";
import type { FormState } from "@/app/login/actions";

const done = () => revalidatePath("/settings");
const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export async function saveWorkRules(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/settings");
  const parsed = z
    .object({
      timezone: z.string().refine(validZone, "Choose a valid timezone."),
      gpsPolicy: z.enum(["ALLOW_FLAG", "BLOCK"]),
      graceMinutes: z.coerce.number().int().min(0).max(120, "Grace period is at most 120 minutes."),
      lowAccuracyMeters: z.coerce.number().int().min(10).max(5000, "Accuracy limit is between 10 and 5000 meters."),
      punchUnlockSeconds: z.coerce.number().int().min(30, "The unlock lasts at least 30 seconds.").max(600, "The unlock lasts at most 600 seconds."),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await getOrgSettings(me.organizationId);
  const data = { ...parsed.data, requirePunchPassword: form.get("requirePunchPassword") === "on" };
  await prisma.orgSettings.update({ where: { organizationId: me.organizationId }, data });
  await audit(me.id, "settings.updated", "OrgSettings", undefined, data, me.organizationId);
  done();
  return { ok: "Work rules saved." };
}

export async function addShift(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/settings");
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter a shift name.").max(60),
      startTime: z.string().refine((v) => parseHM(v) !== null, "Choose a start time."),
      endTime: z.string().refine((v) => parseHM(v) !== null, "Choose an end time."),
      breakMinutes: z.coerce.number().int().min(0).max(240),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.startTime === parsed.data.endTime) return { error: "Start and end time cannot be the same." };
  if (await prisma.shiftTemplate.findUnique({ where: { organizationId_name: { organizationId: me.organizationId, name: parsed.data.name } } })) {
    return { error: "A shift with this name already exists." };
  }
  const s = await prisma.shiftTemplate.create({ data: { ...parsed.data, organizationId: me.organizationId } });
  await audit(me.id, "shift.created", "ShiftTemplate", s.id, parsed.data, me.organizationId);
  done();
  return { ok: `${s.name} added.` };
}

export async function setShiftArchived(id: string, archived: boolean) {
  const me = await requireUser("/settings");
  const s = await prisma.shiftTemplate.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!s) return;
  await prisma.shiftTemplate.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(me.id, archived ? "shift.archived" : "shift.restored", "ShiftTemplate", id, { name: s.name }, me.organizationId);
  done();
}

export async function addLeaveType(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/settings");
  const parsed = z
    .object({ name: z.string().trim().min(2, "Enter a leave type name.").max(60), annualDays: z.coerce.number().int().min(0).max(365), paid: z.string().optional() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (await prisma.leaveType.findUnique({ where: { organizationId_name: { organizationId: me.organizationId, name: parsed.data.name } } })) {
    return { error: "A leave type with this name already exists." };
  }
  const l = await prisma.leaveType.create({
    data: { organizationId: me.organizationId, name: parsed.data.name, annualDays: parsed.data.annualDays, paid: parsed.data.paid === "on" },
  });
  await audit(me.id, "leave_type.created", "LeaveType", l.id, { name: l.name, annualDays: l.annualDays }, me.organizationId);
  done();
  return { ok: `${l.name} added.` };
}

export async function setLeaveTypeArchived(id: string, archived: boolean) {
  const me = await requireUser("/settings");
  const l = await prisma.leaveType.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!l) return;
  await prisma.leaveType.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(me.id, archived ? "leave_type.archived" : "leave_type.restored", "LeaveType", id, { name: l.name }, me.organizationId);
  done();
}

// Custom time stamps are always pauses (Break-like): they start a timed pause that is ended later.
export async function addStampType(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/settings");
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter a name.").max(30, "Keep the name under 30 characters."),
      icon: z.enum(STAMP_ICONS as [string, ...string[]]),
      tone: z.enum(STAMP_TONES),
      allowedMinutes: z.string().optional().transform((v) => (v ? Number(v) : null)).pipe(z.number().int().min(1, "Allowed time is at least 1 minute.").max(720).nullable()),
      defaultContext: z
        .enum(["OFFICE", "FIELD", "REMOTE", "CLIENT_SITE"])
        .optional()
        .or(z.literal("").transform(() => undefined))
        .transform((v) => (v === "CLIENT_SITE" ? "FIELD" : v)),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const existing = await prisma.timeStampType.findMany({ where: { organizationId: me.organizationId }, select: { key: true, name: true, sortOrder: true } });
  if (existing.some((e) => e.name.toLowerCase() === d.name.toLowerCase())) return { error: "A time stamp with this name already exists." };
  const base = d.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "CUSTOM";
  let key = base;
  for (let n = 2; existing.some((e) => e.key === key); n++) key = `${base}_${n}`;
  const sortOrder = Math.min(Math.max(...existing.filter((e) => e.sortOrder < 99).map((e) => e.sortOrder), 0) + 10, 98);

  const t = await prisma.timeStampType.create({
    data: {
      organizationId: me.organizationId, key, name: d.name, icon: d.icon, tone: d.tone, kind: "PAUSE", sortOrder,
      paid: form.get("paid") === "on", requiresNote: form.get("requiresNote") === "on",
      allowedMinutes: d.allowedMinutes, defaultContext: d.defaultContext,
    },
  });
  await audit(me.id, "stamp_type.created", "TimeStampType", t.id, { name: t.name, paid: t.paid, allowedMinutes: t.allowedMinutes }, me.organizationId);
  done();
  return { ok: `${t.name} added. It now appears on the time clock.` };
}

export async function setStampArchived(id: string, archived: boolean) {
  const me = await requireUser("/settings");
  const t = await prisma.timeStampType.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!t || t.locked) return; // Time In and Time Out always exist
  await prisma.timeStampType.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(me.id, archived ? "stamp_type.archived" : "stamp_type.restored", "TimeStampType", id, { name: t.name }, me.organizationId);
  done();
}

export async function addChecklistTemplate(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/settings");
  const parsed = z
    .object({ kind: z.enum(["ONBOARDING", "OFFBOARDING"]), owner: z.enum(["HR", "MANAGER", "EMPLOYEE"]), title: z.string().trim().min(3, "Describe the task.").max(100) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const last = await prisma.checklistTemplate.findFirst({ where: { organizationId: me.organizationId, kind: parsed.data.kind }, orderBy: { sortOrder: "desc" } });
  const t = await prisma.checklistTemplate.create({ data: { organizationId: me.organizationId, ...parsed.data, sortOrder: (last?.sortOrder ?? 0) + 10 } });
  await audit(me.id, "checklist_template.created", "ChecklistTemplate", t.id, { title: t.title, kind: t.kind }, me.organizationId);
  done();
  return { ok: "Task added. It applies to people hired or separated from now on." };
}

export async function setChecklistTemplateArchived(id: string, archived: boolean) {
  const me = await requireUser("/settings");
  const t = await prisma.checklistTemplate.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!t) return;
  await prisma.checklistTemplate.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(me.id, archived ? "checklist_template.archived" : "checklist_template.restored", "ChecklistTemplate", id, { title: t.title }, me.organizationId);
  done();
}
