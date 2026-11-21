"use server";

import { can } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { createEmployee, assignmentSnapshot } from "@/lib/employees";
import { ROLES } from "@/lib/roles";
import { accountProblem, checkRoleChoice, levelChangeProblem, levelOfPosition } from "@/lib/access";
import { descendantIds, isHr } from "@/lib/scope";
import { getMyEmployee } from "@/lib/employees";
import { dbDate } from "@/lib/time";
import { createChecklist } from "@/lib/checklists";
import { deleteStored } from "@/lib/documents";
import { parsePesos } from "@/lib/money";
import type { FormState } from "@/app/login/actions";

const text = (label: string) => z.string().trim().min(1, `Enter ${label}.`).max(80);
const optional = z.string().trim().max(120).optional().transform((v) => v || undefined);
const pick = z.string().optional().transform((v) => v || undefined);
const STATUSES = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "SEPARATED"] as const;

const createSchema = z.object({
  firstName: text("a first name"),
  lastName: text("a last name"),
  email: optional,
  phone: optional,
  address: optional,
  departmentId: pick,
  positionId: pick,
  managerId: pick,
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the hire date."),
  idMode: z.enum(["auto", "manual"]).optional().default("auto"),
  employeeNo: optional,
  createLogin: z.string().optional(),
  roleId: pick,
  username: z.string().trim().toLowerCase().optional().transform((v) => v || undefined),
  password: z.string().optional(),
  shiftId: pick,
  flexible: z.string().optional(),
});

// Every referenced id must belong to the caller's organization (never trust ids from the browser).
async function checkRefs(orgId: string, r: { departmentId?: string; positionId?: string; managerId?: string }, selfId?: string) {
  if (r.departmentId && !(await prisma.department.findFirst({ where: { id: r.departmentId, organizationId: orgId, archivedAt: null } }))) return "Choose a department from the list.";
  if (r.positionId && !(await prisma.position.findFirst({ where: { id: r.positionId, organizationId: orgId, archivedAt: null } }))) return "Choose a position from the list.";
  if (r.managerId) {
    if (r.managerId === selfId) return "A person cannot supervise themselves.";
    if (!(await prisma.employee.findFirst({ where: { id: r.managerId, organizationId: orgId, status: { not: "SEPARATED" } } }))) return "Choose a supervisor from the list.";
  }
  return null;
}

// Also returns the new employee's id, so the form can offer the 201 file uploads next.
export async function createEmployeeAction(_: FormState, form: FormData): Promise<FormState & { id?: string }> {
  const me = await requireUser("/employees");
  if (!can(me, "employees.add")) return { error: "Only HR can add employees." };
  const parsed = createSchema.safeParse({ ...Object.fromEntries(form), days: undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const bad = await checkRefs(me.organizationId, d);
  if (bad) return { error: bad };
  const salary = parsePesos(form.get("monthlySalary"));
  if (!salary || salary <= 0) return { error: "Enter the monthly salary in pesos, for example 10000.00." };
  const flexible = d.flexible === "on";
  const workDays = form.getAll("days").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (flexible) d.shiftId = undefined; // a flexible schedule has no fixed shift
  else if (d.shiftId && workDays.length === 7) return { error: "Leave at least one day off a week." };
  if (d.shiftId) {
    if (!(await prisma.shiftTemplate.findFirst({ where: { id: d.shiftId, organizationId: me.organizationId, archivedAt: null } }))) return { error: "Choose a shift from the list." };
    if (workDays.length === 0) return { error: "Choose the days this person works." };
  }

  let login: { roleId: string; passwordHash: string; email: string; username: string } | null = null;
  if (d.createLogin === "on") {
    if (!d.email || !z.email().safeParse(d.email).success) return { error: "A login needs a valid email." };
    if (!d.username || !/^[a-z0-9._-]{3,30}$/.test(d.username)) return { error: "Choose a username: 3 to 30 letters, numbers, dots, dashes or underscores." };
    if (await prisma.user.findUnique({ where: { username: d.username } })) return { error: "That username is taken. Choose another." };
    if ((d.password ?? "").length < 10) return { error: "Temporary password needs at least 10 characters." };
    if (!d.roleId) return { error: "Choose a role for the login." };
    // Own-company roles only, admin roles only from a Super Admin, nothing the actor does not hold, and nothing elevated for an entry-level position.
    const choice = await checkRoleChoice(me, d.roleId, { level: await levelOfPosition(d.positionId, me.organizationId) });
    if ("error" in choice) return { error: choice.error };
    const role = choice.role;
    const email = d.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) return { error: "This email already has a login." };
    login = { roleId: role.id, email, username: d.username, passwordHash: await bcrypt.hash(d.password!, 12) };
  }

  const customId = d.idMode === "manual" ? d.employeeNo?.trim() : undefined;
  if (d.idMode === "manual") {
    if (!customId) return { error: "Enter the custom ID number." };
    const exists = await prisma.employee.findUnique({
      where: { organizationId_employeeNo: { organizationId: me.organizationId, employeeNo: customId } },
    });
    if (exists) return { error: `ID number “${customId}” is already assigned to another person.` };
  }

  const emp = await prisma.$transaction(async (tx) => {
    const user = login
      ? await tx.user.create({
          data: { organizationId: me.organizationId, name: `${d.firstName} ${d.lastName}`, email: login.email, username: login.username, passwordHash: login.passwordHash, roleId: login.roleId, mustChangePassword: true },
        })
      : null;

    const created = await createEmployee(tx, me.organizationId, me.id, {
      firstName: d.firstName, lastName: d.lastName, employeeNo: customId, email: d.email ?? null, phone: d.phone ?? null,
      address: d.address ?? null,
      departmentId: d.departmentId, positionId: d.positionId, managerId: d.managerId, hireDate: dbDate(d.hireDate), userId: user?.id, flexible,
    });
    await tx.compensation.create({
      data: { organizationId: me.organizationId, employeeId: created.id, payType: "MONTHLY", rateCents: salary, effectiveFrom: dbDate(d.hireDate), note: "Starting salary", createdById: me.id },
    });
    if (d.shiftId) {
      await tx.regularSchedule.create({
        data: { organizationId: me.organizationId, employeeId: created.id, shiftId: d.shiftId, workDays, effectiveFrom: dbDate(d.hireDate), createdById: me.id },
      });
    }
    return created;
  });
  await audit(me.id, "employee.created", "Employee", emp.id, { employeeNo: emp.employeeNo, login: !!login, flexible, monthlySalaryCents: salary }, me.organizationId);
  revalidatePath("/employees");
  return { id: emp.id, ok: `${emp.firstName} ${emp.lastName} added as ${emp.employeeNo}.${login ? " They sign in with the username “${login.username}” (or their email) and the temporary password." : ""}` };
}

// Switches between a fixed shift and a flexible schedule (own hours, at least 8 a day and 1 day off a week).
export async function setFlexible(employeeId: string, flexible: boolean) {
  const me = await requireUser("/employees");
  if (!can(me, "employees.edit")) return;
  const n = await prisma.employee.updateMany({ where: { id: employeeId, organizationId: me.organizationId }, data: { flexible } });
  if (n.count === 0) return;
  await audit(me.id, "employee.schedule_kind", "Employee", employeeId, { flexible }, me.organizationId);
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/dtr");
}

export async function updateAssignment(employeeId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/employees");
  if (!can(me, "employees.edit")) return { error: "Only HR can change assignments." };
  const parsed = z
    .object({ departmentId: pick, positionId: pick, managerId: pick, status: z.enum(STATUSES), note: optional })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the form and try again." };
  const d = parsed.data;

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, include: { user: { include: { role: true } } } });
  if (!emp) return { error: "Employee not found." };
  // Moving someone to or from Separated turns their sign-in off or on: that needs the same permission, and the same target rules, as Make inactive.
  if (d.status !== emp.status && (d.status === "SEPARATED" || emp.status === "SEPARATED")) {
    if (!can(me, "employees.deactivate")) return { error: "You do not have permission to make employees inactive or active." };
    if (emp.id === (await getMyEmployee(me)).id) return { error: "You cannot make yourself inactive." };
    const blocked = accountProblem(me, emp.user, "change");
    if (blocked) return { error: blocked };
  }
  const bad = await checkRefs(me.organizationId, d, emp.id);
  if (bad) return { error: bad };
  if (d.managerId) {
    const rows = await prisma.employee.findMany({ where: { organizationId: me.organizationId }, select: { id: true, managerId: true } });
    if (descendantIds(rows, emp.id).includes(d.managerId)) return { error: "That would make a loop: the supervisor already reports to this person." };
  }

  const assignmentChanged =
    (d.departmentId ?? null) !== emp.departmentId || (d.positionId ?? null) !== emp.positionId || (d.managerId ?? null) !== emp.managerId;
  const statusChanged = d.status !== emp.status;
  if (!assignmentChanged && !statusChanged) return { ok: "Nothing changed." };
  // An entry-level position cannot keep manager or higher access: HR changes the access first (Super Admin > Users > Access).
  if (emp.userId && (d.positionId ?? null) !== emp.positionId) {
    const problem = await levelChangeProblem(emp.userId, me.organizationId, await levelOfPosition(d.positionId, me.organizationId));
    if (problem) return { error: problem };
  }

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: emp.id },
      data: { departmentId: d.departmentId ?? null, positionId: d.positionId ?? null, managerId: d.managerId ?? null, status: d.status },
    });
    const today = dbDate(new Date().toISOString().slice(0, 10));
    const base = { organizationId: me.organizationId, employeeId: emp.id, effectiveFrom: today, note: d.note, createdById: me.id };
    if (assignmentChanged) {
      await tx.employmentHistory.create({ data: { ...base, change: "ASSIGNMENT", ...(await assignmentSnapshot(tx, me.organizationId, d)) } });
    }
    if (statusChanged) await tx.employmentHistory.create({ data: { ...base, change: "STATUS", status: d.status } });
    if (statusChanged && emp.status === "SEPARATED" && d.status !== "SEPARATED" && emp.userId) {
      await tx.user.update({ where: { id: emp.userId }, data: { active: true } }); // coming back: the sign-in works again
    }
    if (statusChanged && d.status === "SEPARATED") {
      await createChecklist(tx, me.organizationId, emp.id, "OFFBOARDING");
      if (emp.userId) {
        // A separated person can no longer sign in, and any open session ends now.
        await tx.user.update({ where: { id: emp.userId }, data: { active: false } });
        await tx.session.deleteMany({ where: { userId: emp.userId } });
      }
    }
  });
  await audit(me.id, "employee.updated", "Employee", emp.id, { assignmentChanged, from: emp.status, to: d.status }, me.organizationId);
  revalidatePath(`/employees/${emp.id}`);
  return { ok: "Saved. The change is in the history below." };
}

// Edit the person's own details and their sign-in. Assignment and status are changed in updateAssignment (they go to history).
export async function updateDetails(employeeId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/employees");
  if (!can(me, "employees.edit")) return { error: "Only HR can edit employees." };
  const parsed = z
    .object({
      firstName: text("a first name"), lastName: text("a last name"), email: optional, phone: optional, address: optional,
      hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the hire date."),
      username: z.string().trim().toLowerCase().optional().transform((v) => v || undefined),
      newPassword: z.string().optional().transform((v) => v || undefined),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, include: { user: { include: { role: true } } } });
  if (!emp) return { error: "Employee not found." };
  if (d.email && !z.email().safeParse(d.email).success) return { error: "Enter a valid email." };

  const user = emp.user;
  const userData: { name: string; email?: string; username?: string | null; passwordHash?: string; mustChangePassword?: boolean } = { name: `${d.firstName} ${d.lastName}` };
  if (user) {
    // Only a Super Admin may change the sign-in of an admin.
    const blocked = accountProblem(me, user, "change the sign-in of");
    if (blocked) return { error: blocked };
    if (!d.email) return { error: "This person signs in with their email: it cannot be empty." };
    const email = d.email.toLowerCase();
    if (email !== user.email) {
      if (await prisma.user.findUnique({ where: { email } })) return { error: "This email already has a login." };
      userData.email = email;
    }
    if ((d.username ?? null) !== user.username) {
      if (d.username && !/^[a-z0-9._-]{3,30}$/.test(d.username)) return { error: "Username: 3 to 30 letters, numbers, dots, dashes or underscores." };
      if (d.username && (await prisma.user.findUnique({ where: { username: d.username } }))) return { error: "That username is taken." };
      userData.username = d.username ?? null;
    }
    if (d.newPassword) {
      if (d.newPassword.length < 10) return { error: "The temporary password needs at least 10 characters." };
      userData.passwordHash = await bcrypt.hash(d.newPassword, 12);
      userData.mustChangePassword = true; // they choose their own at the next sign-in
    }
  }

  const before = { firstName: emp.firstName, lastName: emp.lastName, email: emp.email, phone: emp.phone, address: emp.address, hireDate: emp.hireDate.toISOString().slice(0, 10), username: user?.username ?? null, loginEmail: user?.email ?? null };
  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: emp.id }, data: { firstName: d.firstName, lastName: d.lastName, email: d.email ?? null, phone: d.phone ?? null, address: d.address ?? null, hireDate: dbDate(d.hireDate) } });
    if (user) {
      await tx.user.update({ where: { id: user.id }, data: userData });
      if (d.newPassword) await tx.session.deleteMany({ where: { userId: user.id } }); // signed out everywhere
    }
  });
  const after = { firstName: d.firstName, lastName: d.lastName, email: d.email ?? null, phone: d.phone ?? null, hireDate: d.hireDate, username: userData.username === undefined ? before.username : userData.username, loginEmail: userData.email ?? before.loginEmail };
  await audit(me.id, "employee.details_updated", "Employee", emp.id, { before, after, passwordReset: !!d.newPassword }, me.organizationId);
  revalidatePath(`/employees/${emp.id}`);
  revalidatePath("/employees");
  return { ok: `Saved.${d.newPassword ? " The temporary password is set; they choose their own at the next sign-in." : ""}` };
}

// Records that make someone part of the company's history. While any exist, the person can only be separated, never deleted.
async function workRecords(employeeId: string, userId: string | null) {
  const c = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: {
      _count: {
        select: {
          timeEvents: true, leaveRequests: true, overtime: true, payslips: true, adjustments: true, reviews: true, goals: true, enrollments: true,
          documents: true, hrRequests: true, prevEmployment: true, dailyReports: true, signatures: true, reports: true, cashAdvances: true, incentives: true, contracts: true,
        },
      },
    },
  });
  const LABEL: Record<string, string> = {
    timeEvents: "time stamps", leaveRequests: "leave requests", overtime: "overtime requests", payslips: "payslips", adjustments: "payroll adjustments", reviews: "reviews",
    goals: "goals", enrollments: "trainings", documents: "documents", hrRequests: "HR requests", prevEmployment: "previous employment", dailyReports: "daily reports",
    signatures: "signed policies", reports: "people reporting to them", cashAdvances: "cash advances", incentives: "incentives", contracts: "contracts",
  };
  const found = Object.entries(c._count).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${LABEL[k]}`);
  if (userId && (await prisma.message.count({ where: { senderId: userId } }))) found.push("chat messages");
  return found;
}

// Deleting is only for someone added by mistake. Anyone with work records is separated instead (Change assignment or status).
export async function deleteEmployee(employeeId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("/employees");
  if (!can(me, "employees.delete")) return { error: "Only HR can delete employees." };
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, include: { user: { include: { role: true } } } });
  if (!emp) return { error: "Employee not found." };
  const typed = String(form.get("confirm") ?? "").trim().toUpperCase();
  const everything = form.get("withRecords") === "on";
  if (typed !== emp.employeeNo.toUpperCase()) return { error: `Type ${emp.employeeNo} to confirm.` };
  const mine = await getMyEmployee(me);
  if (emp.id === mine.id) return { error: "You cannot delete yourself." };
  { const blocked = accountProblem(me, emp.user, "delete"); if (blocked) return { error: blocked }; }
  const found = await workRecords(emp.id, emp.userId);
  if (found.length && !everything) {
    return {
      error: `${emp.firstName} has work records (${found.join(", ")}). ${me.role.key === ROLES.SUPER_ADMIN ? "Tick “Also delete all their records” to remove them anyway, or" : "Only a Super Admin can delete them with their records. You can"} set their status to Separated to turn off their sign-in and keep their history.`,
    };
  }
  if (everything && me.role.key !== ROLES.SUPER_ADMIN) return { error: "Only a Super Admin can delete an employee together with their records." };
  // Finalized payslips are the company's legal payroll record (BIR, SSS, PhilHealth, Pag-IBIG): never deleted. Separate the person instead.
  if (await prisma.payslip.count({ where: { employeeId: emp.id, period: { status: "FINALIZED" } } })) {
    return { error: `${emp.firstName} has finalized payslips, which must be kept for payroll and government records. Set their status to Separated instead.` };
  }

  // Files that belong only to this person are removed from disk after the records are gone.
  const profile = emp.userId ? await prisma.applicantProfile.findUnique({ where: { userId: emp.userId }, select: { id: true, resumeKey: true, idKey: true } }) : null;
  const files: (string | null)[] = [];
  if (profile) {
    files.push(profile.resumeKey, profile.idKey);
    files.push(...(await prisma.applicantDocument.findMany({ where: { profileId: profile.id }, select: { storageKey: true } })).map((d) => d.storageKey));
    files.push(...(await prisma.applicantPolicySignature.findMany({ where: { profileId: profile.id }, select: { signatureKey: true } })).map((d) => d.signatureKey));
  }
  if (everything) {
    files.push(...(await prisma.employeeDocument.findMany({ where: { employeeId: emp.id }, select: { storageKey: true } })).map((d) => d.storageKey));
    files.push(...(await prisma.policySignature.findMany({ where: { employeeId: emp.id }, select: { signatureKey: true } })).map((d) => d.signatureKey));
  }
  try {
  await prisma.$transaction(async (tx) => {
    const id = emp.id;
    if (everything) {
      // Super Admin, records included. Counts are written to the audit log below; the files of their documents stay on disk.
      await tx.employee.updateMany({ where: { managerId: id }, data: { managerId: null } }); // their people lose this supervisor
      await tx.incentive.deleteMany({ where: { employeeId: id } });
      await tx.contract.deleteMany({ where: { employeeId: id } });
      const slips = await tx.payslip.findMany({ where: { employeeId: id }, select: { id: true } });
      await tx.payslipLine.deleteMany({ where: { payslipId: { in: slips.map((x) => x.id) } } });
      await tx.dailyReportComment.deleteMany({ where: { report: { employeeId: id } } }); // the thread under their daily reports
      for (const m of ["payslip", "payrollAdjustment", "timeEvent", "leaveRequest", "overtimeRequest", "review", "goal", "enrollment", "employeeDocument", "hrRequest", "previousEmployment", "dailyReport", "policySignature", "cashAdvance"] as const) {
        await (tx[m] as unknown as { deleteMany: (a: { where: { employeeId: string } }) => Promise<unknown> }).deleteMany({ where: { employeeId: id } });
      }
    }
    await tx.applicant.updateMany({ where: { employeeId: id }, data: { employeeId: null } }); // the applicant record stays in Recruitment
    await tx.employmentHistory.deleteMany({ where: { employeeId: id } });
    await tx.scheduleEntry.deleteMany({ where: { employeeId: id } });
    await tx.regularSchedule.deleteMany({ where: { employeeId: id } });
    await tx.compensation.deleteMany({ where: { employeeId: id } });
    await tx.employeeComponent.deleteMany({ where: { employeeId: id } });
    await tx.checklistItem.deleteMany({ where: { employeeId: id } });
    await tx.employeeTaxProfile.deleteMany({ where: { employeeId: id } });
    await tx.employee.delete({ where: { id } });
    if (emp.userId) {
      // Someone hired from the applicant portal still has their applicant account: it goes with them (its documents, signed policies and
      // personal data sheet are removed; the recruitment record stays in Recruitment, unlinked).
      await tx.applicantProfile.deleteMany({ where: { userId: emp.userId } });
      await tx.user.delete({ where: { id: emp.userId } }); // sessions, notifications and chat memberships go with it
    }
  });
  } catch (e) {
    // A record we did not expect still points at this person. Say so, and keep the person: never throw to a blank error page.
    console.error("deleteEmployee failed", e instanceof Error ? e.message : e);
    const code = (e as { code?: string } | null)?.code;
    return { error: code === "P2003" || code === "P2014" ? `${emp.firstName} is still linked to records the system could not remove. Nothing was deleted. Make them inactive instead (it keeps their history and turns off their sign-in), or ask support.` : "Could not delete this person. Nothing was deleted. Try again, or make them inactive instead." };
  }
  for (const k of files) await deleteStored(k, me.organizationId);
  await audit(me.id, everything ? "employee.deleted_with_records" : "employee.deleted", "Employee", emp.id, { employeeNo: emp.employeeNo, name: `${emp.firstName} ${emp.lastName}`, login: emp.user?.email ?? null, recordsDeleted: everything ? found : [] }, me.organizationId);
  revalidatePath("/employees");
  redirect("/employees");
}

// Makes someone inactive (status Separated: their sign-in is turned off, their history stays) or brings them back. Reversible, so no
// typed confirmation is needed. The change is written to their employment history.
export async function setEmployeeActive(employeeId: string, active: boolean): Promise<FormState> {
  const me = await requireUser("/employees");
  if (!can(me, "employees.deactivate")) return { error: "Only HR can change this." };
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, include: { user: { include: { role: true } } } });
  if (!emp) return { error: "Employee not found." };
  const mine = await getMyEmployee(me);
  if (emp.id === mine.id) return { error: "You cannot make yourself inactive." };
  { const blocked = accountProblem(me, emp.user, "change"); if (blocked) return { error: blocked }; }
  const status = active ? "ACTIVE" : "SEPARATED";
  if (emp.status === status && (!emp.user || emp.user.active === active)) return { ok: active ? "Already active." : "Already inactive." };
  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: emp.id }, data: { status } });
    if (emp.status !== status) {
      const today = dbDate(new Date().toISOString().slice(0, 10));
      await tx.employmentHistory.create({ data: { organizationId: me.organizationId, employeeId: emp.id, effectiveFrom: today, note: active ? "Reactivated" : "Made inactive", createdById: me.id, change: "STATUS", status } });
      if (!active) await createChecklist(tx, me.organizationId, emp.id, "OFFBOARDING");
    }
    if (emp.userId) {
      await tx.user.update({ where: { id: emp.userId }, data: { active } });
      if (!active) await tx.session.deleteMany({ where: { userId: emp.userId } }); // signed out everywhere, right now
    }
  });
  await audit(me.id, active ? "employee.reactivated" : "employee.made_inactive", "Employee", emp.id, { from: emp.status, to: status }, me.organizationId);
  revalidatePath(`/employees/${emp.id}`);
  revalidatePath("/employees");
  return { ok: active ? `${emp.firstName} is active again and can sign in.` : `${emp.firstName} is inactive. Their sign-in is off and their history is kept.` };
}
