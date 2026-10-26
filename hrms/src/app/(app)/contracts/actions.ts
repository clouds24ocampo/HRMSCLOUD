"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isHr } from "@/lib/scope";
import { createContract, restoredStatus, signContract, type ContractTemplateKey } from "@/lib/contracts";
import type { FormState } from "@/app/login/actions";
import { audit } from "@/lib/audit";

export async function createContractAction(_: FormState, form: FormData): Promise<FormState & { contractId?: string }> {
  const me = await requireUser("/contracts");
  if (!isHr(me.role.key)) return { error: "Only HR or Administrator can generate employment contracts." };

  const parsed = z
    .object({
      employeeId: z.string().min(1, "Select an employee."),
      templateKey: z.enum(["REGULAR", "PROBATIONARY", "PROJECT_BASED", "CONSULTANT"]),
      customBody: z.string().optional(),
      autoIssue: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const contract = await createContract({
      organizationId: me.organizationId,
      employeeId: parsed.data.employeeId,
      templateKey: parsed.data.templateKey as ContractTemplateKey,
      customBody: parsed.data.customBody,
      createdById: me.id,
      autoIssue: parsed.data.autoIssue === "on" || parsed.data.autoIssue === "true",
    });

    revalidatePath("/contracts");
    revalidatePath(`/employees/${parsed.data.employeeId}`);
    return { ok: "Contract generated and saved successfully.", contractId: contract.id };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to generate contract." };
  }
}

export async function signContractAction(contractId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/contracts");
  const note = (form.get("note") as string) || null;

  try {
    await signContract(contractId, me.id, note);
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${contractId}`);
    return { ok: "Contract signed successfully." };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to sign contract." };
  }
}

export async function voidContractAction(contractId: string, reason: string): Promise<FormState> {
  const me = await requireUser("/contracts");
  if (!isHr(me.role.key)) return { error: "Only HR can void a contract." };

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organizationId: me.organizationId },
  });
  if (!contract) return { error: "Contract not found." };

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "VOID", voidReason: reason.trim(), voidedAt: new Date() },
  });

  await audit(me.id, "contract.voided", "Contract", contractId, { reason }, me.organizationId);
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contractId}`);
  return { ok: "Contract voided." };
}

export async function restoreContractAction(contractId: string): Promise<FormState> {
  const me = await requireUser("/contracts");
  if (!isHr(me.role.key)) return { error: "Only HR can restore a contract." };

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organizationId: me.organizationId, status: "VOID" },
  });
  if (!contract) return { error: "Contract not found or not voided." };

  const status = restoredStatus(contract);
  await prisma.contract.update({
    where: { id: contractId },
    data: { status, voidReason: null, voidedAt: null },
  });

  await audit(me.id, "contract.restored", "Contract", contractId, { status }, me.organizationId);
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contractId}`);
  return { ok: "Contract restored." };
}

export async function issueContractAction(contractId: string): Promise<FormState> {
  const me = await requireUser("/contracts");
  if (!isHr(me.role.key)) return { error: "Only HR can issue contracts." };

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organizationId: me.organizationId },
    include: { employee: true },
  });
  if (!contract) return { error: "Contract not found." };

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "ISSUED", issuedAt: new Date(), issuedById: me.id },
  });

  await audit(me.id, "contract.issued", "Contract", contractId, undefined, me.organizationId);
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contractId}`);
  return { ok: "Contract issued to employee." };
}

export async function deleteContractAction(contractId: string) {
  const me = await requireUser("/contracts");
  if (!isHr(me.role.key)) return;

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organizationId: me.organizationId, status: "DRAFT" },
  });
  if (!contract) return;

  await prisma.contract.delete({ where: { id: contractId } });
  await audit(me.id, "contract.deleted", "Contract", contractId, undefined, me.organizationId);
  revalidatePath("/contracts");
  redirect("/contracts");
}
