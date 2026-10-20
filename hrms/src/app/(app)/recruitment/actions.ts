"use server";

import { DEFAULT_TIMEZONE } from "@/lib/locale";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { createEmployee } from "@/lib/employees";
import { ROLES } from "@/lib/roles";
import { dbDate } from "@/lib/time";
import type { FormState } from "@/app/login/actions";

// Recruitment is HR-only (requireUser("/recruitment") applies the page rule to every action).
const STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED"] as const; // HIRED only through the Hire action
const opt = z.string().optional().transform((v) => v?.trim() || undefined);
const done = (jobId?: string) => {
  revalidatePath("/recruitment");
  if (jobId) revalidatePath(`/recruitment/${jobId}`);
};

export async function addJob(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/recruitment");
  const parsed = z
    .object({ title: z.string().trim().min(3, "Enter the job title.").max(80), openings: z.coerce.number().int().min(1, "At least 1 opening.").max(500), departmentId: opt, positionId: opt, description: opt })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.departmentId && !(await prisma.department.findFirst({ where: { id: d.departmentId, organizationId: me.organizationId } }))) return { error: "Choose a department from the list." };
  if (d.positionId && !(await prisma.position.findFirst({ where: { id: d.positionId, organizationId: me.organizationId } }))) return { error: "Choose a position from the list." };
  const job = await prisma.jobPosting.create({ data: { organizationId: me.organizationId, ...d, createdById: me.id } });
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
  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!a) return { error: "Applicant not found." };
  if (a.stage === "HIRED") return { error: "This applicant is already hired." };
  await prisma.$transaction([
    prisma.applicant.update({ where: { id }, data: { stage } }),
    prisma.applicantNote.create({ data: { organizationId: me.organizationId, applicantId: id, stage, text: `Moved to ${stage.toLowerCase()}`, createdById: me.id } }),
  ]);
  await audit(me.id, "applicant.moved", "Applicant", id, { from: a.stage, to: stage }, me.organizationId);
  done(a.jobId);
  return { ok: "Moved." };
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
  const me = await requireUser("/recruitment");
  const parsed = z
    .object({
      hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the hire date."),
      departmentId: opt, positionId: opt, managerId: opt, shiftId: opt,
      createLogin: z.string().optional(), password: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const a = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId }, include: { job: true } });
  if (!a) return { error: "Applicant not found." };
  if (a.stage === "HIRED") return { error: "This applicant is already hired." };
  if (a.stage === "REJECTED") return { error: "Move this applicant out of Rejected first." };

  const orgId = me.organizationId;
  if (d.departmentId && !(await prisma.department.findFirst({ where: { id: d.departmentId, organizationId: orgId, archivedAt: null } }))) return { error: "Choose a department from the list." };
  if (d.positionId && !(await prisma.position.findFirst({ where: { id: d.positionId, organizationId: orgId, archivedAt: null } }))) return { error: "Choose a position from the list." };
  if (d.managerId && !(await prisma.employee.findFirst({ where: { id: d.managerId, organizationId: orgId, status: { not: "SEPARATED" } } }))) return { error: "Choose a supervisor from the list." };
  if (d.shiftId && !(await prisma.shiftTemplate.findFirst({ where: { id: d.shiftId, organizationId: orgId, archivedAt: null } }))) return { error: "Choose a shift from the list." };
  const workDays = form.getAll("days").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (d.shiftId && workDays.length === 0) return { error: "Choose the days this person works." };

  let login: { email: string; passwordHash: string; roleId: string } | null = null;
  if (d.createLogin === "on") {
    if (!a.email) return { error: "A sign-in needs the applicant's email. Add it to the applicant first." };
    if ((d.password ?? "").length < 10) return { error: "Temporary password needs at least 10 characters." };
    if (await prisma.user.findUnique({ where: { email: a.email.toLowerCase() } })) return { error: "This email already has a sign-in." };
    const role = await prisma.role.findUnique({ where: { key: ROLES.EMPLOYEE } });
    if (!role) return { error: "System is not set up yet. Run the database seed." };
    login = { email: a.email.toLowerCase(), passwordHash: await bcrypt.hash(d.password!, 12), roleId: role.id };
  }

  const [first, ...rest] = a.name.trim().split(/\s+/);
  const emp = await prisma.$transaction(async (tx) => {
    const user = login ? await tx.user.create({ data: { organizationId: orgId, name: a.name, email: login.email, passwordHash: login.passwordHash, roleId: login.roleId, mustChangePassword: true } }) : null;
    const created = await createEmployee(tx, orgId, me.id, {
      firstName: first, lastName: rest.join(" ") || "-", email: a.email, phone: a.phone,
      departmentId: d.departmentId ?? a.job.departmentId, positionId: d.positionId ?? a.job.positionId, managerId: d.managerId,
      hireDate: dbDate(d.hireDate), userId: user?.id,
    });
    if (d.shiftId) await tx.regularSchedule.create({ data: { organizationId: orgId, employeeId: created.id, shiftId: d.shiftId, workDays, effectiveFrom: dbDate(d.hireDate), createdById: me.id } });
    await tx.applicant.update({ where: { id }, data: { stage: "HIRED", employeeId: created.id } });
    await tx.applicantNote.create({ data: { organizationId: orgId, applicantId: id, stage: "HIRED", text: `Hired as ${created.employeeNo}`, createdById: me.id } });
    // Close the job once every opening is filled.
    const hired = await tx.applicant.count({ where: { jobId: a.jobId, stage: "HIRED" } });
    if (hired >= a.job.openings) await tx.jobPosting.update({ where: { id: a.jobId }, data: { status: "CLOSED" } });
    return created;
  });
  await audit(me.id, "applicant.hired", "Applicant", id, { employeeId: emp.id, employeeNo: emp.employeeNo }, orgId);
  done(a.jobId);
  revalidatePath("/employees");
  return { ok: `${a.name} is now ${emp.employeeNo}. Their onboarding checklist is ready.` };
}
