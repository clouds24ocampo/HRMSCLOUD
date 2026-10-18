"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { approverUserIds, notify } from "@/lib/notify";
import { canViewEmployee } from "@/lib/scope";
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

// A comment under a report, or a reply to a comment. Anyone who may see the person's reports may write: the employee,
// their supervisors and HR. Append-only. Replies always attach to the top comment (one level), so threads stay readable.
export async function addReportComment(reportId: string, parentId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/daily-report");
  const body = z.string().trim().min(1, "Write a comment.").max(2000, "Keep it under 2,000 characters.").safeParse(form.get("body"));
  if (!body.success) return { error: body.error.issues[0].message };
  const report = await prisma.dailyReport.findFirst({ where: { id: reportId, organizationId: me.organizationId }, include: { employee: { select: { id: true, userId: true, firstName: true, lastName: true } } } });
  if (!report) return { error: "Report not found." };
  const mine = await getMyEmployee(me);
  if (!(await canViewEmployee(me, mine.id, report.employeeId))) return { error: "You cannot comment on this report." };

  let root: { id: string; authorId: string } | null = null;
  if (parentId) {
    const parent = await prisma.dailyReportComment.findFirst({ where: { id: parentId, reportId, organizationId: me.organizationId } });
    if (!parent) return { error: "The comment you are replying to no longer exists." };
    root = { id: parent.parentId ?? parent.id, authorId: parent.authorId };
  }
  const c = await prisma.dailyReportComment.create({ data: { organizationId: me.organizationId, reportId, authorId: me.id, parentId: root?.id ?? null, body: body.data } });
  await audit(me.id, root ? "daily_report.replied" : "daily_report.commented", "DailyReportComment", c.id, { reportId }, me.organizationId);

  // Tell the other side: the owner when someone else writes, the supervisors and HR when the owner writes, and the person replied to.
  const ownerUserId = report.employee.userId;
  const people = new Set<string>();
  if (ownerUserId && ownerUserId !== me.id) people.add(ownerUserId);
  if (ownerUserId === me.id) for (const u of await approverUserIds(me.organizationId, report.employeeId)) people.add(u);
  if (root && root.authorId !== me.id) people.add(root.authorId);
  await notify(me.organizationId, [...people], {
    title: `${me.name} ${root ? "replied" : "commented"} on ${ownerUserId === me.id ? "their" : `${report.employee.firstName}'s`} daily report`,
    body: body.data.length > 120 ? `${body.data.slice(0, 117)}…` : body.data,
    href: `/daily-report?employee=${report.employeeId}`,
  }, me.id);
  revalidatePath("/daily-report");
  return { ok: root ? "Reply sent." : "Comment sent." };
}
