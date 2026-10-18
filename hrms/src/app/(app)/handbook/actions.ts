"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isHr } from "@/lib/scope";
import { getMyEmployee } from "@/lib/employees";
import { acknowledgeHandbook } from "@/lib/handbook";
import type { FormState } from "@/app/login/actions";
import { audit } from "@/lib/audit";

export async function acknowledgeHandbookAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/handbook");
  const mine = await getMyEmployee(me);
  const note = (form.get("note") as string) || undefined;

  try {
    await acknowledgeHandbook(mine.id, me.organizationId, 1, note);
    revalidatePath("/handbook");
    return { ok: "Thank you! Your acknowledgment of the Company Handbook has been officially recorded." };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to record acknowledgment." };
  }
}

export async function updateHandbookSectionAction(sectionId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/handbook");
  if (!isHr(me.role.key)) return { error: "Only HR or Administrator can edit the Company Handbook." };

  const parsed = z
    .object({
      title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120),
      content: z.string().trim().min(10, "Content must be at least 10 characters."),
    })
    .safeParse(Object.fromEntries(form));

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const section = await prisma.handbookSection.findFirst({
    where: { id: sectionId, organizationId: me.organizationId },
  });
  if (!section) return { error: "Section not found." };

  await prisma.handbookSection.update({
    where: { id: sectionId },
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      version: section.version + 1,
      updatedById: me.id,
    },
  });

  await audit(
    me.id,
    "handbook.updated",
    "HandbookSection",
    sectionId,
    { title: parsed.data.title, version: section.version + 1 },
    me.organizationId,
  );

  revalidatePath("/handbook");
  return { ok: "Handbook section updated successfully." };
}

export async function createHandbookSectionAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/handbook");
  if (!isHr(me.role.key)) return { error: "Only HR can add handbook sections." };

  const parsed = z
    .object({
      title: z.string().trim().min(3).max(120),
      slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens."),
      content: z.string().trim().min(10),
      sortOrder: z.coerce.number().int().min(1).max(999).default(99),
    })
    .safeParse(Object.fromEntries(form));

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const exists = await prisma.handbookSection.findUnique({
    where: { organizationId_slug: { organizationId: me.organizationId, slug: parsed.data.slug } },
  });
  if (exists) return { error: "A section with this slug already exists." };

  const sec = await prisma.handbookSection.create({
    data: {
      organizationId: me.organizationId,
      title: parsed.data.title,
      slug: parsed.data.slug,
      content: parsed.data.content,
      sortOrder: parsed.data.sortOrder,
      updatedById: me.id,
    },
  });

  await audit(me.id, "handbook.section_created", "HandbookSection", sec.id, { title: sec.title }, me.organizationId);
  revalidatePath("/handbook");
  return { ok: "New chapter added to the handbook." };
}
