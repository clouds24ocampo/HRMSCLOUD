"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { MAX_BYTES, safeName, saveFile, sniffType } from "@/lib/documents";
import { canUploadRequirements } from "@/lib/stages";
import { isApplicantRequirement, requirementChecklist } from "@/lib/requirements";
import { notify } from "@/lib/notify";
import { ROLES } from "@/lib/roles";
import { requestEvidence } from "@/lib/device";
import { getOrgSettings } from "@/lib/settings";
import { orientationOpen, requiredPolicies } from "@/lib/orientation";
import { advanceIfComplete, closeRun, examsForJob, finalizeAttempt, shareGlobalAttempts } from "@/lib/applicants";
import { asLang, secondsLeft, timeIsUp } from "@/lib/exams";
import { questionsFor, type RunResult } from "@/lib/exam-run";
import { ensureTagalog } from "@/lib/translate";
import type { FormState } from "@/app/login/actions";

const done = () => revalidatePath("/apply");

async function myProfile() {
  const me = await requireUser("/apply");
  const profile = await prisma.applicantProfile.findUnique({ where: { userId: me.id } });
  if (!profile) redirect("/login");
  return { me, profile };
}

// Any number of positions at once. Ones already applied for are skipped.
export async function applyToJobs(jobIds: string[]): Promise<FormState> {
  const { me, profile } = await myProfile();
  if (jobIds.length === 0) return { error: "Choose at least one position." };
  const jobs = await prisma.jobPosting.findMany({ where: { id: { in: jobIds }, organizationId: me.organizationId, status: "OPEN" } });
  if (jobs.length === 0) return { error: "Those positions are no longer open." };
  const had = new Set((await prisma.applicant.findMany({ where: { profileId: profile.id }, select: { jobId: true } })).map((a) => a.jobId));
  const fresh = jobs.filter((j) => !had.has(j.id));
  if (fresh.length === 0) return { error: "You already applied for these positions." };
  await prisma.applicant.createMany({
    data: fresh.map((j) => ({ organizationId: me.organizationId, jobId: j.id, profileId: profile.id, name: me.name, email: me.email, phone: profile.phone, source: "Careers page" })),
    skipDuplicates: true,
  });
  await shareGlobalAttempts(profile.id); // exams they already took that apply to every position carry over
  await audit(me.id, "portal.applied", "Applicant", undefined, { jobs: fresh.map((j) => j.title) }, me.organizationId);
  await advanceIfComplete(profile.id);
  done();
  return { ok: `Applied for ${fresh.length} position${fresh.length === 1 ? "" : "s"}.` };
}

// The application must be mine, and the exam must be one of its exams whose earlier exams are already taken.
async function examContext(applicantId: string, examId: string) {
  const { me, profile } = await myProfile();
  const app = await prisma.applicant.findFirst({ where: { id: applicantId, profileId: profile.id, organizationId: me.organizationId }, include: { attempts: true } });
  if (!app) return null;
  const exams = await examsForJob(me.organizationId, app.jobId);
  const i = exams.findIndex((e) => e.id === examId);
  if (i < 0) return null;
  const submitted = new Set(app.attempts.filter((t) => t.submittedAt).map((t) => t.examId));
  const unlocked = exams.slice(0, i).every((e) => submitted.has(e.id));
  return { me, profile, app, exam: exams[i], unlocked, attempt: app.attempts.find((t) => t.examId === examId) ?? null };
}

// Starts (or restarts) the exam and hands the questions to this browser window. The questions are sent only here, never
// inside the page itself, so reloading the page can never show them again. Every start gets a new random order.
// The clock keeps running from the very first start: leaving and coming back does not give more time.
export async function startExam(applicantId: string, examId: string, lang: string, oath = false): Promise<RunResult> {
  const c = await examContext(applicantId, examId);
  if (!c) return { error: "Exam not found." };
  if (!c.profile.resumeKey || !c.profile.idKey) return { error: "Upload your resume and valid ID first." };
  if (!c.unlocked) return { error: "Take the earlier exam first." };
  if (c.app.stage === "HIRED" || c.app.stage === "REJECTED") return { error: "This application is closed." };
  if (c.attempt?.submittedAt) return { done: true };
  // The commitment exam cannot start until the applicant has taken the oath. The server checks it, not only the page.
  if (c.exam.kind === "COMMITMENT" && !c.attempt && oath !== true) return { error: "Tick the oath box before you start this exam." };
  let attempt = c.attempt;
  if (!attempt) {
    // Questions without a Tagalog version get one now. A person who chose English never waits for it; a person who chose Tagalog waits
    // at most 15 seconds, and any question that is not ready yet shows in English.
    const translating = ensureTagalog(examId);
    if (asLang(lang) === "tl") await Promise.race([translating, new Promise((r) => setTimeout(r, 15_000))]);
    // The unique (applicant, exam) pair means a double click cannot start two attempts.
    attempt = await prisma.examAttempt.create({ data: { applicantId, examId, lang: asLang(lang), oathAt: c.exam.kind === "COMMITMENT" ? new Date() : null } }).catch(() => null)
      ?? await prisma.examAttempt.findUnique({ where: { applicantId_examId: { applicantId, examId } } });
    if (!attempt) return { error: "Could not start the exam. Try again." };
    await audit(c.me.id, "portal.exam_started", "Exam", examId, { applicantId, ...(c.exam.kind === "COMMITMENT" ? { oath: true } : {}) }, c.me.organizationId);
  }
  if (timeIsUp(attempt.startedAt, c.exam.timeLimitMin)) {
    await finalizeAttempt(attempt.id, examId, {});
    await shareGlobalAttempts(c.profile.id);
    return { done: true };
  }
  // A run that is still open (a second window, a double click) counts as a leave: this window gets a new order and the old one is cut off.
  const round = attempt.runToken ? attempt.round + 1 : attempt.round;
  const token = randomUUID();
  await prisma.examAttempt.update({ where: { id: attempt.id }, data: { runToken: token, round, ...(attempt.runToken ? { leaves: { increment: 1 } } : {}) } });
  const rows = await prisma.examQuestion.findMany({ where: { examId }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }], select: { id: true, text: true, textTl: true, options: true } });
  return { run: { token, lang: asLang(attempt.lang), secondsLeft: Math.max(0, secondsLeft(attempt.startedAt, c.exam.timeLimitMin)), questions: questionsFor(rows, token) } }; // a fresh random token per Start is the seed: every Start is a new order
}

// The person left the exam screen (hid the tab, minimized, switched window). The run ends; the next start is a new random order.
export async function leaveExam(applicantId: string, examId: string, token: string, reason: string): Promise<FormState> {
  const c = await examContext(applicantId, examId);
  if (!c?.attempt || c.attempt.submittedAt) return {};
  if (await closeRun(c.attempt.id, token)) {
    await audit(c.me.id, "portal.exam_left", "Exam", examId, { applicantId, reason: String(reason).slice(0, 20) }, c.me.organizationId);
  }
  return { ok: "Reset." };
}

// Answers arrive as q_<questionId> = option index. Time is checked on the server: past the limit plus a short grace, the answers are discarded.
// Only the window that holds the current run can send answers; after a reset the old window's answers are refused.
export async function submitExam(applicantId: string, examId: string, token: string, _: FormState, form: FormData): Promise<FormState> {
  const c = await examContext(applicantId, examId);
  if (!c?.attempt) return { error: "Start the exam first." };
  if (c.attempt.submittedAt) redirect("/apply");
  if (!c.attempt.runToken || c.attempt.runToken !== token) return { error: "This exam window was reset because the exam screen was left. Reload the page and start again." };
  const answers: Record<string, number> = {};
  for (const [k, v] of form.entries()) {
    const n = Number(v);
    if (k.startsWith("q_") && Number.isInteger(n) && n >= 0) answers[k.slice(2)] = n;
  }
  const late = timeIsUp(c.attempt.startedAt, c.exam.timeLimitMin);
  await finalizeAttempt(c.attempt.id, examId, late ? {} : answers);
  await shareGlobalAttempts(c.profile.id);
  await audit(c.me.id, "portal.exam_submitted", "Exam", examId, { applicantId, late, leaves: c.attempt.leaves }, c.me.organizationId);
  await advanceIfComplete(c.profile.id);
  done();
  redirect("/apply");
}

// Resume and valid ID. Real type is read from the file's bytes, never from its name.
export async function uploadDocuments(_: FormState, form: FormData): Promise<FormState> {
  const { me, profile } = await myProfile();
  const data: { resumeKey?: string; resumeName?: string; resumeMime?: string; idKey?: string; idName?: string; idMime?: string } = {};
  for (const [field, label] of [["resume", "resume"], ["validId", "valid ID"]] as const) {
    const file = form.get(field);
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_BYTES) return { error: `Your ${label} is too large. The limit is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffType(bytes);
    if (!type) return { error: `Your ${label} must be a PDF, PNG or JPEG file.` };
    const key = await saveFile(me.organizationId, bytes);
    if (field === "resume") Object.assign(data, { resumeKey: key, resumeName: safeName(file.name), resumeMime: type.mime });
    else Object.assign(data, { idKey: key, idName: safeName(file.name), idMime: type.mime });
  }
  if (!Object.keys(data).length) return { error: "Choose a file to upload." };
  const updated = await prisma.applicantProfile.update({ where: { id: profile.id }, data });
  if (!updated.resumeKey || !updated.idKey) {
    done();
    return { ok: "Saved. Upload the other document too." };
  }
  await audit(me.id, "portal.documents", "ApplicantProfile", profile.id, undefined, me.organizationId);
  await advanceIfComplete(profile.id);
  done();
  return { ok: "Both documents received. You can now take the exams." };
}

// One 201 file requirement. Only open once HR has moved the application to "For requirements". At most DOCUMENT_MAX_MB (10) per file.
export async function uploadRequirement(title: string, _: FormState, form: FormData): Promise<FormState> {
  const { me, profile } = await myProfile();
  const stages = (await prisma.applicant.findMany({ where: { profileId: profile.id }, select: { stage: true } })).map((x) => x.stage);
  if (!canUploadRequirements(stages)) return { error: "Uploading your requirements is not open yet. HR will tell you when you can." };
  if (!isApplicantRequirement(title)) return { error: "That is not a requirement on the list." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  if (file.size > MAX_BYTES) return { error: `That file is too large. The limit is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) return { error: "Only PDF, PNG or JPEG files are accepted." };

  const before = await requirementChecklist(profile.id);
  const key = await saveFile(me.organizationId, bytes);
  const prev = await prisma.applicantDocument.findFirst({ where: { profileId: profile.id, title }, orderBy: { version: "desc" } });
  await prisma.$transaction([
    prisma.applicantDocument.updateMany({ where: { profileId: profile.id, title, archivedAt: null }, data: { archivedAt: new Date() } }),
    prisma.applicantDocument.create({ data: { organizationId: me.organizationId, profileId: profile.id, title, fileName: safeName(file.name), mimeType: type.mime, sizeBytes: file.size, storageKey: key, version: (prev?.version ?? 0) + 1 } }),
  ]);
  await audit(me.id, "portal.requirement_uploaded", "ApplicantProfile", profile.id, { title }, me.organizationId);
  const after = await requirementChecklist(profile.id);
  if (after.complete && !before.complete) {
    // Tell HR once, when the checklist becomes complete.
    const hr = await prisma.user.findMany({ where: { organizationId: me.organizationId, active: true, role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN] } } }, select: { id: true } });
    const app = await prisma.applicant.findFirst({ where: { profileId: profile.id, stage: { in: ["REQUIREMENTS", "OFFER"] } }, select: { jobId: true } });
    await notify(me.organizationId, hr.map((u) => u.id), { title: `${me.name} uploaded every required 201 file document`, href: app ? `/recruitment/${app.jobId}` : "/recruitment" });
  }
  done();
  return { ok: `${title} saved. ${after.done} of ${after.total} required documents are in.` };
}

// Orientation day: the applicant reads each company policy and signs it with a drawn signature, like an employee does.
// Signing opens on the orientation day HR scheduled. Each signature keeps the hash of the exact text that was signed.
export async function signApplicantPolicy(policyId: string, _: FormState, form: FormData): Promise<FormState> {
  const { me, profile } = await myProfile();
  const parsed = z
    .object({
      signedName: z.string().trim().min(3, "Type your full name.").max(120),
      signature: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Draw your signature in the box.").max(700_000, "The signature is too large. Clear it and sign again."),
      agree: z.literal("on", { error: "Tick the box to confirm you have read and agree." }),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const tz = (await getOrgSettings(me.organizationId)).timezone;
  const scheduled = await prisma.applicant.findMany({ where: { profileId: profile.id, orientationAt: { not: null } }, select: { orientationAt: true } });
  if (!orientationOpen(scheduled.map((x) => x.orientationAt!), new Date(), tz)) return { error: "Orientation day has not started. You can sign the policies on the day HR scheduled." };
  const policy = await prisma.policyDocument.findFirst({ where: { id: policyId, organizationId: me.organizationId, archivedAt: null, requiresSignature: true } });
  if (!policy) return { error: "This policy was replaced by a newer version. Open the current one." };
  if (await prisma.applicantPolicySignature.findUnique({ where: { policyId_profileId: { policyId, profileId: profile.id } } })) return { error: "You already signed this policy." };
  const bytes = new Uint8Array(Buffer.from(parsed.data.signature.split(",")[1], "base64"));
  if (sniffType(bytes)?.mime !== "image/png" || bytes.length < 200) return { error: "Draw your signature in the box." };
  const ev = await requestEvidence();
  const sig = await prisma.applicantPolicySignature.create({
    data: { profileId: profile.id, policyId, signedName: parsed.data.signedName, signatureKey: await saveFile(me.organizationId, bytes), contentHash: policy.contentHash, ipAddress: ev.ipAddress, userAgent: ev.userAgent },
  });
  await audit(me.id, "portal.policy_signed", "ApplicantPolicySignature", sig.id, { policyId, title: policy.title, version: policy.version, contentHash: policy.contentHash }, me.organizationId);
  const left = (await requiredPolicies(me.organizationId, profile.id)).filter((p) => !p.signed).length;
  if (left === 0) {
    const hr = await prisma.user.findMany({ where: { organizationId: me.organizationId, active: true, role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN] } } }, select: { id: true } });
    await notify(me.organizationId, hr.map((u) => u.id), { title: `${me.name} signed every company policy at orientation`, href: "/recruitment" });
  }
  done();
  revalidatePath(`/apply/policies/${policyId}`);
  return { ok: left === 0 ? "Signed. You have signed every policy. Thank you!" : `Signed. ${left} more to sign.` };
}
