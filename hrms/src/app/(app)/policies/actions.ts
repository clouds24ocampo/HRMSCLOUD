"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { requestEvidence } from "@/lib/device";
import { MAX_BYTES, saveFile, safeName, sniffType } from "@/lib/documents";
import { getMyEmployee } from "@/lib/employees";
import { sha256 } from "@/lib/policies";
import { isHr } from "@/lib/scope";
import type { FormState } from "@/app/login/actions";

const KINDS = ["USER_AGREEMENT", "SYSTEM_TERMS", "SYSTEM_PRIVACY", "COMPANY_PRIVACY", "COMPANY_POLICY"] as const;
const done = () => {
  revalidatePath("/policies", "layout");
  revalidatePath("/", "layout"); // the "policies to sign" reminder sits in the app layout
};

// HR publishes a policy: a PDF or a text. Publishing with the title of a current one makes a new version: the old one is
// archived together with its signatures (they stay on record), and everyone is asked to sign the new version.
export async function publishPolicy(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/policies");
  if (!isHr(me.role.key)) return { error: "Only HR can publish policies." };
  const parsed = z
    .object({ title: z.string().trim().min(3, "Give the policy a title.").max(120), kind: z.enum(KINDS), body: z.string().trim().max(50_000).optional().transform((v) => v || undefined) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const file = form.get("file");
  let stored: { storageKey: string; fileName: string; hash: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: `That file is too large. The limit is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (sniffType(bytes)?.mime !== "application/pdf") return { error: "Upload the policy as a PDF." };
    stored = { storageKey: await saveFile(me.organizationId, bytes), fileName: safeName(file.name), hash: sha256(bytes) };
  }
  if (!stored && !d.body) return { error: "Upload a PDF or write the policy text." };

  const prev = await prisma.policyDocument.findFirst({ where: { organizationId: me.organizationId, title: d.title, archivedAt: null } });
  const p = await prisma.$transaction(async (tx) => {
    if (prev) await tx.policyDocument.update({ where: { id: prev.id }, data: { archivedAt: new Date() } });
    return tx.policyDocument.create({
      data: {
        organizationId: me.organizationId, kind: d.kind, title: d.title, body: stored ? null : d.body, storageKey: stored?.storageKey, fileName: stored?.fileName,
        contentHash: stored?.hash ?? sha256(d.body!), version: (prev?.version ?? 0) + 1, requiresSignature: form.get("requiresSignature") === "on", createdById: me.id,
      },
    });
  });
  await audit(me.id, "policy.published", "PolicyDocument", p.id, { title: p.title, version: p.version }, me.organizationId);
  const users = await prisma.user.findMany({ where: { organizationId: me.organizationId, active: true, id: { not: me.id } }, select: { id: true } });
  if (p.requiresSignature && users.length) await prisma.notification.createMany({ data: users.map((u) => ({ organizationId: me.organizationId, userId: u.id, title: `Please read and sign: ${p.title}`, href: `/policies/${p.id}` })) });
  done();
  return { ok: `${p.title} published${p.version > 1 ? ` as version ${p.version}` : ""}.` };
}

export async function archivePolicy(id: string) {
  const me = await requireUser("/policies");
  if (!isHr(me.role.key)) return;
  const n = await prisma.policyDocument.updateMany({ where: { id, organizationId: me.organizationId, archivedAt: null }, data: { archivedAt: new Date() } });
  if (n.count) await audit(me.id, "policy.archived", "PolicyDocument", id, undefined, me.organizationId);
  done();
}

// The employee signs for themselves: typed full name, a drawn signature, and "I have read and agree".
// What was signed is pinned by the policy's content hash, so a later edit can never change what this signature covers.
export async function signPolicy(policyId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/policies");
  const parsed = z
    .object({
      signedName: z.string().trim().min(3, "Type your full name.").max(120),
      signature: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Draw your signature in the box.").max(700_000, "The signature is too large. Clear it and sign again."),
      agree: z.literal("on", { error: "Tick the box to confirm you have read and agree." }),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const mine = await getMyEmployee(me);
  const policy = await prisma.policyDocument.findFirst({ where: { id: policyId, organizationId: me.organizationId, archivedAt: null } });
  if (!policy) return { error: "This policy was replaced by a newer version. Open the current one." };
  if (await prisma.policySignature.findUnique({ where: { policyId_employeeId: { policyId, employeeId: mine.id } } })) return { error: "You already signed this version." };
  const bytes = new Uint8Array(Buffer.from(parsed.data.signature.split(",")[1], "base64"));
  if (sniffType(bytes)?.mime !== "image/png" || bytes.length < 200) return { error: "Draw your signature in the box." };
  const ev = await requestEvidence();
  const sig = await prisma.policySignature.create({
    data: {
      organizationId: me.organizationId, policyId, employeeId: mine.id, signedName: parsed.data.signedName,
      signatureKey: await saveFile(me.organizationId, bytes), contentHash: policy.contentHash, ipAddress: ev.ipAddress, userAgent: ev.userAgent,
    },
  });
  await audit(me.id, "policy.signed", "PolicySignature", sig.id, { policyId, title: policy.title, version: policy.version, contentHash: policy.contentHash }, me.organizationId);
  done();
  return { ok: "Signed. A copy of your signature is kept with this version of the policy." };
}
