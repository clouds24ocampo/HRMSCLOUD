"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { readGovNumbers, saveGovNumbers } from "@/lib/employee-ids";
import { saveImage } from "@/lib/documents";
import { dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

// Everything here changes only the signed-in person's own record. The employee id is never taken from the form.
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

export async function saveMyContact(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/profile");
  const mine = await getMyEmployee(me);
  const parsed = z
    .object({
      phone: text(30), address: text(200),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose your date of birth.").optional().or(z.literal("").transform(() => undefined)),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.birthDate && (d.birthDate > new Date().toISOString().slice(0, 10) || d.birthDate < "1900-01-01")) return { error: "Check your date of birth." };
  await prisma.employee.update({ where: { id: mine.id }, data: { phone: d.phone, address: d.address, birthDate: d.birthDate ? dbDate(d.birthDate) : null } });
  await audit(me.id, "profile.contact_saved", "Employee", mine.id, undefined, me.organizationId);
  revalidatePath("/profile");
  revalidatePath("/id");
  return { ok: "Saved." };
}

export async function saveMyNumbers(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/profile");
  const mine = await getMyEmployee(me);
  const r = readGovNumbers(form);
  if (!r.ok) return { error: r.error };
  const set = await saveGovNumbers(me.organizationId, mine.id, r.nums);
  // The trail says that numbers were changed and which kinds, never the numbers.
  await audit(me.id, "profile.numbers_saved", "Employee", mine.id, { numbers: set }, me.organizationId);
  revalidatePath("/profile");
  revalidatePath("/id");
  return { ok: "Saved. They are printed on the back of your ID." };
}

// Your own picture. It is the picture on your digital ID, so nothing else has to be done.
export async function uploadMyPhoto(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/profile");
  const mine = await getMyEmployee(me);
  const r = await saveImage(me.organizationId, form.get("photo"));
  if ("error" in r) return r;
  await prisma.employee.update({ where: { id: mine.id }, data: { photoKey: r.key } }); // the old file stays in storage
  await audit(me.id, "employee.photo_changed", "Employee", mine.id, undefined, me.organizationId);
  revalidatePath("/profile");
  revalidatePath("/id");
  revalidatePath(`/employees/${mine.id}`);
  return { ok: "Picture saved. It is on your ID now." };
}
