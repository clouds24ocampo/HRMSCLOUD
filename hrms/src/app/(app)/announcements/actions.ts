"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import type { FormState } from "@/app/login/actions";

const done = () => {
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
};

export async function postAnnouncement(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/announcements"); // HR only
  const parsed = z.object({ title: z.string().trim().min(3, "Give it a title.").max(100), body: z.string().trim().min(5, "Write the message.").max(3000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const a = await prisma.announcement.create({ data: { organizationId: me.organizationId, ...parsed.data, pinned: form.get("pinned") === "on", createdById: me.id } });
  await audit(me.id, "announcement.posted", "Announcement", a.id, { title: a.title }, me.organizationId);
  const everyone = await prisma.user.findMany({ where: { organizationId: me.organizationId, active: true }, select: { id: true } });
  await notify(me.organizationId, everyone.map((u) => u.id), { title: `Announcement: ${a.title}`, href: "/dashboard" }, me.id);
  done();
  return { ok: "Posted. Everyone was notified and it shows on their Home page." };
}

export async function archiveAnnouncement(id: string) {
  const me = await requireUser("/announcements");
  const a = await prisma.announcement.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!a) return;
  await prisma.announcement.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(me.id, "announcement.archived", "Announcement", id, { title: a.title }, me.organizationId);
  done();
}
