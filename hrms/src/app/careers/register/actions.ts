"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { createSession } from "@/lib/session";
import { isCookieSecure, SESSION_COOKIE } from "@/lib/auth";
import { careersOrg } from "@/lib/applicants";
import { nextEmployeeNo } from "@/lib/employees";
import { ROLES, ROLE_SEED } from "@/lib/roles";
import { isLimited, recordHit } from "@/lib/rate-limit";
import { config } from "@/lib/config";
import { DB_DOWN_MESSAGE, isDbDown } from "@/lib/db-health";
import type { FormState } from "@/app/login/actions";

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    email: z.email("Enter a valid email."),
    phone: z.string().trim().max(30).optional(),
    password: z.string().min(10, "Password needs at least 10 characters."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match." });

export async function registerApplicant(prev: FormState, form: FormData): Promise<FormState> {
  try {
    return await inner(prev, form);
  } catch (e) {
    if (isDbDown(e)) return { error: DB_DOWN_MESSAGE };
    throw e; // includes the redirect after a successful sign-up
  }
}

async function inner(_: FormState, form: FormData): Promise<FormState> {
  const limitKey = `applicant:${(await headers()).get("x-forwarded-for") ?? "local"}`;
  if (isLimited(limitKey, config.applicantLimitPerHour)) return { error: "Too many sign-ups. Try again later." };
  const parsed = schema.safeParse({
    name: form.get("name"), email: String(form.get("email") ?? "").trim().toLowerCase(), phone: form.get("phone") || undefined,
    password: form.get("password"), confirm: form.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const org = await careersOrg();
  if (!org) return { error: "Applications are not open yet." };
  if (await prisma.user.findUnique({ where: { email: d.email } })) return { error: "This email already has an account. Sign in instead." };
  const seed = ROLE_SEED.find((r) => r.key === ROLES.APPLICANT)!;
  const role = await prisma.role.upsert({ where: { key: seed.key }, update: {}, create: seed }); // older databases may not have it yet
  const wanted = form.getAll("jobId").map(String);
  const jobs = wanted.length ? await prisma.jobPosting.findMany({ where: { id: { in: wanted }, organizationId: org.id, status: "OPEN" } }) : [];
  const passwordHash = await bcrypt.hash(d.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7302)`; // two sign-ups must not draw the same applicant number
    const u = await tx.user.create({ data: { organizationId: org.id, name: d.name, email: d.email, passwordHash, roleId: role.id } });
    const profile = await tx.applicantProfile.create({ data: { organizationId: org.id, userId: u.id, applicantNo: await nextEmployeeNo(tx, org.id), phone: d.phone } });
    if (jobs.length) await tx.applicant.createMany({ data: jobs.map((j) => ({ organizationId: org.id, jobId: j.id, profileId: profile.id, name: d.name, email: d.email, phone: d.phone, source: "Careers page" })) });
    return u;
  });
  recordHit(limitKey, 60 * 60_000);
  await audit(user.id, "portal.registered", "User", user.id, jobs.length ? { jobs: jobs.map((j) => j.title) } : undefined, org.id);

  const { token, expiresAt } = await createSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isCookieSecure(), path: "/", expires: expiresAt });
  redirect("/apply");
}
