"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { createSession, deleteSession } from "@/lib/session";
import { isCookieSecure, SESSION_COOKIE } from "@/lib/auth";
import { clearAttempts, tooManyAttempts } from "@/lib/rate-limit";
import { homeFor } from "@/lib/roles";
import { DB_DOWN_MESSAGE, isDbDown } from "@/lib/db-health";

export type FormState = { error?: string; ok?: string } | undefined;

// The sign-in name is an email, or the username HR gave the person. Both are stored lowercase.
const schema = z.object({ email: z.union([z.email(), z.string().regex(/^[a-z0-9._-]{3,30}$/)]), password: z.string().min(1) });
// Compared when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = "$2b$12$.8/s7sFJBbRqj2ALc2LmZOUc5Gee/y.W2KgmsEwT0Uf259A/eA1FW";

export async function login(prev: FormState, form: FormData): Promise<FormState> {
  try {
    return await loginInner(prev, form);
  } catch (e) {
    if (isDbDown(e)) return { error: DB_DOWN_MESSAGE };
    throw e; // includes the redirect after a successful sign-in
  }
}

async function loginInner(_: FormState, form: FormData): Promise<FormState> {
  const parsed = schema.safeParse({
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Enter your email or username, and your password." };
  const { email, password } = parsed.data;

  if (tooManyAttempts(email)) return { error: "Too many attempts. Try again in 15 minutes." };

  const user = await prisma.user.findUnique({ where: email.includes("@") ? { email } : { username: email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || !user.active) {
    await audit(user?.id ?? null, "login.failed", "User", user?.id, { email }, user?.organizationId);
    return { error: "Wrong email, username or password." };
  }

  // Applicants have their own sign-in on the careers page. Checked after the password, so this never reveals who has an account.
  const kind = await prisma.role.findUnique({ where: { id: user.roleId }, select: { key: true } });
  if (kind?.key === "APPLICANT") return { error: "This sign-in is for staff. Applicants sign in on the careers page." };

  clearAttempts(email);
  const { token, expiresAt } = await createSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isCookieSecure(),
    path: "/",
    expires: expiresAt,
  });
  await audit(user.id, "login.success", "User", user.id, undefined, user.organizationId);
  const role = await prisma.role.findUnique({ where: { id: user.roleId }, select: { key: true } });
  redirect(user.mustChangePassword ? "/change-password" : homeFor(role?.key ?? ""));
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
