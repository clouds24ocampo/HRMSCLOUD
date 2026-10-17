"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { DEPT_BOUND_LEVELS } from "@/lib/defaults";
import type { FormState } from "@/app/login/actions";

const LEVELS = ["ENTRY", "TEAM_LEAD", "MANAGER", "ASSISTANT_HEAD", "DEPT_HEAD", "EXECUTIVE"] as const;
const headOf = (level: string) => (DEPT_BOUND_LEVELS as readonly string[]).includes(level);
const name = z.string().trim().min(2, "Enter a name of at least 2 letters.").max(80);
const done = () => revalidatePath("/organization");

export async function addDepartment(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/organization");
  const parsed = z.object({ name, parentId: z.string().optional() }).safeParse({ name: form.get("name"), parentId: form.get("parentId") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { parentId } = parsed.data;
  if (parentId && !(await prisma.department.findFirst({ where: { id: parentId, organizationId: me.organizationId, archivedAt: null } }))) {
    return { error: "Choose a parent from the list." };
  }
  if (await prisma.department.findUnique({ where: { organizationId_name: { organizationId: me.organizationId, name: parsed.data.name } } })) {
    return { error: "A department with this name already exists." };
  }
  const d = await prisma.department.create({ data: { organizationId: me.organizationId, name: parsed.data.name, parentId } });
  await audit(me.id, "department.created", "Department", d.id, { name: d.name }, me.organizationId);
  done();
  return { ok: `${d.name} added.` };
}

export async function addSuggestedDepartments(names: string[]): Promise<FormState> {
  const me = await requireUser("/organization");
  const list = z.array(name).max(20).safeParse(names);
  if (!list.success) return { error: "Invalid suggestion." };
  const res = await prisma.department.createMany({
    data: list.data.map((n) => ({ organizationId: me.organizationId, name: n })),
    skipDuplicates: true,
  });
  await audit(me.id, "department.suggested_added", "Department", undefined, { names: list.data }, me.organizationId);
  done();
  return { ok: res.count ? `${res.count} department${res.count > 1 ? "s" : ""} added.` : "Those departments already exist." };
}

export async function setDepartmentArchived(id: string, archived: boolean) {
  const me = await requireUser("/organization");
  const d = await prisma.department.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!d) return;
  await prisma.department.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(me.id, archived ? "department.archived" : "department.restored", "Department", id, { name: d.name }, me.organizationId);
  done();
}

export async function addPosition(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/organization");
  const parsed = z
    .object({ title: name, level: z.enum(LEVELS), departmentId: z.string().optional() })
    .safeParse({ title: form.get("title"), level: form.get("level"), departmentId: form.get("departmentId") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { departmentId } = parsed.data;
  if (headOf(parsed.data.level) && !departmentId) return { error: `Choose which department this ${parsed.data.level === "DEPT_HEAD" ? "head" : "assistant head"} leads.` };
  if (departmentId && !(await prisma.department.findFirst({ where: { id: departmentId, organizationId: me.organizationId, archivedAt: null } }))) {
    return { error: "Choose a department from the list." };
  }
  const p = await prisma.position.create({ data: { organizationId: me.organizationId, ...parsed.data } });
  await audit(me.id, "position.created", "Position", p.id, { title: p.title, level: p.level }, me.organizationId);
  done();
  return { ok: `${p.title} added.` };
}

export async function addSuggestedPositions(items: { title: string; level: string; department?: string }[]): Promise<FormState> {
  const me = await requireUser("/organization");
  const list = z.array(z.object({ title: name, level: z.enum(LEVELS), department: name.optional() })).max(20).safeParse(items);
  if (!list.success) return { error: "Invalid suggestion." };
  if (list.data.some((p) => headOf(p.level) && !p.department)) return { error: "A head position needs its department. Add it with the form." };
  const existing = new Set((await prisma.position.findMany({ where: { organizationId: me.organizationId }, select: { title: true } })).map((p) => p.title));
  const fresh = list.data.filter((p) => !existing.has(p.title));
  // A suggestion that names its department creates that department when it does not exist yet.
  const deptId = new Map<string, string>();
  for (const n of new Set(fresh.map((p) => p.department).filter((d): d is string => !!d))) {
    const d = await prisma.department.upsert({ where: { organizationId_name: { organizationId: me.organizationId, name: n } }, update: { archivedAt: null }, create: { organizationId: me.organizationId, name: n } });
    deptId.set(n, d.id);
  }
  if (fresh.length) await prisma.position.createMany({ data: fresh.map((p) => ({ title: p.title, level: p.level, departmentId: p.department ? deptId.get(p.department) : null, organizationId: me.organizationId })) });
  await audit(me.id, "position.suggested_added", "Position", undefined, { titles: fresh.map((p) => p.title) }, me.organizationId);
  done();
  return { ok: fresh.length ? `${fresh.length} position${fresh.length > 1 ? "s" : ""} added.` : "Those positions already exist." };
}

export async function setPositionArchived(id: string, archived: boolean) {
  const me = await requireUser("/organization");
  const p = await prisma.position.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!p) return;
  await prisma.position.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(me.id, archived ? "position.archived" : "position.restored", "Position", id, { title: p.title }, me.organizationId);
  done();
}
