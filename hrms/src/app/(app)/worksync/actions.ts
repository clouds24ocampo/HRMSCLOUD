"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { notify } from "@/lib/notify";
import { employeeScope, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { dbDate } from "@/lib/time";
import { loadProject, logActivity, personName } from "@/lib/worksync-data";
import { CATEGORY_LABEL, DEFAULT_LABELS, LABEL_COLORS, positionBetween, TEMPLATES, WS_THEMES, type Level } from "@/lib/worksync";
import type { FormState } from "@/app/login/actions";

const PATH = "/worksync";
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const optDay = z.string().trim().optional().transform((v) => v || null).pipe(day.nullable());
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const RANK: Record<Level, number> = { VIEW: 0, EDIT: 1, MANAGE: 2 };

// Everything below starts here: who is asking, which project the thing belongs to, and what they may do with it.
// A card id or project id outside the person's reach looks exactly like one that does not exist.
async function projectCtx(projectId: string, need: Level) {
  const me = await requireUser(PATH);
  const mine = await getMyEmployee(me);
  const loaded = await loadProject(me, mine.id, projectId);
  if (!loaded) return { ok: false as const, error: "Project not found." };
  if (RANK[loaded.level] < RANK[need]) return { ok: false as const, error: need === "MANAGE" ? "Only a project lead or HR can do this." : "You have view-only access to this project." };
  return { ok: true as const, me, mine, ...loaded };
}

async function cardCtx(cardId: string, need: Level) {
  const me = await requireUser(PATH);
  const card = await prisma.wsCard.findFirst({ where: { id: cardId, organizationId: me.organizationId, archivedAt: null }, include: { list: true } });
  if (!card) return { ok: false as const, error: "Card not found." };
  const ctx = await projectCtx(card.projectId, need);
  return ctx.ok ? { ...ctx, card } : ctx;
}

type CardOk = Extract<Awaited<ReturnType<typeof cardCtx>>, { ok: true }>;

const refresh = (projectId: string) => {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${projectId}`);
};

const leadUserIds = (members: { role: string; employee: { userId: string | null } }[]) =>
  members.filter((m) => m.role === "LEAD").map((m) => m.employee.userId).filter((u): u is string => !!u);

// ───────────── projects ─────────────

export async function createProject(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser(PATH);
  if (!isHr(me.role.key) && me.role.key !== ROLES.MANAGER) return { error: "Only HR and managers can start a project." };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Give the project a name.").max(120),
      kind: z.enum(["PROGRAMMING", "NETWORK", "OTHER"]),
      color: z.enum(Object.keys(WS_THEMES) as [string, ...string[]]).default("indigo"),
      description: optText(2000),
      dueDate: optDay,
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const mine = await getMyEmployee(me);
  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.wsProject.create({
      data: {
        organizationId: me.organizationId,
        name: d.name,
        kind: d.kind,
        description: d.description,
        dueDate: d.dueDate ? dbDate(d.dueDate) : null,
        color: d.color,
        createdById: me.id,
        labels: { create: DEFAULT_LABELS[d.kind] },
        lists: { create: TEMPLATES[d.kind].map((l, position) => ({ ...l, position })) },
        members: { create: { employeeId: mine.id, role: "LEAD" } },
      },
    });
    await logActivity(tx, { organizationId: me.organizationId, projectId: p.id, actorId: me.id, type: "PROJECT_CREATED", detail: d.name });
    return p;
  });
  await audit(me.id, "worksync.project_created", "WsProject", project.id, { name: d.name }, me.organizationId);
  revalidatePath(PATH);
  redirect(`${PATH}/${project.id}`);
}

export async function archiveProject(projectId: string) {
  const c = await projectCtx(projectId, "MANAGE");
  if (!c.ok) return;
  await prisma.wsProject.update({ where: { id: projectId }, data: { archivedAt: new Date() } });
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId, actorId: c.me.id, type: "PROJECT_ARCHIVED" });
  await audit(c.me.id, "worksync.project_archived", "WsProject", projectId, undefined, c.me.organizationId);
  revalidatePath(PATH);
  redirect(PATH);
}

// ───────────── members ─────────────

export async function addMember(projectId: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await projectCtx(projectId, "MANAGE");
  if (!c.ok) return { error: c.error };
  const parsed = z.object({ employeeId: z.string().min(1, "Pick a person."), role: z.enum(["LEAD", "MEMBER", "VIEWER"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // A manager can only add people in their own chain; HR can add anyone in the organization.
  const person = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, ...(await employeeScope(c.me, c.mine.id)), status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: { id: true, firstName: true, lastName: true, userId: true },
  });
  if (!person) return { error: "Person not found." };
  if (c.project.members.some((m) => m.employeeId === person.id)) return { error: "Already on this project." };
  await prisma.wsMember.create({ data: { projectId, employeeId: person.id, role: parsed.data.role } });
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId, actorId: c.me.id, type: "MEMBER_ADDED", detail: `${personName(person)} (${parsed.data.role.toLowerCase()})` });
  await audit(c.me.id, "worksync.member_added", "WsProject", projectId, { employeeId: person.id, role: parsed.data.role }, c.me.organizationId);
  if (person.userId) await notify(c.me.organizationId, [person.userId], { title: `You were added to the project "${c.project.name}"`, href: `${PATH}/${projectId}` }, c.me.id);
  refresh(projectId);
  return { ok: `${personName(person)} added.` };
}

export async function removeMember(projectId: string, employeeId: string) {
  const c = await projectCtx(projectId, "MANAGE");
  if (!c.ok) return;
  const target = c.project.members.find((m) => m.employeeId === employeeId);
  if (!target) return;
  const leads = c.project.members.filter((m) => m.role === "LEAD");
  if (target.role === "LEAD" && leads.length === 1 && !isHr(c.me.role.key)) return; // a project never loses its last lead, except by HR
  await prisma.$transaction([
    prisma.wsAssignee.deleteMany({ where: { employeeId, card: { projectId } } }),
    prisma.wsMember.delete({ where: { id: target.id } }),
  ]);
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId, actorId: c.me.id, type: "MEMBER_REMOVED", detail: personName(target.employee) });
  await audit(c.me.id, "worksync.member_removed", "WsProject", projectId, { employeeId }, c.me.organizationId);
  refresh(projectId);
}

// ───────────── cards ─────────────

export async function createCard(projectId: string, listId: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await projectCtx(projectId, "EDIT");
  if (!c.ok) return { error: c.error };
  const title = z.string().trim().min(1, "Write a title.").max(200).safeParse(form.get("title"));
  if (!title.success) return { error: title.error.issues[0].message };
  const list = c.project.lists.find((l) => l.id === listId);
  if (!list) return { error: "List not found." };
  const last = await prisma.wsCard.findFirst({ where: { listId, archivedAt: null }, orderBy: { position: "desc" }, select: { position: true } });
  const dueStr = form.get("dueDate");
  const dueDate = typeof dueStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueStr) ? dbDate(dueStr) : null;
  const startStr = form.get("startDate");
  const startDate = typeof startStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startStr) ? dbDate(startStr) : null;
  const card = await prisma.wsCard.create({
    data: {
      organizationId: c.me.organizationId,
      projectId,
      listId,
      title: title.data,
      position: positionBetween(last?.position ?? null, null),
      createdById: c.me.id,
      completedAt: list.category === "DONE" ? new Date() : null,
      completedById: list.category === "DONE" ? c.me.id : null,
      dueDate,
      startDate,
    },
  });
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId, cardId: card.id, cardTitle: card.title, actorId: c.me.id, type: "CARD_CREATED", detail: list.name });
  refresh(projectId);
  return { ok: "Card added." };
}

export async function updateCard(cardId: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await cardCtx(cardId, "EDIT");
  if (!c.ok) return { error: c.error };
  const parsed = z
    .object({ title: z.string().trim().min(1, "Write a title.").max(200), description: optText(50000), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]), startDate: optDay, dueDate: optDay })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.startDate && d.dueDate && d.startDate > d.dueDate) return { error: "The start date is after the due date." };

  const changes: string[] = [];
  if (d.title !== c.card.title) changes.push(`title: "${c.card.title}" → "${d.title}"`);
  if ((d.description ?? null) !== (c.card.description ?? null)) changes.push("description updated");
  if (d.priority !== c.card.priority) changes.push(`priority: ${c.card.priority} → ${d.priority}`);
  const origStart = c.card.startDate ? c.card.startDate.toISOString().slice(0, 10) : null;
  const origDue = c.card.dueDate ? c.card.dueDate.toISOString().slice(0, 10) : null;
  if (d.startDate !== origStart) changes.push(`start date: ${origStart ?? "none"} → ${d.startDate ?? "none"}`);
  if (d.dueDate !== origDue) changes.push(`due date: ${origDue ?? "none"} → ${d.dueDate ?? "none"}`);

  await prisma.wsCard.update({ where: { id: cardId }, data: { title: d.title, description: d.description, priority: d.priority, startDate: d.startDate ? dbDate(d.startDate) : null, dueDate: d.dueDate ? dbDate(d.dueDate) : null } });
  await logActivity(prisma, {
    organizationId: c.me.organizationId,
    projectId: c.project.id,
    cardId,
    cardTitle: d.title,
    actorId: c.me.id,
    type: "EDITED",
    detail: changes.length > 0 ? changes.join("; ") : "card details updated",
  });
  refresh(c.project.id);
  return { ok: "Saved." };
}

// Moves a card to a list, before another card or at the end. Used by drag and drop and by the "Move to" menu (phones).
async function doMove(c: CardOk, listId: string, beforeCardId: string | null) {
  const target = c.project.lists.find((l) => l.id === listId);
  if (!target) return;
  const siblings = await prisma.wsCard.findMany({ where: { listId, archivedAt: null, id: { not: c.card.id } }, orderBy: { position: "asc" }, select: { id: true, position: true } });
  const at = beforeCardId ? siblings.findIndex((s) => s.id === beforeCardId) : -1;
  const next = at >= 0 ? siblings[at] : null;
  const prev = at >= 0 ? (siblings[at - 1] ?? null) : (siblings[siblings.length - 1] ?? null);
  const changedList = c.card.listId !== listId;
  await prisma.wsCard.update({
    where: { id: c.card.id },
    data: {
      listId,
      position: positionBetween(prev?.position ?? null, next?.position ?? null),
      ...(changedList ? { completedAt: target.category === "DONE" ? new Date() : null, completedById: target.category === "DONE" ? c.me.id : null } : {}),
    },
  });
  if (!changedList) return refresh(c.project.id);
  const type = target.category === "DONE" ? "DONE" : target.category === "BLOCKED" ? "BLOCKED" : "MOVED";
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId: c.project.id, cardId: c.card.id, cardTitle: c.card.title, actorId: c.me.id, type, detail: `${c.card.list.name} → ${target.name}` });
  if (type !== "MOVED") {
    const assignees = await prisma.wsAssignee.findMany({ where: { cardId: c.card.id }, include: { employee: { select: { userId: true } } } });
    const people = [...assignees.map((a) => a.employee.userId).filter((u): u is string => !!u), ...leadUserIds(c.project.members)];
    await notify(
      c.me.organizationId,
      people,
      { title: `${c.me.name} moved "${c.card.title}" to ${target.name}${type === "BLOCKED" ? " (blocked)" : ""}`, body: c.project.name, href: `${PATH}/${c.project.id}?card=${c.card.id}` },
      c.me.id,
    );
  }
  refresh(c.project.id);
}

export async function moveCard(cardId: string, listId: string, beforeCardId: string | null) {
  const c = await cardCtx(cardId, "EDIT");
  if (!c.ok) return;
  await doMove(c, listId, beforeCardId);
}

export async function moveCardForm(cardId: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await cardCtx(cardId, "EDIT");
  if (!c.ok) return { error: c.error };
  const target = c.project.lists.find((l) => l.id === String(form.get("listId") ?? ""));
  if (!target) return { error: "List not found." };
  await doMove(c, target.id, null);
  return { ok: `Moved to ${target.name} (${CATEGORY_LABEL[target.category].toLowerCase()}).` };
}

export async function archiveCard(cardId: string) {
  const c = await cardCtx(cardId, "EDIT");
  if (!c.ok) return;
  await prisma.wsCard.update({ where: { id: cardId }, data: { archivedAt: new Date() } });
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId: c.project.id, cardId, cardTitle: c.card.title, actorId: c.me.id, type: "ARCHIVED" });
  refresh(c.project.id);
  redirect(`${PATH}/${c.project.id}`);
}

export async function toggleAssignee(cardId: string, employeeId: string) {
  const c = await cardCtx(cardId, "EDIT");
  if (!c.ok) return;
  const member = c.project.members.find((m) => m.employeeId === employeeId && m.role !== "VIEWER");
  if (!member) return; // only people working on the project can hold a card
  const has = await prisma.wsAssignee.findUnique({ where: { cardId_employeeId: { cardId, employeeId } } });
  if (has) await prisma.wsAssignee.delete({ where: { cardId_employeeId: { cardId, employeeId } } });
  else {
    await prisma.wsAssignee.create({ data: { cardId, employeeId } });
    if (member.employee.userId) await notify(c.me.organizationId, [member.employee.userId], { title: `${c.me.name} assigned you "${c.card.title}"`, body: c.project.name, href: `${PATH}/${c.project.id}?card=${cardId}` }, c.me.id);
  }
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId: c.project.id, cardId, cardTitle: c.card.title, actorId: c.me.id, type: "ASSIGNED", detail: `${has ? "removed" : "assigned"} ${personName(member.employee)}` });
  refresh(c.project.id);
}

// One field at a time, straight from a cell in the table view. Same rules as the full form.
export async function setCardField(cardId: string, field: "priority" | "startDate" | "dueDate", value: string): Promise<FormState> {
  const c = await cardCtx(cardId, "EDIT");
  if (!c.ok) return { error: c.error };
  let data: { priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" } | { startDate: Date | null } | { dueDate: Date | null };
  if (field === "priority") {
    const p = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).safeParse(value);
    if (!p.success) return { error: "Pick a priority." };
    data = { priority: p.data };
  } else {
    const k = value === "" ? null : day.safeParse(value);
    if (k && !k.success) return { error: "Use a valid date." };
    const date = k ? dbDate(k.data) : null;
    const start = field === "startDate" ? date : c.card.startDate;
    const due = field === "dueDate" ? date : c.card.dueDate;
    if (start && due && start > due) return { error: "The start date is after the due date." };
    data = field === "startDate" ? { startDate: date } : { dueDate: date };
  }
  await prisma.wsCard.update({ where: { id: cardId }, data });
  const what = field === "priority" ? "priority" : field === "startDate" ? "start date" : "due date";
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId: c.project.id, cardId, cardTitle: c.card.title, actorId: c.me.id, type: "EDITED", detail: `${what}: ${value || "none"}` });
  refresh(c.project.id);
  return { ok: "Saved." };
}

// ───────────── labels ─────────────

export async function toggleLabel(cardId: string, labelId: string) {
  const c = await cardCtx(cardId, "EDIT");
  if (!c.ok) return;
  const targetLabel = c.project.labels.find((l) => l.id === labelId);
  if (!targetLabel) return; // only this project's own labels
  const key = { cardId_labelId: { cardId, labelId } };
  const existing = await prisma.wsCardLabel.findUnique({ where: key });
  if (existing) {
    await prisma.wsCardLabel.delete({ where: key });
    await logActivity(prisma, { organizationId: c.me.organizationId, projectId: c.project.id, cardId, cardTitle: c.card.title, actorId: c.me.id, type: "EDITED", detail: `removed label "${targetLabel.name}"` });
  } else {
    await prisma.wsCardLabel.create({ data: { cardId, labelId } });
    await logActivity(prisma, { organizationId: c.me.organizationId, projectId: c.project.id, cardId, cardTitle: c.card.title, actorId: c.me.id, type: "EDITED", detail: `added label "${targetLabel.name}"` });
  }
  await prisma.wsCard.update({ where: { id: cardId }, data: { updatedAt: new Date() } });
  refresh(c.project.id);
}

export async function createLabel(projectId: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await projectCtx(projectId, "EDIT");
  if (!c.ok) return { error: c.error };
  const parsed = z.object({ name: z.string().trim().min(1, "Name the label.").max(30), color: z.enum(Object.keys(LABEL_COLORS) as [string, ...string[]]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (c.project.labels.length >= 30) return { error: "A project can have up to 30 labels." };
  if (c.project.labels.some((l) => l.name.toLowerCase() === parsed.data.name.toLowerCase())) return { error: "That label already exists." };
  await prisma.wsLabel.create({ data: { projectId, ...parsed.data } });
  refresh(projectId);
  return { ok: "Label added." };
}

export async function deleteLabel(projectId: string, labelId: string) {
  const c = await projectCtx(projectId, "MANAGE");
  if (!c.ok) return;
  await prisma.wsLabel.deleteMany({ where: { id: labelId, projectId } });
  refresh(projectId);
}

// ───────────── lists (columns) ─────────────

const categoryEnum = z.enum(["TODO", "DOING", "BLOCKED", "DONE"]);
const listForm = z.object({ name: z.string().trim().min(1, "Name the list.").max(60), category: categoryEnum });

export async function addList(projectId: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await projectCtx(projectId, "MANAGE");
  if (!c.ok) return { error: c.error };
  const parsed = listForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (c.project.lists.length >= 20) return { error: "A board can have up to 20 lists." };
  const last = await prisma.wsList.findFirst({ where: { projectId }, orderBy: { position: "desc" }, select: { position: true } });
  await prisma.wsList.create({ data: { projectId, ...parsed.data, position: (last?.position ?? -1) + 1 } });
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId, actorId: c.me.id, type: "LIST_ADDED", detail: parsed.data.name });
  refresh(projectId);
  return { ok: "List added." };
}

export async function updateList(projectId: string, listId: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await projectCtx(projectId, "MANAGE");
  if (!c.ok) return { error: c.error };
  const parsed = listForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const list = c.project.lists.find((l) => l.id === listId);
  if (!list) return { error: "List not found." };
  await prisma.$transaction(async (tx) => {
    await tx.wsList.update({ where: { id: listId }, data: parsed.data });
    // Cards already in the list follow its new category: they become done (or stop being done) with it.
    if (list.category !== parsed.data.category) await tx.wsCard.updateMany({ where: { listId, archivedAt: null }, data: { completedAt: parsed.data.category === "DONE" ? new Date() : null, completedById: parsed.data.category === "DONE" ? c.me.id : null } });
  });
  refresh(projectId);
  return { ok: "List saved." };
}

export async function archiveList(projectId: string, listId: string): Promise<FormState> {
  const c = await projectCtx(projectId, "MANAGE");
  if (!c.ok) return { error: c.error };
  if (c.project.lists.length <= 1) return { error: "A board needs at least one list." };
  if (await prisma.wsCard.count({ where: { listId, archivedAt: null } })) return { error: "Move or archive the cards in this list first." };
  await prisma.wsList.updateMany({ where: { id: listId, projectId }, data: { archivedAt: new Date() } });
  refresh(projectId);
  return { ok: "List removed." };
}

// Drag a list to a new place: positions are rewritten in order.
export async function moveList(projectId: string, listId: string, beforeListId: string | null) {
  const c = await projectCtx(projectId, "MANAGE");
  if (!c.ok) return;
  if (!c.project.lists.some((l) => l.id === listId)) return;
  const order = c.project.lists.map((l) => l.id).filter((id) => id !== listId);
  const at = beforeListId ? order.indexOf(beforeListId) : -1;
  order.splice(at >= 0 ? at : order.length, 0, listId);
  await prisma.$transaction(order.map((id, position) => prisma.wsList.update({ where: { id }, data: { position } })));
  refresh(projectId);
}

// ───────────── project settings ─────────────

export async function updateProject(projectId: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await projectCtx(projectId, "MANAGE");
  if (!c.ok) return { error: c.error };
  const parsed = z
    .object({ name: z.string().trim().min(2, "Give the project a name.").max(120), description: optText(2000), dueDate: optDay, color: z.enum(Object.keys(WS_THEMES) as [string, ...string[]]) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await prisma.wsProject.update({ where: { id: projectId }, data: { name: d.name, description: d.description, color: d.color, dueDate: d.dueDate ? dbDate(d.dueDate) : null } });
  await audit(c.me.id, "worksync.project_updated", "WsProject", projectId, { name: d.name }, c.me.organizationId);
  refresh(projectId);
  return { ok: "Project saved." };
}

// ───────────── checklist and comments ─────────────

export async function addCheck(cardId: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await cardCtx(cardId, "EDIT");
  if (!c.ok) return { error: c.error };
  const text = z.string().trim().min(1, "Write the step.").max(200).safeParse(form.get("text"));
  if (!text.success) return { error: text.error.issues[0].message };
  const last = await prisma.wsCheck.findFirst({ where: { cardId }, orderBy: { position: "desc" }, select: { position: true } });
  await prisma.wsCheck.create({ data: { cardId, text: text.data, position: (last?.position ?? 0) + 1 } });
  await prisma.wsCard.update({ where: { id: cardId }, data: { updatedAt: new Date() } });
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId: c.project.id, cardId, cardTitle: c.card.title, actorId: c.me.id, type: "CHECKED", detail: `added step: "${text.data}"` });
  refresh(c.project.id);
  return { ok: "Step added." };
}

// The check belongs to a card; the card's project decides who may touch it.
async function checkCtx(checkId: string) {
  const me = await requireUser(PATH);
  const check = await prisma.wsCheck.findFirst({ where: { id: checkId, card: { organizationId: me.organizationId, archivedAt: null } } });
  if (!check) return null;
  const c = await cardCtx(check.cardId, "EDIT");
  return c.ok ? { c, check } : null;
}

export async function toggleCheck(checkId: string) {
  const x = await checkCtx(checkId);
  if (!x) return;
  const done = !x.check.done;
  await prisma.wsCheck.update({ where: { id: checkId }, data: { done, doneAt: done ? new Date() : null } });
  await prisma.wsCard.update({ where: { id: x.check.cardId }, data: { updatedAt: new Date() } });
  await logActivity(prisma, { organizationId: x.c.me.organizationId, projectId: x.c.project.id, cardId: x.check.cardId, cardTitle: x.c.card.title, actorId: x.c.me.id, type: "CHECKED", detail: `${done ? "done" : "reopened"}: ${x.check.text}` });
  refresh(x.c.project.id);
}

export async function removeCheck(checkId: string) {
  const x = await checkCtx(checkId);
  if (!x) return;
  await prisma.wsCheck.delete({ where: { id: checkId } });
  await prisma.wsCard.update({ where: { id: x.check.cardId }, data: { updatedAt: new Date() } });
  await logActivity(prisma, { organizationId: x.c.me.organizationId, projectId: x.c.project.id, cardId: x.check.cardId, cardTitle: x.c.card.title, actorId: x.c.me.id, type: "CHECKED", detail: `removed step: "${x.check.text}"` });
  refresh(x.c.project.id);
}

// Anyone who can open the project may comment, including a manager looking in from above.
export async function addComment(cardId: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await cardCtx(cardId, "VIEW");
  if (!c.ok) return { error: c.error };
  const body = z.string().trim().min(1, "Write a comment.").max(50000, "Keep it under 50,000 characters.").safeParse(form.get("body"));
  if (!body.success) return { error: body.error.issues[0].message };
  await prisma.wsComment.create({ data: { cardId, authorId: c.me.id, body: body.data } });
  await prisma.wsCard.update({ where: { id: cardId }, data: { updatedAt: new Date() } });
  await logActivity(prisma, { organizationId: c.me.organizationId, projectId: c.project.id, cardId, cardTitle: c.card.title, actorId: c.me.id, type: "COMMENTED" });
  const assignees = await prisma.wsAssignee.findMany({ where: { cardId }, include: { employee: { select: { userId: true } } } });
  await notify(
    c.me.organizationId,
    [...assignees.map((a) => a.employee.userId).filter((u): u is string => !!u), ...leadUserIds(c.project.members)],
    { title: `${c.me.name} commented on "${c.card.title}"`, body: body.data.length > 120 ? `${body.data.slice(0, 117)}…` : body.data, href: `${PATH}/${c.project.id}?card=${cardId}` },
    c.me.id,
  );
  refresh(c.project.id);
  return { ok: "Comment sent." };
}
