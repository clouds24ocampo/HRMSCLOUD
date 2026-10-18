"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { acceptIncentive, awardIncentive, declineIncentive } from "@/lib/incentives";
import type { FormState } from "@/app/login/actions";

const PATH = "/incentives";

export async function awardIncentiveAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser(PATH);
  const canAward = isHr(me.role.key) || me.role.key === ROLES.MANAGER;
  if (!canAward) return { error: "Only HR administrators and managers can award incentives." };

  const parsed = z
    .object({
      employeeId: z.string().min(1, "Select an employee."),
      title: z.string().trim().min(2, "Give the incentive a title.").max(120),
      amount: z.coerce.number().positive("Amount must be greater than zero."),
      reason: z.string().trim().min(3, "Provide a reason/citation for this incentive.").max(2000),
      projectId: z.string().optional().nullable(),
      cardId: z.string().optional().nullable(),
    })
    .safeParse(Object.fromEntries(form));

  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const amountCents = Math.round(d.amount * 100);
    await awardIncentive({
      organizationId: me.organizationId,
      employeeId: d.employeeId,
      title: d.title,
      amountCents,
      reason: d.reason,
      awardedById: me.id,
      projectId: d.projectId || null,
      cardId: d.cardId || null,
    });

    revalidatePath(PATH);
    revalidatePath("/dashboard");
    if (d.projectId) revalidatePath(`/worksync/${d.projectId}`);
    return { ok: "Incentive awarded. The employee has been notified to accept it." };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to award incentive." };
  }
}

export async function acceptIncentiveAction(incentiveId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser(PATH);
  const note = String(form.get("employeeNote") ?? "").trim();

  try {
    await acceptIncentive(incentiveId, me.id, note || null);
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    revalidatePath("/payslips");
    return { ok: "Incentive accepted! It will be credited to your upcoming payslip." };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to accept incentive." };
  }
}

export async function declineIncentiveAction(incentiveId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser(PATH);
  const reason = String(form.get("reason") ?? "").trim();

  try {
    await declineIncentive(incentiveId, me.id, reason || null);
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    return { ok: "Incentive declined." };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to decline incentive." };
  }
}
