"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const long = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

// Your own report for today. Append-only: a sent report is never edited. Sending again adds a newer report for the day,
// which is the one that counts; the earlier ones stay on record. The date is the server's today, never the browser's.
export async function saveDailyReport(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/daily-report");
  const parsed = z
    .object({ accomplishments: z.string().trim().min(5, "Write what you worked on today (at least 5 characters).").max(4000), issues: long(2000), plans: long(2000) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const settings = await getOrgSettings(me.organizationId);
  const emp = await getMyEmployee(me, settings.timezone);
  const date = dbDate(dayKey(new Date(), settings.timezone));
  const r = await prisma.dailyReport.create({ data: { ...parsed.data, organizationId: me.organizationId, employeeId: emp.id, date } });
  await audit(me.id, "daily_report.saved", "DailyReport", r.id, undefined, me.organizationId);
  revalidatePath("/daily-report");
  revalidatePath("/dashboard");
  return { ok: "Sent. It can no longer be edited; send a new one if something changed." };
}
