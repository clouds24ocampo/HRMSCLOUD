"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { notify, userIdOfEmployee } from "@/lib/notify";
import { ROLES } from "@/lib/roles";
import { isHr } from "@/lib/scope";
import { REQUEST_CATEGORIES } from "@/lib/labels";
import type { FormState } from "@/app/login/actions";

const done = () => revalidatePath("/requests");

export async function createRequest(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/requests");
  const parsed = z
    .object({ category: z.enum(REQUEST_CATEGORIES, { error: "Choose what this is about." }), subject: z.string().trim().min(3, "Give it a short subject.").max(100), message: z.string().trim().min(5, "Tell HR what you need.").max(2000) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const emp = await getMyEmployee(me);
  const r = await prisma.hrRequest.create({ data: { organizationId: me.organizationId, employeeId: emp.id, ...parsed.data } });
  await audit(me.id, "request.created", "HrRequest", r.id, { category: r.category }, me.organizationId);
  const hr = await prisma.user.findMany({ where: { organizationId: me.organizationId, active: true, role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN] } } }, select: { id: true } });
  await notify(me.organizationId, hr.map((u) => u.id), { title: `${me.name}: ${r.subject}`, body: r.category, href: "/requests" }, me.id);
  done();
  return { ok: "Sent to HR. You will be notified when they answer." };
}

export async function respondRequest(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/requests");
  if (!isHr(me.role.key)) return { error: "Only HR can answer requests." };
  const parsed = z.object({ status: z.enum(["IN_PROGRESS", "RESOLVED"]), response: z.string().trim().max(2000).optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the form and try again." };
  if (parsed.data.status === "RESOLVED" && (parsed.data.response ?? "").length < 3) return { error: "Write the answer before resolving." };
  const r = await prisma.hrRequest.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!r) return { error: "Request not found." };
  await prisma.hrRequest.update({ where: { id }, data: { status: parsed.data.status, response: parsed.data.response || r.response, respondedById: me.id, respondedAt: new Date() } });
  await audit(me.id, "request.responded", "HrRequest", id, { status: parsed.data.status }, me.organizationId);
  const uid = await userIdOfEmployee(me.organizationId, r.employeeId);
  if (uid) await notify(me.organizationId, [uid], { title: parsed.data.status === "RESOLVED" ? `HR answered: ${r.subject}` : `HR is working on: ${r.subject}`, href: "/requests" }, me.id);
  done();
  return { ok: parsed.data.status === "RESOLVED" ? "Resolved." : "Marked as in progress." };
}
