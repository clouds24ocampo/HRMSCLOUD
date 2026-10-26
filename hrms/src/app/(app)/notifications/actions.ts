"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function markAllRead() {
  const me = await requireUser("/notifications");
  await prisma.notification.updateMany({ where: { userId: me.id, organizationId: me.organizationId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markRead(id: string) {
  const me = await requireUser("/notifications");
  await prisma.notification.updateMany({ where: { id, userId: me.id, organizationId: me.organizationId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

// "Open" reads the notification and goes where it points. Only paths inside the app are followed.
export async function openNotification(id: string) {
  const me = await requireUser("/notifications");
  const n = await prisma.notification.findFirst({ where: { id, userId: me.id, organizationId: me.organizationId }, select: { href: true, readAt: true } });
  if (!n) redirect("/notifications");
  if (!n.readAt) {
    await prisma.notification.updateMany({ where: { id, userId: me.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/", "layout");
  }
  redirect(n.href && /^\/(?!\/)/.test(n.href) ? n.href : "/notifications");
}
