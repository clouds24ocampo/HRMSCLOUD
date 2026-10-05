"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { DOC_CATEGORIES, MAX_BYTES, safeName, saveFile, sniffType } from "@/lib/documents";
import { getMyEmployee } from "@/lib/employees";
import { notify, userIdOfEmployee } from "@/lib/notify";
import { isHr } from "@/lib/scope";
import { dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

const done = () => revalidatePath("/documents");

// HR uploads for anyone; everyone else only for themselves. A new file with the same title becomes version 2, 3…
export async function uploadDocument(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/documents");
  const mine = await getMyEmployee(me);
  const parsed = z
    .object({
      employeeId: z.string().optional(), category: z.enum(DOC_CATEGORIES, { error: "Choose a category." }),
      title: z.string().trim().min(2, "Give the document a title.").max(100),
      expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const employeeId = isHr(me.role.key) ? parsed.data.employeeId || mine.id : mine.id;
  if (!(await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId } }))) return { error: "Employee not found." };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  if (file.size > MAX_BYTES) return { error: `That file is too large. The limit is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) return { error: "Only PDF, PNG and JPEG files are accepted." };

  const prev = await prisma.employeeDocument.findFirst({ where: { employeeId, organizationId: me.organizationId, title: parsed.data.title }, orderBy: { version: "desc" } });
  const storageKey = await saveFile(me.organizationId, bytes);
  const doc = await prisma.$transaction(async (tx) => {
    if (prev) await tx.employeeDocument.updateMany({ where: { employeeId, organizationId: me.organizationId, title: parsed.data.title, archivedAt: null }, data: { archivedAt: new Date() } });
    return tx.employeeDocument.create({
      data: {
        organizationId: me.organizationId, employeeId, category: parsed.data.category, title: parsed.data.title, fileName: safeName(file.name),
        mimeType: type.mime, sizeBytes: file.size, storageKey, version: (prev?.version ?? 0) + 1,
        expiresOn: parsed.data.expiresOn ? dbDate(parsed.data.expiresOn) : null, uploadedById: me.id,
      },
    });
  });
  await audit(me.id, "document.uploaded", "EmployeeDocument", doc.id, { employeeId, title: doc.title, version: doc.version }, me.organizationId);
  if (employeeId !== mine.id) {
    const uid = await userIdOfEmployee(me.organizationId, employeeId);
    if (uid) await notify(me.organizationId, [uid], { title: `A document was added to your file: ${doc.title}`, href: "/documents" }, me.id);
  }
  done();
  return { ok: `${doc.title} saved${doc.version > 1 ? ` as version ${doc.version}` : ""}.` };
}

export async function archiveDocument(id: string) {
  const me = await requireUser("/documents");
  if (!isHr(me.role.key)) return;
  const d = await prisma.employeeDocument.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!d) return;
  await prisma.employeeDocument.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(me.id, "document.archived", "EmployeeDocument", id, { title: d.title }, me.organizationId); // the file stays on disk
  done();
}
