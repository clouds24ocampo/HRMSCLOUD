"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { standardHolidays } from "@/lib/ph/holidays";
import { dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const done = () => revalidatePath("/payroll/holidays");

export async function addHoliday(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const p = z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."), name: z.string().trim().min(2, "Name the holiday.").max(80), type: z.enum(["REGULAR", "SPECIAL_NON_WORKING", "SPECIAL_WORKING"], "Choose the kind of holiday.") })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  if (await prisma.holiday.findUnique({ where: { organizationId_date_name: { organizationId: me.organizationId, date: dbDate(p.data.date), name: p.data.name } } })) return { error: "That holiday is already in the calendar." };
  const h = await prisma.holiday.create({ data: { organizationId: me.organizationId, date: dbDate(p.data.date), name: p.data.name, type: p.data.type } });
  await audit(me.id, "payroll.holiday_added", "Holiday", h.id, { date: p.data.date, name: h.name, type: h.type }, me.organizationId);
  done();
  return { ok: `${h.name} added.` };
}

// The holidays fixed by law, plus Holy Week. Proclaimed ones (Eid'l Fitr, Eid'l Adha, extra special days) are added by hand.
export async function addStandardHolidays(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const y = z.coerce.number().int().min(2020).max(2100).safeParse(form.get("year"));
  if (!y.success) return { error: "Enter a year, for example 2026." };
  const res = await prisma.holiday.createMany({
    data: standardHolidays(y.data).map((h) => ({ organizationId: me.organizationId, date: dbDate(h.date), name: h.name, type: h.type })),
    skipDuplicates: true,
  });
  await audit(me.id, "payroll.holidays_added", "Holiday", undefined, { year: y.data, added: res.count }, me.organizationId);
  done();
  return { ok: `${res.count} holiday${res.count === 1 ? "" : "s"} added for ${y.data}. Now add the ones proclaimed this year.` };
}

export async function removeHoliday(id: string) {
  const me = await requireUser("/payroll");
  const h = await prisma.holiday.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!h) return;
  await prisma.holiday.delete({ where: { id } });
  await audit(me.id, "payroll.holiday_removed", "Holiday", id, { name: h.name }, me.organizationId);
  done();
}
