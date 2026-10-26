"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { saveImage } from "@/lib/documents";
import { getMyEmployee } from "@/lib/employees";
import { isHr } from "@/lib/scope";
import type { FormState } from "@/app/login/actions";

// Profile picture: your own, or anyone's for HR.
export async function uploadPhoto(employeeId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/id");
  const mine = await getMyEmployee(me);
  if (employeeId !== mine.id && !isHr(me.role.key)) return { error: "You can only change your own picture." };
  if (!(await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, select: { id: true } }))) return { error: "Employee not found." };
  const r = await saveImage(me.organizationId, form.get("photo"));
  if ("error" in r) return r;
  await prisma.employee.update({ where: { id: employeeId }, data: { photoKey: r.key } }); // the old file stays in storage
  await audit(me.id, "employee.photo_changed", "Employee", employeeId, undefined, me.organizationId);
  revalidatePath("/id");
  revalidatePath(`/employees/${employeeId}`);
  return { ok: "Picture saved." };
}

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

// The ID card layout. HR only.
export async function saveIdDesign(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/id/design");
  const parsed = z
    .object({
      title: z.string().trim().min(2, "Give the card a title.").max(40),
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color."),
      signatoryName: text(80), signatoryTitle: text(80), footer: text(160),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const flags = { showPosition: form.get("showPosition") === "on", showDepartment: form.get("showDepartment") === "on", showHireDate: form.get("showHireDate") === "on", showEmployeeNo: form.get("showEmployeeNo") === "on" };
  let signatureKey: string | undefined;
  const sig = form.get("signature");
  if (sig instanceof File && sig.size > 0) {
    const r = await saveImage(me.organizationId, sig);
    if ("error" in r) return r;
    signatureKey = r.key;
  }
  // Company logo: a new file replaces it; the tick box removes it; otherwise it stays as it is.
  let logoKey: string | null | undefined;
  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const r = await saveImage(me.organizationId, logo);
    if ("error" in r) return r;
    logoKey = r.key;
  } else if (form.get("removeLogo") === "on") logoKey = null;
  const data = { ...parsed.data, ...flags, ...(signatureKey ? { signatureKey } : {}), ...(logoKey !== undefined ? { logoKey } : {}) };
  await prisma.idCardSettings.upsert({ where: { organizationId: me.organizationId }, update: data, create: { organizationId: me.organizationId, ...data } });
  await audit(me.id, "id_card.design_saved", "IdCardSettings", undefined, { ...parsed.data, ...flags, signature: !!signatureKey, logo: logoKey === undefined ? "kept" : logoKey ? "changed" : "removed" }, me.organizationId);
  revalidatePath("/id", "layout");
  return { ok: "Saved. Every employee's ID now uses this design." };
}
