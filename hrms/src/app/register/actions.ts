"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { createSession } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/auth";
import { isValidChoice } from "@/lib/industries";
import { ROLES } from "@/lib/roles";
import { createEmployee } from "@/lib/employees";
import { dbDate, dayKey } from "@/lib/time";
import { isLimited, recordHit } from "@/lib/rate-limit";
import { DB_DOWN_MESSAGE, isDbDown } from "@/lib/db-health";
import type { FormState } from "@/app/login/actions";

const schema = z
  .object({
    categoryKey: z.string(),
    industryKey: z.string(),
    sizeKey: z.string(),
    orgName: z.string().trim().min(2, "Enter the organization name."),
    adminName: z.string().trim().min(2, "Enter your full name."),
    email: z.email("Enter a valid email."),
    password: z.string().min(10, "Password needs at least 10 characters."),
    confirm: z.string(),
  })
  .refine((d) => isValidChoice(d.categoryKey, d.industryKey, d.sizeKey), {
    message: "Go back and choose your industry and size.",
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match." });

export async function registerOrganization(prev: FormState, form: FormData): Promise<FormState> {
  try {
    return await registerInner(prev, form);
  } catch (e) {
    if (isDbDown(e)) return { error: DB_DOWN_MESSAGE };
    throw e; // includes the redirect after a successful registration
  }
}

async function registerInner(_: FormState, form: FormData): Promise<FormState> {
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  const limitKey = `register:${ip}`;
  const max = Number(process.env.REGISTER_LIMIT_PER_HOUR ?? 10);
  if (isLimited(limitKey, max)) return { error: "Too many registrations. Try again later." };

  const parsed = schema.safeParse({
    categoryKey: form.get("categoryKey"),
    industryKey: form.get("industryKey"),
    sizeKey: form.get("sizeKey"),
    orgName: form.get("orgName"),
    adminName: form.get("adminName"),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    password: form.get("password"),
    confirm: form.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (await prisma.user.findUnique({ where: { email: d.email } })) {
    return { error: "This email is already registered. Sign in instead." };
  }
  const role = await prisma.role.findUnique({ where: { key: ROLES.SUPER_ADMIN } });
  if (!role) return { error: "System is not set up yet. Run the database seed." };

  // Organization and its first Super Admin are created together or not at all.
  const { org, user } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: d.orgName, categoryKey: d.categoryKey, industryKey: d.industryKey, sizeKey: d.sizeKey },
    });
    const user = await tx.user.create({
      data: {
        organizationId: org.id,
        name: d.adminName,
        email: d.email,
        passwordHash: await bcrypt.hash(d.password, 12),
        roleId: role.id,
      },
    });
    const [firstName, ...rest] = d.adminName.trim().split(/\s+/);
    await createEmployee(tx, org.id, user.id, {
      firstName,
      lastName: rest.join(" ") || "-",
      employeeNo: "superadmin001",
      email: d.email,
      hireDate: dbDate(dayKey(new Date(), "Asia/Manila")),
      userId: user.id,
    }, { checklist: false });
    return { org, user };
  });
  recordHit(limitKey, 60 * 60_000); // only successful registrations count
  await audit(user.id, "organization.registered", "Organization", org.id, { name: org.name }, org.id);

  const { token, expiresAt } = await createSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  redirect("/dashboard");
}
