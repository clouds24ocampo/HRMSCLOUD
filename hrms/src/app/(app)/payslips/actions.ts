"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { MAX_BYTES, safeName, saveFile, sniffType } from "@/lib/documents";
import { formatMoney, parsePesos } from "@/lib/money";
import { notify } from "@/lib/notify";
import { ROLES } from "@/lib/roles";
import { isHr } from "@/lib/scope";
import { dbDate } from "@/lib/time";
import { PAYOUT_METHODS } from "@/lib/payout";
import type { FormState } from "@/app/login/actions";

// HR records what was actually handed over for a finalized payslip, with proof. A new record replaces the previous one
// as the current answer, but every record stays (see the Payout model).
export async function recordPayout(payslipId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payslips");
  if (!isHr(me.role.key)) return { error: "Only HR can record a payment." };
  const parsed = z
    .object({
      method: z.enum(PAYOUT_METHODS, { error: "Choose how it was paid." }),
      reference: z.string().trim().max(120).optional().transform((v) => v || null),
      paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date it was paid."),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const cents = parsePesos(form.get("amount"));
  if (cents === null || cents < 0) return { error: "Enter the amount actually paid, in pesos." };
  const slip = await prisma.payslip.findFirst({ where: { id: payslipId, organizationId: me.organizationId }, include: { period: { select: { status: true, name: true } }, employee: { select: { userId: true } } } });
  if (!slip) return { error: "Payslip not found." };
  if (slip.period.status !== "FINALIZED") return { error: "Finalize the payroll first. Payment is recorded on the final payslip." };

  let proof: { key: string; name: string; mime: string } | null = null;
  const file = form.get("proof");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: `The proof is too large. The limit is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const t = sniffType(bytes);
    if (!t) return { error: "Upload the proof as a PDF, PNG or JPEG." };
    proof = { key: await saveFile(me.organizationId, bytes), name: safeName(file.name), mime: t.mime };
  }
  const p = await prisma.payout.create({
    data: {
      organizationId: me.organizationId, payslipId, amountCents: cents, method: parsed.data.method, reference: parsed.data.reference, paidOn: dbDate(parsed.data.paidOn),
      proofKey: proof?.key, proofName: proof?.name, proofMime: proof?.mime, recordedById: me.id,
    },
  });
  await audit(me.id, "payout.recorded", "Payout", p.id, { payslipId, amountCents: cents, netCents: slip.netCents, method: p.method, proof: !!proof }, me.organizationId);
  if (slip.employee.userId) await notify(me.organizationId, [slip.employee.userId], { title: `Please confirm your pay for ${slip.period.name}: ${formatMoney(cents)}`, body: `${p.method}${p.reference ? ` · ${p.reference}` : ""}`, href: `/payslips/${payslipId}` }, me.id);
  revalidatePath(`/payslips/${payslipId}`);
  revalidatePath("/payslips");
  return { ok: cents === slip.netCents ? "Recorded. The employee is asked to confirm." : `Recorded ${formatMoney(cents)}, which differs from the net pay ${formatMoney(slip.netCents)}. The employee is asked to confirm.` };
}

// The employee answers for their own pay: received it, or something is wrong (with a note).
export async function answerPayout(payoutId: string, answer: "CONFIRMED" | "DISPUTED", _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/payslips");
  const note = z.string().trim().max(500).optional().parse(form.get("note") ?? undefined);
  if (answer === "DISPUTED" && (note ?? "").length < 5) return { error: "Tell HR what is wrong (at least 5 characters)." };
  const p = await prisma.payout.findFirst({ where: { id: payoutId, organizationId: me.organizationId }, include: { payslip: { select: { id: true, employee: { select: { userId: true } }, period: { select: { name: true } } } } } });
  if (!p || p.payslip.employee.userId !== me.id) return { error: "This payment is not yours to confirm." };
  const latest = await prisma.payout.findFirst({ where: { payslipId: p.payslipId }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (latest?.id !== p.id) return { error: "HR recorded a newer payment. Answer that one." };
  const n = await prisma.payout.updateMany({ where: { id: p.id, status: "WAITING" }, data: { status: answer, answeredAt: new Date(), employeeNote: note || null } });
  if (!n.count) return { error: "You already answered." };
  await audit(me.id, answer === "CONFIRMED" ? "payout.confirmed" : "payout.disputed", "Payout", p.id, { amountCents: p.amountCents, note }, me.organizationId);
  const hr = await prisma.user.findMany({ where: { organizationId: me.organizationId, active: true, role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN] } } }, select: { id: true } });
  await notify(me.organizationId, hr.map((u) => u.id), {
    title: answer === "CONFIRMED" ? `${me.name} confirmed receiving ${formatMoney(p.amountCents)}` : `${me.name} reported a problem with their pay`,
    body: `${p.payslip.period.name}${note ? ` · ${note}` : ""}`, href: `/payslips/${p.payslipId}`,
  }, me.id);
  revalidatePath(`/payslips/${p.payslipId}`);
  revalidatePath("/payslips");
  return { ok: answer === "CONFIRMED" ? "Thank you. Your confirmation is recorded." : "Sent to HR. They will look into it." };
}
