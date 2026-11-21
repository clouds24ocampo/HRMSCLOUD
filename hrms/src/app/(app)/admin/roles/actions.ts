"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { GRANTABLE, ROLE_TEMPLATES, effectivePerms, entryLevelProblem, isBuiltInRole, isPerm, rolePerms, type Perm } from "@/lib/permissions";
import type { FormState } from "@/app/login/actions";

const nameSchema = z.string().trim().min(2, "Give the role a name of at least 2 letters.").max(60, "Keep the name under 60 characters.");
const cleanPerms = (list: readonly string[]) => [...new Set(list)].filter((p): p is Perm => isPerm(p) && GRANTABLE.includes(p as Perm));

async function nameTaken(orgId: string, name: string, exceptId?: string) {
  const roles = await prisma.role.findMany({ where: { OR: [{ organizationId: null }, { organizationId: orgId }], ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { name: true } });
  return roles.some((r) => r.name.trim().toLowerCase() === name.toLowerCase());
}

// A new company role: from scratch, copied from any role you can see, or from a ready-made template.
export async function createRole(_: FormState, form: FormData): Promise<FormState & { id?: string }> {
  const me = await requireUser("/admin/roles");
  const name = nameSchema.safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  const description = String(form.get("description") ?? "").trim().slice(0, 300) || null;
  const from = String(form.get("from") ?? "");
  let perms: Perm[] = [];
  if (from.startsWith("template:")) {
    const t = ROLE_TEMPLATES.find((x) => x.name === from.slice(9));
    if (!t) return { error: "Choose a template from the list." };
    perms = t.perms;
  } else if (from.startsWith("role:")) {
    const r = await prisma.role.findFirst({ where: { id: from.slice(5), key: { not: "APPLICANT" }, OR: [{ organizationId: null }, { organizationId: me.organizationId }] } });
    if (!r) return { error: "Choose a role from the list." };
    perms = rolePerms(r).filter((p) => GRANTABLE.includes(p));
  }
  if (await nameTaken(me.organizationId, name.data)) return { error: "A role with this name already exists." };
  const role = await prisma.role.create({
    data: { key: `CUSTOM_${randomUUID().replace(/-/g, "").slice(0, 12)}`, name: name.data, description, organizationId: me.organizationId, permissions: perms },
  });
  await audit(me.id, "role.created", "Role", role.id, { name: role.name, from: from || "blank", permissions: perms.length }, me.organizationId);
  revalidatePath("/admin/roles");
  return { ok: `Role “${role.name}” created. Choose what it can do.`, id: role.id };
}

// Edit a company role. Everyone holding it gets the change at their next sign-in.
export async function saveRole(roleId: string, name: string, description: string, perms: string[]): Promise<FormState> {
  const me = await requireUser("/admin/roles");
  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId: me.organizationId } });
  if (!role || isBuiltInRole(role.key)) return { error: "Only your company's own roles can be edited." };
  const n = nameSchema.safeParse(name);
  if (!n.success) return { error: n.error.issues[0].message };
  if (await nameTaken(me.organizationId, n.data, role.id)) return { error: "A role with this name already exists." };
  const next = cleanPerms(perms);
  // A role that gives manager or higher access cannot sit on an entry-level position.
  const holders = await prisma.user.findMany({
    where: { organizationId: me.organizationId, roleId: role.id },
    select: { id: true, name: true, grants: true, revokes: true, employee: { select: { position: { select: { level: true } } } } },
  });
  for (const h of holders) {
    const problem = entryLevelProblem(h.employee?.position?.level, effectivePerms({ key: role.key, permissions: next }, h.grants, h.revokes));
    if (problem) return { error: `${h.name} holds an entry-level position. ${problem.replace(/^This person holds an entry-level position, and /, "").replace(/^entry-level/, "Entry-level")}` };
  }
  await prisma.role.update({ where: { id: role.id }, data: { name: n.data, description: description.trim().slice(0, 300) || null, permissions: next } });
  if (holders.length) await prisma.session.deleteMany({ where: { userId: { in: holders.map((h) => h.id) } } });
  const before = new Set(role.permissions);
  await audit(me.id, "role.changed", "Role", role.id, { name: n.data, added: next.filter((p) => !before.has(p)), removed: [...before].filter((p) => !next.includes(p as Perm)), people: holders.length }, me.organizationId);
  revalidatePath("/admin/roles");
  revalidatePath(`/admin/roles/${role.id}`);
  return { ok: `Saved. ${holders.length ? `${holders.length} ${holders.length === 1 ? "person" : "people"} must sign in again to get the change.` : "Nobody holds this role yet."}` };
}

// Only a role nobody holds can be deleted, so nobody loses their access by surprise.
export async function deleteRole(roleId: string): Promise<FormState> {
  const me = await requireUser("/admin/roles");
  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId: me.organizationId }, include: { _count: { select: { users: true } } } });
  if (!role || isBuiltInRole(role.key)) return { error: "Only your company's own roles can be deleted." };
  if (role._count.users) return { error: `${role._count.users} ${role._count.users === 1 ? "person holds" : "people hold"} this role. Give them another role first.` };
  await prisma.role.delete({ where: { id: role.id } });
  await audit(me.id, "role.deleted", "Role", role.id, { name: role.name }, me.organizationId);
  revalidatePath("/admin/roles");
  return { ok: "Role deleted." };
}
