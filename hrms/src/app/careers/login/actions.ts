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
import { DB_DOWN_MESSAGE, isDbDown } from "@/lib/db-health";
import type { FormState } from "@/app/login/actions";

// Same dummy hash as the staff sign-in: time stays the same when the email is unknown.
const DUMMY_HASH = "$2b$12$.8/s7sFJBbRqj2ALc2LmZOUc5Gee/y.W2KgmsEwT0Uf259A/eA1FW";
const WRONG = "Wrong email or password.";

export async function loginApplicant(prev: FormState, form: FormData): Promise<FormState> {
  try {
    return await inner(prev, form);
  } catch (e) {
    if (isDbDown(e)) return { error: DB_DOWN_MESSAGE };
    throw e; // includes the redirect after a successful sign-in
  }
}

async function inner(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.email(), password: z.string().min(1) }).safeParse({ email: String(form.get("email") ?? "").trim().toLowerCase(), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and your password." };
  const { email, password } = parsed.data;
  if (tooManyAttempts(`applicant-login:${email}`)) return { error: "Too many attempts. Try again in 15 minutes." };

  const user = await prisma.user.findUnique({ where: { email }, include: { role: { select: { key: true } } } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  // Staff accounts are refused here without a hint that they exist: the staff sign-in is the place for them.
  if (!user || !valid || !user.active || user.role.key !== "APPLICANT") {
    if (user?.role.key === "APPLICANT") await audit(user.id, "portal.login_failed", "User", user.id, undefined, user.organizationId);
    return { error: WRONG };
  }

  clearAttempts(`applicant-login:${email}`);
  const { token, expiresAt } = await createSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isCookieSecure(), path: "/", expires: expiresAt });
  await audit(user.id, "portal.login", "User", user.id, undefined, user.organizationId);
  redirect("/apply");
}

export async function logoutApplicant() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  jar.delete(SESSION_COOKIE);
  redirect("/careers");
}
