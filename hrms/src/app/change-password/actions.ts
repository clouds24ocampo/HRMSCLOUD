"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser, SESSION_COOKIE } from "@/lib/auth";
import { deleteOtherSessions } from "@/lib/session";
import { clearAttempts, tooManyAttempts } from "@/lib/rate-limit";
import type { FormState } from "@/app/login/actions";

const schema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(10, "New password needs at least 10 characters."),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "New passwords do not match." })
  .refine((d) => d.next !== d.current, { message: "Choose a password you have not used just now." });

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/change-password");
  const parsed = schema.safeParse({ current: form.get("current"), next: form.get("next"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const key = `pwchange:${user.id}`;
  if (tooManyAttempts(key)) return { error: "Too many attempts. Try again in 15 minutes." };
  if (!(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: "Current password is wrong." };
  }
  clearAttempts(key);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 12), mustChangePassword: false },
  });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await deleteOtherSessions(user.id, token);
  await audit(user.id, "password.changed", "User", user.id, undefined, user.organizationId);
  redirect("/dashboard");
}
