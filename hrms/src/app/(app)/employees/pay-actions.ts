"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { parsePesos } from "@/lib/money";
import { dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

// Pay data is HR-only. requireUser("/payroll") applies the same access rule as the Payroll pages.

export async function setCompensation(employeeId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const parsed = z
    .object({ payType: z.enum(["MONTHLY", "DAILY", "HOURLY"]), effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date it starts."), note: z.string().trim().max(200).optional() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const rate = parsePesos(form.get("rate"));
  if (!rate || rate <= 0) return { error: "Enter the pay rate in pesos, for example 22000.00." };
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId } });
  if (!emp) return { error: "Employee not found." };
  // A new row each time: salary history is never overwritten.
  const c = await prisma.compensation.create({
    data: { organizationId: me.organizationId, employeeId, payType: parsed.data.payType, rateCents: rate, effectiveFrom: dbDate(parsed.data.effectiveFrom), note: parsed.data.note || null, createdById: me.id },
  });
  await audit(me.id, "compensation.set", "Compensation", c.id, { employeeId, payType: c.payType, rateCents: rate, from: parsed.data.effectiveFrom }, me.organizationId);
  revalidatePath(`/employees/${employeeId}`);
  return { ok: "Pay rate saved. It applies from that date; earlier pay keeps the old rate." };
}

export async function assignComponent(employeeId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payroll");
  const componentId = z.string().min(1, "Choose a pay item.").safeParse(form.get("componentId"));
  if (!componentId.success) return { error: componentId.error.issues[0].message };
  const [emp, comp] = await Promise.all([
    prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId } }),
    prisma.payComponent.findFirst({ where: { id: componentId.data, organizationId: me.organizationId, archivedAt: null } }),
  ]);
  if (!emp || !comp) return { error: "Employee or pay item not found." };
  let override: number | null = null;
  const raw = String(form.get("override") ?? "").trim();
  if (raw) {
    override = comp.calc === "FIXED" ? parsePesos(raw) : Math.round(Number(raw) * 100);
    if (override === null || !Number.isFinite(override) || override <= 0) return { error: "The override must be a positive amount (pesos, or a percentage for percent items)." };
  }
  await prisma.employeeComponent.upsert({
    where: { employeeId_componentId: { employeeId, componentId: comp.id } },
    update: { valueOverride: override, active: true },
    create: { organizationId: me.organizationId, employeeId, componentId: comp.id, valueOverride: override },
  });
  await audit(me.id, "compensation.component_assigned", "EmployeeComponent", undefined, { employeeId, component: comp.name, override }, me.organizationId);
  revalidatePath(`/employees/${employeeId}`);
  return { ok: `${comp.name} assigned.` };
}

export async function removeComponent(employeeId: string, componentId: string) {
  const me = await requireUser("/payroll");
  await prisma.employeeComponent.deleteMany({ where: { employeeId, componentId, organizationId: me.organizationId } });
  await audit(me.id, "compensation.component_removed", "EmployeeComponent", undefined, { employeeId, componentId }, me.organizationId);
  revalidatePath(`/employees/${employeeId}`);
}
