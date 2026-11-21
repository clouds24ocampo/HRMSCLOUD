// The 201 file an applicant uploads once they are "For requirements". Same checklist as the employee 201 file
// (src/lib/file201.ts), so on hire the documents move across without retyping.
import { prisma } from "@/lib/prisma";
import { FILE_201, FILE_201_CATEGORY } from "@/lib/file201";
import { PDS_TITLE } from "@/lib/pds-config";

// "Signed Employment Contract" is added by HR after the offer, not by the applicant.
export const APPLICANT_REQUIREMENTS = FILE_201.filter((r) => r.title !== "Signed Employment Contract");
export const isApplicantRequirement = (title: string) => APPLICANT_REQUIREMENTS.some((r) => r.title === title);

// `form`: this requirement is the online Personal Data Sheet form, not a file. It is in once the applicant submits the form.
export type RequirementItem = { title: string; required: boolean; hint: string; doc: { id: string; fileName: string; version: number; at: Date } | null; auto: boolean; form: boolean; formDone: boolean };

// Pure: the checklist with what is already in. The resume uploaded at sign-up counts as the resume requirement, and a submitted
// Personal Data Sheet form counts as the Personal Data Sheet requirement.
export function buildChecklist(docs: { id: string; title: string; fileName: string; version: number; createdAt: Date }[], hasResume: boolean, pdsSubmitted = false) {
  const latest = new Map(docs.map((d) => [d.title, d]));
  const items: RequirementItem[] = APPLICANT_REQUIREMENTS.map((r) => {
    const d = latest.get(r.title);
    const form = r.title === PDS_TITLE;
    return { ...r, doc: d ? { id: d.id, fileName: d.fileName, version: d.version, at: d.createdAt } : null, auto: r.title === "Resume / Curriculum Vitae" && !d && hasResume, form, formDone: form && pdsSubmitted };
  });
  const required = items.filter((i) => i.required);
  const done = required.filter((i) => i.doc || i.auto || i.formDone).length;
  return { items, done, total: required.length, complete: done === required.length };
}

export async function requirementChecklist(profileId: string) {
  const [docs, profile, pds] = await Promise.all([
    prisma.applicantDocument.findMany({ where: { profileId, archivedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, fileName: true, version: true, createdAt: true } }),
    prisma.applicantProfile.findUnique({ where: { id: profileId }, select: { resumeKey: true } }),
    prisma.personalDataSheet.findUnique({ where: { profileId }, select: { submittedAt: true, completePct: true } }),
  ]);
  return { ...buildChecklist(docs, !!profile?.resumeKey, !!pds?.submittedAt), pds: { submitted: !!pds?.submittedAt, pct: pds?.completePct ?? 0, started: !!pds } };
}

// On hire: everything the applicant uploaded becomes part of the employee's real 201 file. The resume and valid ID given at
// sign-up are added too, unless a requirement upload already covers them.
export async function copyToEmployee201(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], p: { id: string; organizationId: string; resumeKey: string | null; resumeName: string | null; resumeMime: string | null; idKey: string | null; idName: string | null; idMime: string | null }, employeeId: string, actorId: string) {
  const docs = await tx.applicantDocument.findMany({ where: { profileId: p.id, archivedAt: null } });
  const rows = docs.map((d) => ({ title: d.title, fileName: d.fileName, mimeType: d.mimeType, sizeBytes: d.sizeBytes, storageKey: d.storageKey }));
  const have = new Set(rows.map((r) => r.title));
  const extra = (title: string, key: string | null, name: string | null, mime: string | null) => {
    if (key && !have.has(title) && !rows.some((r) => r.storageKey === key)) rows.push({ title, fileName: name ?? title, mimeType: mime ?? "application/octet-stream", sizeBytes: 0, storageKey: key });
  };
  extra("Resume / Curriculum Vitae", p.resumeKey, p.resumeName, p.resumeMime);
  extra("Valid Government IDs", p.idKey, p.idName, p.idMime);
  for (const r of rows) {
    await tx.employeeDocument.create({ data: { organizationId: p.organizationId, employeeId, category: FILE_201_CATEGORY, ...r, uploadedById: actorId } });
  }
  // They are in the employee's 201 file now, so they leave the applicant file. The stored files stay: the employee file points to them.
  await tx.applicantDocument.deleteMany({ where: { profileId: p.id } });
  return rows.length;
}

// Policies the applicant signed on orientation day become the employee's own signatures, so nobody signs twice.
export async function moveSignaturesToEmployee(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], p: { id: string; organizationId: string }, employeeId: string) {
  const sigs = await tx.applicantPolicySignature.findMany({ where: { profileId: p.id } });
  for (const s of sigs) {
    await tx.policySignature.upsert({
      where: { policyId_employeeId: { policyId: s.policyId, employeeId } }, update: {},
      create: { organizationId: p.organizationId, policyId: s.policyId, employeeId, signedName: s.signedName, signatureKey: s.signatureKey, contentHash: s.contentHash, ipAddress: s.ipAddress, userAgent: s.userAgent },
    });
  }
  await tx.applicantPolicySignature.deleteMany({ where: { profileId: p.id } });
  return sigs.length;
}
