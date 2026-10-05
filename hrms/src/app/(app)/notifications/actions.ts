"use server";

import { revalidatePath } from "next/cache";
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
