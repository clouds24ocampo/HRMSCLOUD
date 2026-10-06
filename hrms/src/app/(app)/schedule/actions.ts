"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { isHr, visibleEmployeeIds } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { addDays as addDaysKey, dayKey, dbDate, daysBetween, keyOfDbDate, weekday } from "@/lib/time";
import { becomeCustom, followersOf } from "@/lib/schedule";
import { notify } from "@/lib/notify";
import type { FormState } from "@/app/login/actions";

const key = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose both dates.");
const weekdays = z.array(z.coerce.number().int().min(0).max(6)).min(1, "Choose at least one weekday.");

type Me = Awaited<ReturnType<typeof requireUser>>;

// Only people this user may see, and only inside this organization. Returns an error message or the ids.
async function checkPeople(me: Me, wanted: string[], tz: string): Promise<{ error: string } | { ids: string[] }> {
  const mine = await getMyEmployee(me, tz);
  const allowed = await visibleEmployeeIds(me, mine.id);
  const people = await prisma.employee.findMany({
    where: { organizationId: me.organizationId, id: { in: allowed ? wanted.filter((p) => allowed.includes(p)) : wanted } },
    select: { id: true },
  });
  return people.length === wanted.length ? { ids: people.map((p) => p.id) } : { error: "One or more people are outside your team." };
}

const canPlan = (me: Me) => me.role.key === ROLES.MANAGER || isHr(me.role.key);

// Regular weekly schedule: same shift on chosen weekdays, every week, from an effective date.
// A change adds a new row; earlier days keep the schedule that applied then.
export async function setRegularSchedule(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/schedule");
  if (!canPlan(me)) return { error: "You can view the schedule but not change it." };
  const parsed = z
    .object({ effectiveFrom: key, shiftId: z.string().min(1, "Choose a shift."), people: z.array(z.string()).min(1, "Choose at least one person."), days: weekdays })
    .safeParse({ effectiveFrom: form.get("effectiveFrom"), shiftId: form.get("shiftId"), people: form.getAll("people"), days: form.getAll("days") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const settings = await getOrgSettings(me.organizationId);
  const today = dayKey(new Date(), settings.timezone);
  if (d.effectiveFrom < today && !isHr(me.role.key)) return { error: "Only HR can start a schedule in the past." };
  const shift = await prisma.shiftTemplate.findFirst({ where: { id: d.shiftId, organizationId: me.organizationId, archivedAt: null } });
  if (!shift) return { error: "Choose a shift from the list." };
  const checked = await checkPeople(me, d.people, settings.timezone);
  if ("error" in checked) return checked;

  // Team link: people who follow an edited supervisor get the same schedule; people edited without their supervisor become Custom.
  const team = await prisma.employee.findMany({ where: { organizationId: me.organizationId }, select: { id: true, managerId: true, scheduleLinked: true, userId: true } });
  const followers = followersOf(team, checked.ids);
  const custom = becomeCustom(team, checked.ids);
  const targets = [...checked.ids, ...followers];

  await prisma.$transaction(async (tx) => {
    for (const employeeId of targets) {
      const same = await tx.regularSchedule.findFirst({ where: { employeeId, organizationId: me.organizationId, effectiveFrom: dbDate(d.effectiveFrom) } });
      const data = { shiftId: shift.id, workDays: d.days, createdById: me.id };
      if (same) await tx.regularSchedule.update({ where: { id: same.id }, data });
      else await tx.regularSchedule.create({ data: { ...data, organizationId: me.organizationId, employeeId, effectiveFrom: dbDate(d.effectiveFrom) } });
    }
    if (custom.length) await tx.employee.updateMany({ where: { id: { in: custom }, organizationId: me.organizationId }, data: { scheduleLinked: false } });
  });
  await audit(me.id, "schedule.regular_set", "RegularSchedule", undefined, { people: checked.ids.length, followers: followers.length, custom: custom.length, shift: shift.name, days: d.days, from: d.effectiveFrom }, me.organizationId);
  const userIds = team.filter((t) => targets.includes(t.id) && t.userId).map((t) => t.userId!);
  await notify(me.organizationId, userIds, { title: "Your schedule changed", body: `${shift.name} from ${d.effectiveFrom}.`, href: "/schedule" }, me.id);
  revalidatePath("/schedule");
  revalidatePath("/employees");
  revalidatePath("/dtr");
  const n = targets.length;
  return { ok: `Regular schedule saved for ${n} ${n === 1 ? "person" : "people"}, from ${d.effectiveFrom}.${followers.length ? ` ${followers.length} followed their leader automatically.` : ""}${custom.length ? ` ${custom.length} now Custom (differs from their leader).` : ""}` };
}

// Plan a shift (or a day off, or clear the plan) for chosen people over a date range and weekdays.
// These overrides sit on top of the regular schedule.
export async function assignSchedule(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/schedule");
  if (!canPlan(me)) return { error: "You can view the schedule but not change it." };

  const parsed = z
    .object({ from: key, to: key, shift: z.string().min(1, "Choose a shift, day off, or clear."), people: z.array(z.string()).min(1, "Choose at least one person."), days: weekdays })
    .safeParse({ from: form.get("from"), to: form.get("to"), shift: form.get("shift"), people: form.getAll("people"), days: form.getAll("days") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.from > d.to) return { error: "The end date is before the start date." };
  const range = daysBetween(d.from, d.to);
  if (range.length > 62) return { error: "Plan at most 62 days at a time." };

  const settings = await getOrgSettings(me.organizationId);
  const today = dayKey(new Date(), settings.timezone);
  if (d.from < today && !isHr(me.role.key)) return { error: "Only HR can change past days." };
  const checked = await checkPeople(me, d.people, settings.timezone);
  if ("error" in checked) return checked;

  let shiftId: string | null = null;
  if (d.shift !== "OFF" && d.shift !== "CLEAR") {
    const s = await prisma.shiftTemplate.findFirst({ where: { id: d.shift, organizationId: me.organizationId, archivedAt: null } });
    if (!s) return { error: "Choose a shift from the list." };
    shiftId = s.id;
  }

  const days = range.filter((k) => d.days.includes(weekday(k)));
  if (days.length === 0) return { error: "No matching days in that range." };

  await prisma.$transaction(async (tx) => {
    for (const employeeId of checked.ids) {
      if (d.shift === "CLEAR") {
        await tx.scheduleEntry.deleteMany({ where: { employeeId, organizationId: me.organizationId, date: { in: days.map(dbDate) } } });
        continue;
      }
      for (const k of days) {
        await tx.scheduleEntry.upsert({
          where: { employeeId_date: { employeeId, date: dbDate(k) } },
          update: { shiftId },
          create: { organizationId: me.organizationId, employeeId, date: dbDate(k), shiftId },
        });
      }
    }
  });
  await audit(me.id, "schedule.assigned", "ScheduleEntry", undefined, { people: checked.ids.length, days: days.length, shift: d.shift, from: d.from, to: d.to }, me.organizationId);
  revalidatePath("/schedule");
  revalidatePath("/dtr");
  const n = checked.ids.length;
  return { ok: `${d.shift === "CLEAR" ? "Changes cleared" : "Schedule saved"}: ${n} ${n === 1 ? "person" : "people"}, ${days.length} ${days.length === 1 ? "day" : "days"}.` };
}

// Put a Custom person back on their supervisor's schedule: copies the supervisor's current regular schedule and links them again.
export async function relinkToLeader(employeeId: string): Promise<FormState> {
  const me = await requireUser("/schedule");
  if (!canPlan(me)) return { error: "You can view the schedule but not change it." };
  const settings = await getOrgSettings(me.organizationId);
  const checked = await checkPeople(me, [employeeId], settings.timezone);
  if ("error" in checked) return checked;
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, select: { id: true, managerId: true } });
  if (!emp?.managerId) return { error: "This person has no supervisor to follow." };
  const today = dayKey(new Date(), settings.timezone);
  const lead = await prisma.regularSchedule.findFirst({ where: { employeeId: emp.managerId, organizationId: me.organizationId, effectiveFrom: { lte: dbDate(today) } }, orderBy: { effectiveFrom: "desc" } });
  if (!lead) return { error: "Their supervisor has no regular schedule yet." };
  await prisma.$transaction([
    prisma.regularSchedule.upsert({
      where: { id: (await prisma.regularSchedule.findFirst({ where: { employeeId, effectiveFrom: dbDate(today) }, select: { id: true } }))?.id ?? "none" },
      update: { shiftId: lead.shiftId, workDays: lead.workDays, createdById: me.id },
      create: { organizationId: me.organizationId, employeeId, shiftId: lead.shiftId, workDays: lead.workDays, effectiveFrom: dbDate(today), createdById: me.id },
    }),
    prisma.employee.update({ where: { id: employeeId }, data: { scheduleLinked: true } }),
  ]);
  await audit(me.id, "schedule.relinked", "Employee", employeeId, { to: emp.managerId }, me.organizationId);
  revalidatePath("/schedule");
  revalidatePath("/dtr");
  return { ok: "Back on their leader's schedule." };
}

// Copy the previous week's day changes (swaps, extra shifts, days off) onto the shown week for chosen people.
export async function copyLastWeek(weekStart: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/schedule");
  if (!canPlan(me)) return { error: "You can view the schedule but not change it." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: "Bad week." };
  const settings = await getOrgSettings(me.organizationId);
  const people = form.getAll("people").map(String);
  const checked = await checkPeople(me, people, settings.timezone);
  if ("error" in checked) return checked;
  const today = dayKey(new Date(), settings.timezone);
  const prev = daysBetween(addDaysKey(weekStart, -7), addDaysKey(weekStart, -1));
  const rows = await prisma.scheduleEntry.findMany({ where: { organizationId: me.organizationId, employeeId: { in: checked.ids }, date: { in: prev.map(dbDate) } } });
  let n = 0;
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const target = addDaysKey(keyOfDbDate(r.date), 7);
      if (target < today && !isHr(me.role.key)) continue;
      await tx.scheduleEntry.upsert({
        where: { employeeId_date: { employeeId: r.employeeId, date: dbDate(target) } },
        update: { shiftId: r.shiftId },
        create: { organizationId: me.organizationId, employeeId: r.employeeId, date: dbDate(target), shiftId: r.shiftId },
      });
      n++;
    }
  });
  await audit(me.id, "schedule.copied_week", "ScheduleEntry", undefined, { weekStart, people: checked.ids.length, entries: n }, me.organizationId);
  revalidatePath("/schedule");
  return { ok: n ? `Copied ${n} day ${n === 1 ? "change" : "changes"} from last week.` : "Nothing to copy: last week had no day changes." };
}
