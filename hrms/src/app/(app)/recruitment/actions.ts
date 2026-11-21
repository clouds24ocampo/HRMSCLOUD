"use server";

import { DEFAULT_TIMEZONE } from "@/lib/locale";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requirePerm, requireUser } from "@/lib/auth";
import { createEmployee, nextEmployeeNo } from "@/lib/employees";
import { ROLES, ROLE_SEED } from "@/lib/roles";
import { dbDate } from "@/lib/time";
import { deleteStored, saveFile } from "@/lib/documents";
import { notify } from "@/lib/notify";
import { copyToEmployee201, moveSignaturesToEmployee } from "@/lib/requirements";
import { hiringState } from "@/lib/hiring";
import { ENGAGEMENT_LABEL, isEngagement, TEMPLATES_FOR, type Engagement } from "@/lib/hiring-pipeline";
import { issueApplicantContract, voidApplicantContract } from "@/lib/applicant-contract";
import type { ContractTemplateKey } from "@/lib/contract-templates";
import { pdsAddress, pdsBirthDate, pdsGovNumbers, pdsMobile, sanitizePds } from "@/lib/pds";
import { buildPdsPdf } from "@/lib/pds-pdf";
import { PDS_TITLE } from "@/lib/pds-config";
import { FILE_201_CATEGORY } from "@/lib/file201";
import { translateToTagalog } from "@/lib/translate";
import type { FormState } from "@/app/login/actions";

// Recruitment is HR-only (requireUser("/recruitment") applies the page rule to every action).
const STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "REQUIREMENTS", "OFFER", "REJECTED"] as const; // HIRED only through the Hire action
const opt = z.string().optional().transform((v) => v?.trim() || undefined);
const done = (jobId?: string) => {
  revalidatePath("/recruitment");
  if (jobId) revalidatePath(`/recruitment/${jobId}`);
};

export async function addJob(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const parsed = z
    .object({ title: z.string().trim().min(3, "Enter the job title.").max(80), duties: opt, openings: z.coerce.number().int().min(1, "At least 1 opening.").max(500), departmentId: opt, positionId: opt, description: opt })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.departmentId && !(await prisma.department.findFirst({ where: { id: d.departmentId, organizationId: me.organizationId } }))) return { error: "Choose a department from the list." };
  if (d.positionId && !(await prisma.position.findFirst({ where: { id: d.positionId, organizationId: me.organizationId } }))) return { error: "Choose a position from the list." };
  const duties = d.duties?.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12);
  // Applicants can read the role in Tagalog: translated by the system, best effort (blank if the service is unavailable).
  const tl = await translateToTagalog([...(d.description ? [d.description] : []), ...(duties ?? [])]);
  const [descriptionTl, ...dutiesTl] = d.description && tl ? tl : [null, ...(tl ?? [])];
  const job = await prisma.jobPosting.create({
    data: {
      organizationId: me.organizationId, title: d.title, openings: d.openings, departmentId: d.departmentId, positionId: d.positionId, description: d.description, createdById: me.id,
      descriptionTl: descriptionTl ?? null, duties: duties?.join("\n") ?? null, dutiesTl: duties && tl && dutiesTl.length === duties.length ? dutiesTl.join("\n") : null,
    },
  });
  await audit(me.id, "job.created", "JobPosting", job.id, { title: job.title }, me.organizationId);
  done();
  redirect(`/recruitment/${job.id}`);
}

export async function setJobStatus(id: string, status: "OPEN" | "CLOSED") {
  const me = await requireUser("/recruitment");
  const job = await prisma.jobPosting.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!job) return;
  await prisma.jobPosting.update({ where: { id }, data: { status } });
  await audit(me.id, status === "OPEN" ? "job.reopened" : "job.closed", "JobPosting", id, { title: job.title }, me.organizationId);
  done(id);
}

export async function addApplicant(jobId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const parsed = z
    .object({ name: z.string().trim().min(2, "Enter the applicant's name.").max(80), email: z.union([z.literal(""), z.email("Enter a valid email.")]).optional(), phone: opt, source: opt })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const job = await prisma.jobPosting.findFirst({ where: { id: jobId, organizationId: me.organizationId } });
  if (!job) return { error: "Job not found." };
  const email = parsed.data.email?.toLowerCase() || undefined;
  // The same person should not be entered twice for the same job.
  if (email && (await prisma.applicant.findFirst({ where: { jobId, organizationId: me.organizationId, email } }))) return { error: "This email is already an applicant for this job." };
  const a = await prisma.applicant.create({ data: { organizationId: me.organizationId, jobId, name: parsed.data.name, email, phone: parsed.data.phone, source: parsed.data.source } });
  await audit(me.id, "applicant.added", "Applicant", a.id, { job: job.title }, me.organizationId);
  done(jobId);
  return { ok: `${a.name} added.` };
}

export async function moveApplicant(id: string, stage: (typeof STAGES)[number]): Promise<FormState> {
  const me = await requireUser("/recruitment");
  if (!STAGES.includes(stage)) return { error: "Unknown stage." };
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId }, include: { profile: { select: { userId: true } } } });
  if (!a) return { error: "Applicant not found." };
  if (a.stage === "HIRED") return { error: "This applicant is already hired." };
  await prisma.$transaction([
    prisma.applicant.update({ where: { id }, data: { stage } }),
    prisma.applicantNote.create({ data: { organizationId: me.organizationId, applicantId: id, stage, text: `Moved to ${stage.toLowerCase()}`, createdById: me.id } }),
  ]);
  await audit(me.id, "applicant.moved", "Applicant", id, { from: a.stage, to: stage }, me.organizationId);
  // For requirements opens the 201 file upload for the applicant, so tell them.
  if (stage === "REQUIREMENTS" && a.profile) await notify(me.organizationId, [a.profile.userId], { title: "You passed the interview. Please upload your 201 file requirements.", href: "/apply" });
  done(a.jobId);
  return { ok: stage === "REQUIREMENTS" ? "Moved. The applicant can now upload the 201 file requirements." : "Moved." };
}

export async function addApplicantNote(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const text = z.string().trim().min(2, "Write a note.").max(1000).safeParse(form.get("text"));
  if (!text.success) return { error: text.error.issues[0].message };
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!a) return { error: "Applicant not found." };
  await prisma.applicantNote.create({ data: { organizationId: me.organizationId, applicantId: id, stage: a.stage, text: text.data, createdById: me.id } });
  done(a.jobId);
  return { ok: "Note saved." };
}

export async function setInterview(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const when = z.string().min(1, "Choose the date and time.").safeParse(form.get("interviewAt"));
  if (!when.success) return { error: when.error.issues[0].message };
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!a) return { error: "Applicant not found." };
  // The browser sends local time without a zone; it is read in the organization's timezone.
  const settings = await prisma.orgSettings.findUnique({ where: { organizationId: me.organizationId } });
  const at = new Date(`${when.data}:00${offsetOf(settings?.timezone ?? DEFAULT_TIMEZONE, when.data)}`);
  if (Number.isNaN(at.getTime())) return { error: "That date and time is not valid." };
  await prisma.$transaction([
    prisma.applicant.update({ where: { id }, data: { interviewAt: at, stage: a.stage === "APPLIED" || a.stage === "SCREENING" ? "INTERVIEW" : a.stage } }),
    prisma.applicantNote.create({ data: { organizationId: me.organizationId, applicantId: id, stage: "INTERVIEW", text: `Interview set for ${when.data.replace("T", " ")}`, createdById: me.id } }),
  ]);
  done(a.jobId);
  return { ok: "Interview saved." };
}

// Orientation day: the applicant reads and signs the company policies and the privacy policy. Leave the date empty to cancel it.
export async function setOrientation(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId }, include: { profile: { select: { userId: true } } } });
  if (!a) return { error: "Applicant not found." };
  if (a.stage === "HIRED") return { error: "This applicant is already hired." };
  const raw = String(form.get("orientationAt") ?? "").trim();
  let at: Date | null = null;
  if (raw) {
    const settings = await prisma.orgSettings.findUnique({ where: { organizationId: me.organizationId } });
    at = new Date(`${raw}:00${offsetOf(settings?.timezone ?? DEFAULT_TIMEZONE, raw)}`);
    if (Number.isNaN(at.getTime())) return { error: "That date and time is not valid." };
  }
  await prisma.$transaction([
    prisma.applicant.update({ where: { id }, data: { orientationAt: at } }),
    prisma.applicantNote.create({ data: { organizationId: me.organizationId, applicantId: id, stage: a.stage, text: at ? `Orientation day set for ${raw.replace("T", " ")}` : "Orientation day cancelled", createdById: me.id } }),
  ]);
  await audit(me.id, at ? "applicant.orientation_set" : "applicant.orientation_cancelled", "Applicant", id, { at: at?.toISOString() ?? null }, me.organizationId);
  if (at && a.profile) await notify(me.organizationId, [a.profile.userId], { title: `Your orientation day is set for ${raw.replace("T", " ")}. You will read and sign the company policies.`, href: "/apply" });
  done(a.jobId);
  return { ok: at ? "Orientation day saved. The applicant was told." : "Orientation day cancelled." };
}

// "+08:00" style offset of a timezone on a given local date-time (good for zones without daylight saving; close enough otherwise).
function offsetOf(tz: string, local: string): string {
  const probe = new Date(`${local}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(probe);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const m = /GMT([+-]\d{2}:\d{2})?/.exec(raw);
  return m?.[1] ?? "+00:00";
}

// The applicant becomes an employee. No retyping: name, email and phone come over, and the job's department and position are the defaults.
export async function hireApplicant(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("/recruitment", "recruitment.hire");
  const parsed = z
    .object({
      hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the hire date."),
      departmentId: opt, positionId: opt, managerId: opt, shiftId: opt,
      createLogin: z.string().optional(), password: z.string().optional(),
      engagement: opt, override: z.string().optional(), overrideReason: opt,
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId }, include: { job: true, profile: true } });
  if (!a) return { error: "Applicant not found." };
  if (a.stage === "HIRED") return { error: "This applicant is already hired." };
  if (a.stage === "REJECTED") return { error: "Move this applicant out of Rejected first." };

  const orgId = me.organizationId;
  // The whole road must be walked: account, exams, interview, requirements, orientation, signed contract. HR or Administrator may hire
  // before that only on purpose: they tick "Hire anyway" and write why. The reason is saved on the applicant and in the audit log.
  const st = await hiringState(orgId, id);
  const override = d.override === "on";
  if (st && !st.pipeline.ready) {
    if (!override) return { error: `Not ready to hire yet. Still missing: ${st.pipeline.missing.join(", ")}. Finish these steps, or tick "Hire anyway" and write the reason.` };
    if ((d.overrideReason ?? "").length < 5) return { error: "Write the reason for hiring before every step is done (at least 5 letters)." };
  }
  // The signed contract decides the account type. Without one (hired anyway), HR chooses.
  const engagement: Engagement = st?.engagement ?? (isEngagement(d.engagement) ? d.engagement : "EMPLOYEE");
  const signedContract = st?.contract?.status === "SIGNED" ? st.contract : null;
  if (d.departmentId && !(await prisma.department.findFirst({ where: { id: d.departmentId, organizationId: orgId, archivedAt: null } }))) return { error: "Choose a department from the list." };
  if (d.positionId && !(await prisma.position.findFirst({ where: { id: d.positionId, organizationId: orgId, archivedAt: null } }))) return { error: "Choose a position from the list." };
  if (d.managerId && !(await prisma.employee.findFirst({ where: { id: d.managerId, organizationId: orgId, status: { not: "SEPARATED" } } }))) return { error: "Choose a supervisor from the list." };
  if (d.shiftId && !(await prisma.shiftTemplate.findFirst({ where: { id: d.shiftId, organizationId: orgId, archivedAt: null } }))) return { error: "Choose a shift from the list." };
  const workDays = form.getAll("days").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (d.shiftId && workDays.length === 0) return { error: "Choose the days this person works." };

  let login: { email: string; passwordHash: string; roleId: string } | null = null;
  // Someone who applied through the careers page already has an account: it becomes their employee login, no new one.
  if (d.createLogin === "on" && !a.profile) {
    if (!a.email) return { error: "A sign-in needs the applicant's email. Add it to the applicant first." };
    if ((d.password ?? "").length < 10) return { error: "Temporary password needs at least 10 characters." };
    if (await prisma.user.findUnique({ where: { email: a.email.toLowerCase() } })) return { error: "This email already has a sign-in." };
    const role = await prisma.role.findUnique({ where: { key: engagement === "SUBCONTRACTOR" ? ROLES.SUBCONTRACTOR : ROLES.EMPLOYEE } });
    if (!role) return { error: "System is not set up yet. Run the database seed." };
    login = { email: a.email.toLowerCase(), passwordHash: await bcrypt.hash(d.password!, 12), roleId: role.id };
  }

  const [first, ...rest] = a.name.trim().split(/\s+/);
  const emp = await prisma.$transaction(async (tx) => {
    let user = login ? await tx.user.create({ data: { organizationId: orgId, name: a.name, email: login.email, passwordHash: login.passwordHash, roleId: login.roleId, mustChangePassword: true } }) : null;
    if (a.profile) {
      const role = await tx.role.findUnique({ where: { key: engagement === "SUBCONTRACTOR" ? ROLES.SUBCONTRACTOR : ROLES.EMPLOYEE } });
      if (!role) throw new Error(`${ENGAGEMENT_LABEL[engagement]} role is missing. Run the database seed.`);
      user = await tx.user.update({ where: { id: a.profile.userId }, data: { roleId: role.id } }); // applicant account -> employee or subcontractor account
    }
    const created = await createEmployee(tx, orgId, me.id, {
      firstName: first, lastName: rest.join(" ") || "-", email: a.email, phone: a.phone,
      departmentId: d.departmentId ?? a.job.departmentId, positionId: d.positionId ?? a.job.positionId, managerId: d.managerId,
      hireDate: dbDate(d.hireDate), userId: user?.id,
      employeeNo: a.profile?.applicantNo, // the applicant number carries over
    });
    if (d.shiftId) await tx.regularSchedule.create({ data: { organizationId: orgId, employeeId: created.id, shiftId: d.shiftId, workDays, effectiveFrom: dbDate(d.hireDate), createdById: me.id } });
    await tx.applicant.update({ where: { id }, data: { stage: "HIRED", employeeId: created.id } });
    if (a.profile) {
      await copyToEmployee201(tx, a.profile, created.id, me.id); // their requirement files become the employee 201 file
      await moveSignaturesToEmployee(tx, a.profile, created.id); // and their signed policies are theirs as an employee
      // The Personal Data Sheet follows the person: it is linked to the new employee, and the employee record is filled from it
      // (address, birth date, mobile number, government numbers) without replacing anything HR already typed.
      const sheet = await tx.personalDataSheet.findUnique({ where: { profileId: a.profile.id } });
      if (sheet) {
        const pd = sanitizePds(sheet.data);
        const gov = pdsGovNumbers(pd);
        const born = pdsBirthDate(pd);
        await tx.personalDataSheet.update({ where: { id: sheet.id }, data: { employeeId: created.id } });
        await tx.employee.update({
          where: { id: created.id },
          data: {
            address: pdsAddress(pd) || undefined, birthDate: born ? dbDate(born) : undefined, ...(created.phone ? {} : { phone: pdsMobile(pd) ?? undefined }),
            sssNo: gov.sss, philhealthNo: gov.philhealth, tinNo: gov.tin, pagibigNo: gov.pagibig,
          },
        });
      }
      // The person is an employee now: their other open applications are closed, so they leave the applicant lists.
      const others = await tx.applicant.findMany({ where: { profileId: a.profile.id, id: { not: id }, stage: { notIn: ["HIRED", "REJECTED"] } }, select: { id: true } });
      if (others.length) {
        await tx.applicant.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { stage: "REJECTED" } });
        await tx.applicantNote.createMany({ data: others.map((o) => ({ organizationId: orgId, applicantId: o.id, stage: "REJECTED" as const, text: `Closed: hired for ${a.job.title}`, createdById: me.id })) });
      }
    }
    if (signedContract) {
      await tx.contract.create({
        data: {
          organizationId: orgId, employeeId: created.id, templateKey: signedContract.templateKey, title: signedContract.title, body: signedContract.body, status: "SIGNED",
          issuedAt: signedContract.issuedAt, issuedById: signedContract.issuedById, signedAt: signedContract.signedAt, signatureIp: signedContract.signatureIp,
          signatureNote: `Signed before hiring by ${signedContract.signedName ?? a.name}, with a drawn signature on file (applicant ${a.profile?.applicantNo ?? "no."}).`, createdById: me.id,
        },
      });
    }
    await tx.applicantNote.create({ data: { organizationId: orgId, applicantId: id, stage: "HIRED", text: `Hired as ${ENGAGEMENT_LABEL[engagement]} ${created.employeeNo}${st && !st.pipeline.ready ? `. Hired before every step was done (${st.pipeline.missing.join(", ")}): ${d.overrideReason}` : ""}`, createdById: me.id } });
    // Close the job once every opening is filled.
    const hired = await tx.applicant.count({ where: { jobId: a.jobId, stage: "HIRED" } });
    if (hired >= a.job.openings) await tx.jobPosting.update({ where: { id: a.jobId }, data: { status: "CLOSED" } });
    return created;
  });
  // A printable copy of the submitted Personal Data Sheet goes into the 201 file. If it cannot be made, the hire still stands.
  if (a.profile) {
    try {
      const sheet = await prisma.personalDataSheet.findUnique({ where: { profileId: a.profile.id } });
      const have = await prisma.employeeDocument.count({ where: { employeeId: emp.id, title: PDS_TITLE, archivedAt: null } });
      if (sheet?.submittedAt && !have) {
        const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
        const pdf = await buildPdsPdf(sanitizePds(sheet.data), { company: org?.name ?? "", applicantNo: a.profile.applicantNo, name: a.name, submittedOn: sheet.submittedAt.toISOString().slice(0, 10) });
        const key = await saveFile(orgId, new Uint8Array(pdf));
        await prisma.employeeDocument.create({ data: { organizationId: orgId, employeeId: emp.id, category: FILE_201_CATEGORY, title: PDS_TITLE, fileName: `Personal Data Sheet - ${a.name}.pdf`.replace(/[^\w.\- ()]+/g, "_"), mimeType: "application/pdf", sizeBytes: pdf.length, storageKey: key, uploadedById: me.id } });
      }
    } catch (e) {
      console.error("Could not file the personal data sheet PDF", e instanceof Error ? e.message : e);
    }
  }
  await audit(me.id, "applicant.hired", "Applicant", id, { employeeId: emp.id, employeeNo: emp.employeeNo, engagement, contractSigned: !!signedContract, ...(st && !st.pipeline.ready ? { overrode: st.pipeline.missing, reason: d.overrideReason } : {}) }, orgId);
  done(a.jobId);
  revalidatePath("/employees");
  return { ok: `${a.name} is now ${ENGAGEMENT_LABEL[engagement].toLowerCase()} ${emp.employeeNo}. Their onboarding checklist is ready.` };
}

// Takes one application away (the person stays, with their other applications). A hired applicant is kept: the employee record points back to it.
export async function deleteApplication(id: string): Promise<FormState> {
  const me = await requirePerm("/recruitment", "recruitment.hire");
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId }, include: { job: { select: { title: true } } } });
  if (!a) return { error: "Applicant not found." };
  if (a.stage === "HIRED") return { error: "This applicant was hired and is now an employee. Their record cannot be deleted here." };
  const sigs = await prisma.applicantContract.findMany({ where: { applicantId: id }, select: { signatureKey: true } });
  await prisma.applicant.delete({ where: { id } }); // notes, exam results and contracts go with it
  for (const c of sigs) await deleteStored(c.signatureKey, me.organizationId);
  await audit(me.id, "applicant.application_deleted", "Applicant", id, { name: a.name, job: a.job.title }, me.organizationId);
  done(a.jobId);
  revalidatePath("/recruitment/applicants");
  return { ok: "Removed." };
}

// Deletes the whole person: every application, exam result, uploaded file and their applicant sign-in.
// Someone who was hired is never deleted from here.
export async function deleteApplicantPerson(id: string): Promise<FormState> {
  const me = await requirePerm("/recruitment", "recruitment.hire");
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId }, include: { profile: true } });
  if (!a) return { error: "Applicant not found." };
  const scope = a.profileId ? { profileId: a.profileId } : { id: a.id };
  if (await prisma.applicant.count({ where: { organizationId: me.organizationId, ...scope, stage: "HIRED" } })) return { error: "This person was hired and is now an employee. Their record cannot be deleted here." };
  const p = a.profile;
  const files = p ? await prisma.applicantDocument.findMany({ where: { profileId: p.id }, select: { storageKey: true } }) : [];
  const sigs = await prisma.applicantContract.findMany({ where: { organizationId: me.organizationId, applicant: scope }, select: { signatureKey: true } });
  await prisma.$transaction(async (tx) => {
    await tx.applicant.deleteMany({ where: { organizationId: me.organizationId, ...scope } });
    if (p) {
      await tx.applicantProfile.delete({ where: { id: p.id } });
      await tx.user.delete({ where: { id: p.userId } }); // sessions and notifications go with it
    }
  });
  if (p) { await deleteStored(p.resumeKey, me.organizationId); await deleteStored(p.idKey, me.organizationId); for (const f of files) await deleteStored(f.storageKey, me.organizationId); }
  for (const c of sigs) await deleteStored(c.signatureKey, me.organizationId);
  await audit(me.id, "applicant.deleted", "Applicant", id, { name: a.name, applicantNo: p?.applicantNo }, me.organizationId);
  done(a.jobId);
  revalidatePath("/recruitment/applicants");
  return { ok: "Deleted." };
}

// Makes a sign-in for an applicant HR added by hand, so they can take the exams, upload their documents, attend orientation and sign.
// The temporary password is shown once, to HR; the applicant must choose their own at the first sign-in.
const TEMP_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const tempPassword = () => Array.from(randomBytes(12), (b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]).join("");

export async function createApplicantAccount(id: string): Promise<FormState & { email?: string; password?: string }> {
  const me = await requireUser("/recruitment");
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!a) return { error: "Applicant not found." };
  if (a.profileId) return { error: "This applicant already has an account." };
  if (a.stage === "HIRED" || a.stage === "REJECTED") return { error: "Reopen this applicant before creating an account." };
  const email = a.email?.trim().toLowerCase();
  if (!email || !z.email().safeParse(email).success) return { error: "Add the applicant's email address first. It is their sign-in." };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "This email already has an account in the system." };
  const seed = ROLE_SEED.find((r) => r.key === ROLES.APPLICANT)!;
  const role = await prisma.role.upsert({ where: { key: seed.key }, update: {}, create: seed });
  const password = tempPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7302)`; // the same lock as sign-up: two people must not draw the same applicant number
    const u = await tx.user.create({ data: { organizationId: me.organizationId, name: a.name, email, passwordHash, roleId: role.id, mustChangePassword: true } });
    const profile = await tx.applicantProfile.create({ data: { organizationId: me.organizationId, userId: u.id, applicantNo: await nextEmployeeNo(tx, me.organizationId), phone: a.phone } });
    // Every application this person has under the same email joins the account.
    await tx.applicant.updateMany({ where: { organizationId: me.organizationId, profileId: null, email: { equals: email, mode: "insensitive" } }, data: { profileId: profile.id } });
  });
  await audit(me.id, "applicant.account_created", "Applicant", id, { email }, me.organizationId);
  done(a.jobId);
  revalidatePath("/recruitment/applicants");
  return { ok: "Account created. Give the applicant these sign-in details. They choose their own password the first time.", email, password };
}

// Sends the contract to the applicant: the account type they are hired into (employee or subcontractor) is decided here.
export async function issueContract(id: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const parsed = z
    .object({
      engagement: z.enum(["EMPLOYEE", "SUBCONTRACTOR"], { error: "Choose Employee or Subcontractor." }),
      templateKey: z.enum(["REGULAR", "PROBATIONARY", "PROJECT_BASED", "CONSULTANT"], { error: "Choose the contract type." }),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the start date."),
      address: opt, pay: z.string().trim().max(120).optional().transform((v) => v || undefined), customBody: opt,
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!(TEMPLATES_FOR[d.engagement] as string[]).includes(d.templateKey)) return { error: "That contract type does not match. Choose one from the list." };
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId }, select: { jobId: true } });
  if (!a) return { error: "Applicant not found." };
  try {
    await issueApplicantContract({
      organizationId: me.organizationId, applicantId: id, engagement: d.engagement, templateKey: d.templateKey as ContractTemplateKey,
      startDate: dbDate(d.startDate), address: d.address, pay: d.pay, customBody: d.customBody, issuedById: me.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not issue the contract." };
  }
  done(a.jobId);
  return { ok: "Contract sent. The applicant can read and sign it in their portal." };
}

export async function cancelContract(contractId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const reason = z.string().trim().min(3, "Write why the contract is cancelled.").max(300).safeParse(form.get("reason"));
  if (!reason.success) return { error: reason.error.issues[0].message };
  const c = await prisma.applicantContract.findFirst({ where: { id: contractId, organizationId: me.organizationId }, select: { applicant: { select: { jobId: true } } } });
  if (!c) return { error: "Contract not found." };
  try {
    await voidApplicantContract({ organizationId: me.organizationId, contractId, reason: reason.data, byId: me.id });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not cancel the contract." };
  }
  done(c.applicant.jobId);
  return { ok: "Contract cancelled. You can issue a new one." };
}
