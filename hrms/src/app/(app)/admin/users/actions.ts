"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import type { FormState } from "@/app/login/actions";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the full name."),
  email: z.email("Enter a valid email."),
  roleId: z.string().min(1, "Choose a role."),
  password: z.string().min(10, "Temporary password needs at least 10 characters."),
});

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireUser("/admin/users"); // server-side check; hiding the page is not security
  const parsed = schema.safeParse({
    name: form.get("name"),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    roleId: form.get("roleId"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { password, ...data } = parsed.data;

  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    return { error: "A user with this email already exists." };
  }
  if (!(await prisma.role.findUnique({ where: { id: data.roleId } }))) return { error: "Choose a role." };

  const user = await prisma.user.create({
    data: { ...data, organizationId: actor.organizationId, mustChangePassword: true, passwordHash: await bcrypt.hash(password, 12) },
  });
  await audit(actor.id, "user.created", "User", user.id, { email: user.email, roleId: user.roleId }, actor.organizationId);
  revalidatePath("/admin/users");
  return { ok: `${user.name} can now sign in.` };
}

// The target must be in the same organization. Returns it, or a message.
async function target(actorOrg: string, id: string) {
  return prisma.user.findFirst({ where: { id, organizationId: actorOrg }, include: { role: true } });
}

const otherSuperAdmins = (orgId: string, exceptId: string) =>
  prisma.user.count({ where: { organizationId: orgId, active: true, id: { not: exceptId }, role: { key: ROLES.SUPER_ADMIN } } });

// Someone forgot their password: set a new temporary one. They must choose their own at the next sign-in.
export async function resetUserPassword(userId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/admin/users");
  const pw = z.string().min(10, "Temporary password needs at least 10 characters.").safeParse(form.get("password"));
  if (!pw.success) return { error: pw.error.issues[0].message };
  const t = await target(me.organizationId, userId);
  if (!t) return { error: "User not found." };
  if (t.id === me.id) return { error: "Use Change password for your own account." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: t.id }, data: { passwordHash: await bcrypt.hash(pw.data, 12), mustChangePassword: true } }),
    prisma.session.deleteMany({ where: { userId: t.id } }), // signed out everywhere
  ]);
  await audit(me.id, "user.password_reset", "User", t.id, { email: t.email }, me.organizationId);
  revalidatePath("/admin/users");
  return { ok: `New temporary password set for ${t.name}. Give it to them in person.` };
}

export async function setUserActive(userId: string, active: boolean): Promise<FormState> {
  const me = await requireUser("/admin/users");
  const t = await target(me.organizationId, userId);
  if (!t) return { error: "User not found." };
  if (t.id === me.id) return { error: "You cannot deactivate your own account." };
  if (!active && t.role.key === ROLES.SUPER_ADMIN && (await otherSuperAdmins(me.organizationId, t.id)) === 0) {
    return { error: "This is the only active Super Admin. Make someone else a Super Admin first." };
  }
  await prisma.user.update({ where: { id: t.id }, data: { active } });
  if (!active) await prisma.session.deleteMany({ where: { userId: t.id } });
  await audit(me.id, active ? "user.activated" : "user.deactivated", "User", t.id, { email: t.email }, me.organizationId);
  revalidatePath("/admin/users");
  return { ok: active ? `${t.name} can sign in again.` : `${t.name} can no longer sign in.` };
}

export async function changeUserRole(userId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/admin/users");
  const roleId = z.string().min(1, "Choose a role.").safeParse(form.get("roleId"));
  if (!roleId.success) return { error: roleId.error.issues[0].message };
  const [t, role] = await Promise.all([target(me.organizationId, userId), prisma.role.findUnique({ where: { id: roleId.data } })]);
  if (!t || !role) return { error: "User or role not found." };
  if (t.id === me.id) return { error: "You cannot change your own role." };
  if (role.id === t.roleId) return { ok: "Nothing changed." };
  if (t.role.key === ROLES.SUPER_ADMIN && role.key !== ROLES.SUPER_ADMIN && (await otherSuperAdmins(me.organizationId, t.id)) === 0) {
    return { error: "This is the only active Super Admin. Make someone else a Super Admin first." };
  }
  await prisma.user.update({ where: { id: t.id }, data: { roleId: role.id } });
  await prisma.session.deleteMany({ where: { userId: t.id } }); // the new role applies at the next sign-in
  await audit(me.id, "user.role_changed", "User", t.id, { from: t.role.key, to: role.key }, me.organizationId);
  revalidatePath("/admin/users");
  return { ok: `${t.name} is now ${role.name}. They must sign in again.` };
}
