"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { checkRoleChoice, levelOfUser } from "@/lib/access";
import { GRANTABLE, effectivePerms, isPerm, rolePerms, type Perm } from "@/lib/permissions";
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
  const choice = await checkRoleChoice(actor, data.roleId);
  if ("error" in choice) return { error: choice.error };

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
  const t = await target(me.organizationId, userId);
  if (!t) return { error: "User not found." };
  if (t.id === me.id) return { error: "You cannot change your own role." };
  const choice = await checkRoleChoice(me, roleId.data, { level: await levelOfUser(t.id, me.organizationId) });
  if ("error" in choice) return { error: choice.error };
  const role = choice.role;
  if (role.id === t.roleId) return { ok: "Nothing changed." };
  if (t.role.key === ROLES.SUPER_ADMIN && role.key !== ROLES.SUPER_ADMIN && (await otherSuperAdmins(me.organizationId, t.id)) === 0) {
    return { error: "This is the only active Super Admin. Make someone else a Super Admin first." };
  }
  await prisma.user.update({ where: { id: t.id }, data: { roleId: role.id, grants: [], revokes: [] } }); // a new role starts clean: personal changes were made against the old one
  await prisma.session.deleteMany({ where: { userId: t.id } }); // the new role applies at the next sign-in
  await audit(me.id, "user.role_changed", "User", t.id, { from: t.role.key, to: role.key }, me.organizationId);
  revalidatePath("/admin/users");
  return { ok: `${t.name} is now ${role.name}. They must sign in again.` };
}

// Role and personal access in one save. `perms` is the full list the person should end up with; what differs from the role becomes an
// extra (added) or a removal for this account only. The Super Admin role is fixed and cannot be edited here.
export async function saveAccess(userId: string, roleId: string, perms: string[], note: string): Promise<FormState> {
  const me = await requireUser("/admin/users");
  const t = await target(me.organizationId, userId);
  if (!t) return { error: "User not found." };
  if (t.id === me.id) return { error: "You cannot change your own access. Ask another Super Admin." };
  const want = new Set(perms.filter((p): p is Perm => isPerm(p) && GRANTABLE.includes(p as Perm)));
  const level = await levelOfUser(t.id, me.organizationId);
  const first = await checkRoleChoice(me, roleId, { level });
  if ("error" in first) return { error: first.error };
  const role = first.role;
  const base = new Set(rolePerms(role));
  const grants = role.key === ROLES.SUPER_ADMIN ? [] : [...want].filter((p) => !base.has(p));
  const revokes = role.key === ROLES.SUPER_ADMIN ? [] : [...base].filter((p) => !want.has(p));
  // Nobody can give access they do not hold themselves (a Super Admin holds everything).
  if (me.role.key !== ROLES.SUPER_ADMIN && grants.some((g) => !me.perms.has(g))) return { error: "You cannot give access you do not have yourself." };
  const final = effectivePerms(role, grants, revokes);
  const check = await checkRoleChoice(me, roleId, { level, grants, revokes });
  if ("error" in check) return { error: check.error };
  if (t.role.key === ROLES.SUPER_ADMIN && role.key !== ROLES.SUPER_ADMIN && (await otherSuperAdmins(me.organizationId, t.id)) === 0) {
    return { error: "This is the only active Super Admin. Make someone else a Super Admin first." };
  }
  const before = effectivePerms(t.role, t.grants, t.revokes);
  await prisma.user.update({ where: { id: t.id }, data: { roleId: role.id, grants, revokes } });
  await prisma.session.deleteMany({ where: { userId: t.id } }); // the new access applies at the next sign-in
  const added = [...final].filter((p) => !before.has(p));
  const removed = [...before].filter((p) => !final.has(p));
  await audit(me.id, "user.access_changed", "User", t.id, { role: { from: t.role.key, to: role.key }, grants, revokes, added, removed, note: note.slice(0, 300) || undefined }, me.organizationId);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${t.id}/access`);
  return { ok: `${t.name}: ${final.size} permission${final.size === 1 ? "" : "s"} (${added.length} added, ${removed.length} removed). They must sign in again.` };
}
