import { rm } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { addDays, dayKey } from "../src/lib/time";
import { wipeOrgs } from "./helpers";

// Everything that is not time, pay or schedule: users, notifications, checklists, recruitment, performance, learning,
// documents, HR requests, announcements and reports. One organization, run in order.
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const pw = "correct-horse-battery";
const TZ = "Asia/Manila";
const today = dayKey(new Date(), TZ);
const mail = (n: string) => `mod-${n}-${stamp}@example.test`;
const ids: Record<string, string> = {};
const problems: string[] = [];
let orgId = "";
let orgBId = "";

const alert = (page: Page) => page.locator("p[role=alert]");
const status = (page: Page) => page.locator("p[role=status]");
async function signIn(page: Page, who: string, password = pw) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(mail(who));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
const ready = async (page: Page, who: string) => {
  await signIn(page, who);
  await expect(page).toHaveURL(/\/dashboard$/);
};
const watch = (page: Page) => {
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/geolocation/i.test(m.text())) problems.push(`console: ${m.text()}`);
  });
};
const pdf = (name = "id.pdf", extra = "") => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n% test file ${extra}\n%%EOF`) });

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const role = (k: string) => roles.find((r) => r.key === k)!.id;
  const hash = await bcrypt.hash(pw, 4);
  const mk = (n: string) => db.organization.create({ data: { name: `Mod ${n} ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  const [a, b] = [await mk("A"), await mk("B")];
  orgId = a.id;
  orgBId = b.id;
  for (const o of [a, b]) {
    await db.orgSettings.create({ data: { organizationId: o.id, requirePunchPassword: false } });
    await db.shiftTemplate.create({ data: { organizationId: o.id, name: "Regular", startTime: "08:00", endTime: "17:00", breakMinutes: 60 } });
    await db.leaveType.create({ data: { organizationId: o.id, name: "Vacation leave", annualDays: 15 } });
  }
  await db.department.create({ data: { organizationId: a.id, name: "Operations" } });
  const person = async (orgId: string, who: string, first: string, roleKey: string, managerId?: string) => {
    const user = await db.user.create({ data: { organizationId: orgId, email: mail(who), name: `${first} Mod`, passwordHash: hash, roleId: role(roleKey) } });
    const e = await db.employee.create({ data: { organizationId: orgId, userId: user.id, employeeNo: `M-${who}`, firstName: first, lastName: "Mod", managerId, hireDate: new Date("2025-01-06T00:00:00Z") } });
    ids[who] = e.id;
    return e;
  };
  await person(a.id, "sa", "Sam", ROLES.SUPER_ADMIN);
  await person(a.id, "hr", "Hana", ROLES.HR_ADMIN);
  const mgr = await person(a.id, "mgr", "Marco", ROLES.MANAGER);
  await person(a.id, "e1", "Eli", ROLES.EMPLOYEE, mgr.id);
  await person(a.id, "e2", "Eve", ROLES.EMPLOYEE);
  await person(b.id, "sb", "Sol", ROLES.SUPER_ADMIN);
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  for (const id of [orgId, orgBId]) await rm(path.resolve(process.cwd(), "storage", id), { recursive: true, force: true });
  await db.$disconnect();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("users: reset a password, deactivate, reactivate, change a role", async ({ page, browser }) => {
  watch(page);
  const e1 = await browser.newPage();
  await ready(e1, "e1"); // an open session that the reset must end
  await ready(page, "sa");
  await page.goto("/admin/users");
  const row = (name: string) => page.locator("li", { hasText: name });
  await expect(row("Sam Mod").getByText("(you)")).toBeVisible();
  await expect(row("Sam Mod").getByRole("button", { name: "Reset password" })).toHaveCount(0); // no manage panel for yourself

  const eli = row("Eli Mod");
  await eli.locator("summary").click();
  await eli.getByLabel("New temporary password").fill("brand-new-temp-1");
  await eli.getByRole("button", { name: "Reset password" }).click();
  await expect(eli.getByText("New temporary password set for Eli Mod")).toBeVisible();
  expect((await db.user.findUniqueOrThrow({ where: { email: mail("e1") } })).mustChangePassword).toBe(true);
  await e1.goto("/dashboard");
  await expect(e1).toHaveURL(/\/login$/); // signed out everywhere
  await signIn(e1, "e1", "brand-new-temp-1");
  await expect(e1).toHaveURL(/\/change-password$/);
  await e1.close();

  const eve = row("Eve Mod");
  await eve.locator("summary").click();
  await eve.getByRole("button", { name: "Deactivate sign-in" }).click();
  await expect(eve.getByText("Eve Mod can no longer sign in.")).toBeVisible();
  const e2 = await browser.newPage();
  await signIn(e2, "e2");
  await expect(alert(e2)).toContainText("Wrong email, username or password");
  await eve.getByRole("button", { name: "Activate sign-in" }).click();
  await expect(eve.getByText("Eve Mod can sign in again.")).toBeVisible();
  await signIn(e2, "e2");
  await expect(e2).toHaveURL(/\/dashboard$/);
  await e2.close();

  await eve.locator("select[name=roleId]").selectOption({ label: "HR Admin" });
  await eve.getByRole("button", { name: "Change role" }).click();
  await expect(eve.getByText("Eve Mod is now HR Admin. They must sign in again.")).toBeVisible();
  await eve.locator("select[name=roleId]").selectOption({ label: "Employee" });
  await eve.getByRole("button", { name: "Change role" }).click();
  await expect(eve.getByText("Eve Mod is now Employee.")).toBeVisible();
});

test("notifications: leave request and decision reach the right people, the bell counts", async ({ browser }) => {
  const e1 = await browser.newPage();
  const mgr = await browser.newPage();
  watch(e1);
  watch(mgr);
  await db.user.update({ where: { email: mail("e1") }, data: { mustChangePassword: false, passwordHash: await bcrypt.hash(pw, 4) } });
  await ready(e1, "e1");
  await e1.goto("/leave");
  await e1.getByLabel("Leave type").selectOption({ label: "Vacation leave" });
  await e1.getByLabel("From", { exact: true }).fill(addDays(today, 40));
  await e1.getByLabel("To", { exact: true }).fill(addDays(today, 40));
  await e1.getByLabel("Reason").fill("Family event");
  await e1.getByRole("button", { name: "Send request" }).click();
  await expect(status(e1)).toContainText("Request sent");

  await ready(mgr, "mgr");
  await expect(mgr.getByRole("link", { name: /Notifications, \d+ unread/ })).toBeVisible();
  await mgr.getByRole("link", { name: /Notifications/ }).click();
  await expect(mgr.getByText(/Eli Mod asked for \d+ days? of vacation leave/)).toBeVisible();
  await mgr.getByRole("button", { name: "Mark all as read" }).click();
  await expect(mgr.getByRole("link", { name: "Notifications", exact: true })).toBeVisible(); // no unread count any more

  // Approving notifies the employee; an outsider's request never reaches an unrelated manager.
  await mgr.goto("/leave");
  await mgr.locator("li", { hasText: "Family event" }).getByRole("button", { name: "Approve" }).click();
  await expect(mgr.getByText("Nothing is waiting")).toBeVisible();
  await e1.goto("/notifications");
  await expect(e1.getByText("Your leave was approved")).toBeVisible();
  expect(await db.notification.count({ where: { user: { email: mail("e2") }, title: { contains: "Eli Mod" } } })).toBe(0);
  await e1.close();
  await mgr.close();
});

test("hiring from Employees: onboarding checklist, who may tick what, editable templates", async ({ browser }) => {
  const hr = await browser.newPage();
  watch(hr);
  await ready(hr, "hr");

  // Add a task to the template first: it must appear for the next hire.
  await hr.goto("/settings");
  const tpl = hr.locator("form", { has: hr.getByRole("button", { name: "Add task" }) });
  await tpl.getByLabel("Task").fill("Take the ID photo");
  await tpl.getByRole("button", { name: "Add task" }).click();
  await expect(tpl.getByText("Task added.")).toBeVisible();

  await hr.goto("/employees");
  await hr.getByText("Add an employee").click();
  await hr.getByLabel("First name").fill("Zed");
  await hr.getByLabel("Last name").fill("Newhire");
  await hr.getByLabel("Email", { exact: true }).fill(mail("zed"));
  await hr.getByLabel("Monthly salary (pesos)").fill("18000.00");
  await hr.locator("#managerId").selectOption({ label: "Marco Mod · M-mgr" });
  await hr.getByLabel(/Create their own sign-in/).check();
  await hr.getByLabel("Username", { exact: true }).fill(`zed1-${stamp}`);
  await hr.locator("#roleId").selectOption({ label: "Employee" });
  await hr.getByLabel("Temporary password").fill(pw);
  await hr.getByRole("button", { name: "Add employee" }).click();
  await expect(status(hr)).toContainText("Zed Newhire added as");
  const zed = await db.employee.findFirstOrThrow({ where: { organizationId: orgId, firstName: "Zed" } });
  ids.zed = zed.id;

  await hr.goto(`/employees/${zed.id}`);
  const card = hr.getByRole("region", { name: "Onboarding checklist" });
  await expect(card).toContainText("0 of 8 done"); // 7 starters + the one added
  await expect(card.getByText("Take the ID photo")).toBeVisible();
  await card.getByLabel("Collect the signed contract").click();
  await expect(card).toContainText("1 of 8 done");

  // The manager may tick manager tasks, not HR or employee tasks.
  const mgr = await browser.newPage();
  await ready(mgr, "mgr");
  await mgr.goto(`/employees/${zed.id}`);
  const mcard = mgr.getByRole("region", { name: "Onboarding checklist" });
  await expect(mcard.getByLabel("Collect IDs and government requirements")).toBeDisabled();
  await expect(mcard.getByLabel("Read the employee handbook")).toBeDisabled();
  await mcard.getByLabel("Introduce the new hire to the team").click();
  await expect(mcard).toContainText("2 of 8 done");

  // The new hire sets their password, then sees and ticks their own tasks.
  const z = await browser.newPage();
  await signIn(z, "zed");
  await expect(z).toHaveURL(/\/change-password$/);
  await z.getByLabel("Temporary password").fill(pw);
  await z.getByLabel("New password (10+ characters)").fill("zeds-own-password-1");
  await z.getByLabel("Confirm new password").fill("zeds-own-password-1");
  await z.getByRole("button", { name: "Save password" }).click();
  await expect(z).toHaveURL(/\/dashboard$/);
  await expect(z.getByText(/Welcome\. 2 things for you to finish/)).toBeVisible();
  await z.getByRole("link", { name: "Open my checklist" }).click();
  const zc = z.getByRole("region", { name: "Onboarding checklist" });
  await expect(zc.getByLabel("Collect the signed contract")).toBeDisabled(); // HR's task
  await zc.getByLabel("Read the employee handbook").click();
  await expect(zc).toContainText("3 of 8 done");
  await z.close();
  await mgr.close();

  // Separation: offboarding checklist appears and the sign-in stops working.
  await hr.goto(`/employees/${zed.id}`);
  await hr.locator("#status").selectOption({ label: "Separated" });
  await hr.getByLabel("Reason or note (optional)").fill("Resigned");
  await hr.getByRole("button", { name: "Save changes" }).click();
  await expect(status(hr)).toContainText("Saved");
  await hr.reload();
  await expect(hr.getByRole("region", { name: "Offboarding checklist" })).toContainText("0 of 7 done");
  expect((await db.user.findUniqueOrThrow({ where: { email: mail("zed") } })).active).toBe(false);
  const again = await browser.newPage();
  await signIn(again, "zed", "zeds-own-password-1");
  await expect(alert(again)).toContainText("Wrong email, username or password");
  await again.close();
  await hr.close();
});

test("recruitment: job, applicants through the stages, hire into an employee record", async ({ browser }) => {
  const hr = await browser.newPage();
  watch(hr);
  await ready(hr, "hr");
  await hr.goto("/recruitment");
  await hr.getByLabel("Job title").fill("Support Agent");
  await hr.getByLabel("Department").selectOption({ label: "Operations" });
  await hr.getByRole("button", { name: "Open the job" }).click();
  await expect(hr).toHaveURL(/\/recruitment\/[a-z0-9]+$/);
  await expect(hr.getByRole("heading", { name: "Support Agent" })).toBeVisible();

  const add = async (name: string, email: string) => {
    await hr.getByLabel("Name", { exact: true }).fill(name);
    await hr.getByLabel("Email").fill(email);
    await hr.getByRole("button", { name: "Add applicant" }).click();
  };
  await add("Ana Applicant", mail("ana"));
  await expect(hr.getByText("Ana Applicant added.")).toBeVisible();
  await add("Ana Again", mail("ana"));
  await expect(alert(hr)).toContainText("already an applicant for this job");
  await add("Bo Rejected", mail("bo"));
  await expect(hr.getByText("Bo Rejected added.")).toBeVisible();

  const ana = () => hr.locator("li", { has: hr.getByText("Ana Applicant", { exact: true }) });
  await expect(ana().getByRole("button", { name: /Hire/ })).toHaveCount(0); // only at the offer stage
  await ana().getByRole("button", { name: "Move to Screening" }).click();
  await expect(hr.getByRole("region", { name: "Screening" }).getByText("Ana Applicant")).toBeVisible();
  await ana().getByText("Interview and notes").click();
  await ana().getByLabel("Add a note").fill("Strong phone manner");
  await ana().getByRole("button", { name: "Save note" }).click();
  await expect(hr.getByText("Strong phone manner").first()).toBeVisible();
  await ana().getByLabel("Interview date and time").fill(`${addDays(today, 3)}T10:30`);
  await ana().getByRole("button", { name: "Set interview" }).click();
  await expect(hr.getByRole("region", { name: "Interview" }).getByText("Ana Applicant")).toBeVisible();
  await ana().getByRole("button", { name: "Move to Offer" }).click();

  const bo = hr.locator("li", { has: hr.getByText("Bo Rejected", { exact: true }) });
  await bo.getByRole("button", { name: "Reject" }).click();
  await expect(hr.getByRole("region", { name: "Rejected" }).getByText("Bo Rejected")).toBeVisible();

  await hr.getByLabel("Immediate supervisor").selectOption({ label: "Marco Mod · M-mgr" });
  await hr.getByLabel("Regular shift").selectOption({ label: "Regular (08:00–17:00)" });
  await hr.getByLabel(/Also create a sign-in/).check();
  await hr.getByLabel("Temporary password").fill(pw);
  await hr.getByRole("button", { name: "Hire and create the employee" }).click();
  await expect.poll(() => db.employee.count({ where: { organizationId: orgId, email: mail("ana") } })).toBe(1);

  const emp = await db.employee.findFirstOrThrow({ where: { organizationId: orgId, email: mail("ana") }, include: { department: true, history: true } });
  expect(emp.firstName).toBe("Ana");
  expect(emp.lastName).toBe("Applicant");
  expect(emp.department?.name).toBe("Operations"); // from the job
  expect(emp.managerId).toBe(ids.mgr);
  expect(emp.history.map((h) => h.change)).toContain("HIRED");
  expect(await db.regularSchedule.count({ where: { employeeId: emp.id } })).toBe(1);
  expect(await db.checklistItem.count({ where: { employeeId: emp.id, kind: "ONBOARDING" } })).toBeGreaterThan(0);
  const job = await db.jobPosting.findFirstOrThrow({ where: { organizationId: orgId, title: "Support Agent" } });
  expect(job.status).toBe("CLOSED"); // every opening is filled
  await hr.reload();
  await expect(hr.getByRole("region", { name: "Hired" }).getByText("Ana Applicant")).toBeVisible();
  await hr.close();

  const a = await browser.newPage();
  await signIn(a, "ana");
  await expect(a).toHaveURL(/\/change-password$/); // the new hire can sign in with the temporary password
  await a.close();
});

test("performance: goals, then self -> manager -> HR final -> acknowledged", async ({ browser }) => {
  const [hr, e1, mgr, e2] = await Promise.all([browser.newPage(), browser.newPage(), browser.newPage(), browser.newPage()]);
  [hr, e1, mgr, e2].forEach(watch);
  await ready(hr, "hr");
  await hr.goto("/performance");
  await hr.getByLabel("Name", { exact: true }).fill("Annual review");
  await hr.getByLabel("Covers from").fill(addDays(today, -300));
  await hr.getByLabel("Covers to").fill(addDays(today, -1));
  await hr.getByRole("button", { name: "Start the cycle" }).click();
  await expect(hr.getByText(/Annual review started for \d+ people/)).toBeVisible();

  // Self-assessment (Eli has a manager, Eve does not).
  await ready(e1, "e1");
  await e1.goto("/performance");
  await e1.getByRole("button", { name: "Submit my self-assessment" }).click(); // needs a rating
  await e1.getByRole("radio", { name: /4 · Exceeds/ }).check({ force: true });
  await e1.getByLabel("Comment").fill("Hit my targets and trained two new agents.");
  await e1.getByRole("button", { name: "Submit my self-assessment" }).click();
  await expect(e1.getByText("Waiting for the manager")).toBeVisible();

  // The manager is told and evaluates; an unrelated manager would not see it.
  await ready(mgr, "mgr");
  await mgr.goto("/performance");
  await expect(mgr.getByText("Evaluations waiting for you")).toBeVisible();
  const evalCard = mgr.locator("div", { hasText: "Eli Mod" }).filter({ has: mgr.getByRole("button", { name: "Submit my evaluation" }) }).last();
  await expect(evalCard.getByText("Self-assessment: 4")).toBeVisible();
  await evalCard.getByRole("radio", { name: /3 · Meets/ }).check({ force: true });
  await evalCard.getByLabel("Comment").fill("Solid year. Mentoring was a plus.");
  await evalCard.getByRole("button", { name: "Submit my evaluation" }).click();
  await expect(mgr.getByText("Evaluations waiting for you")).toHaveCount(0);

  // Eve has no manager: her self-assessment goes straight to HR.
  await ready(e2, "e2");
  await e2.goto("/performance");
  await e2.getByRole("radio", { name: /5 · Outstanding/ }).check({ force: true });
  await e2.getByLabel("Comment").fill("Led the quarter-end project.");
  await e2.getByRole("button", { name: "Submit my self-assessment" }).click();
  await expect(e2.getByText("Waiting for HR's final rating")).toBeVisible();

  // HR sets both final ratings; the manager's rating is the default.
  await hr.goto("/performance");
  await expect(hr.getByText(/Ready for the final rating/)).toBeVisible();
  const eli = hr.locator("div", { hasText: "Eli Mod" }).filter({ has: hr.getByRole("button", { name: "Save the final rating" }) }).last();
  await expect(eli.getByRole("radio", { name: /3 · Meets/ })).toBeChecked();
  await eli.getByLabel("Comment").fill("Agreed with the manager.");
  await eli.getByRole("button", { name: "Save the final rating" }).click();
  await expect.poll(async () => (await db.review.findFirstOrThrow({ where: { employeeId: ids.e1 } })).finalRating).toBe(3);
  await hr.reload();
  const eve = hr.locator("div", { hasText: "Eve Mod" }).filter({ has: hr.getByRole("button", { name: "Save the final rating" }) }).last();
  await eve.getByRole("radio", { name: /5 · Outstanding/ }).check({ force: true });
  await eve.getByLabel("Comment").fill("Confirmed.");
  await eve.getByRole("button", { name: "Save the final rating" }).click();

  // The employee reads and acknowledges.
  await e1.goto("/performance");
  await expect(e1.getByText(/^Final: 3/)).toBeVisible();
  await e1.getByRole("button", { name: "I have read my review" }).click();
  await expect(e1.getByText(/You acknowledged this review on/)).toBeVisible();
  expect((await db.review.findFirstOrThrow({ where: { employeeId: ids.e1 } })).stage).toBe("DONE");

  // Goals: own, set by a manager, and not visible across the team boundary.
  await e1.getByLabel("Goal").fill("Cut average handling time by 10%");
  await e1.getByRole("button", { name: "Add goal" }).click();
  await expect(e1.getByText("Goal added.")).toBeVisible();
  await e1.reload();
  const goal = e1.locator("li", { hasText: "Cut average handling time" });
  await goal.getByLabel("Progress percent").fill("50");
  await goal.getByRole("button", { name: "Save" }).click();
  await expect(goal.getByText("Saved.")).toBeVisible();
  await mgr.goto("/performance");
  await expect(mgr.getByText("Cut average handling time by 10%").first()).toBeVisible(); // in the manager's team
  await e2.goto("/performance");
  await expect(e2.getByText("Cut average handling time")).toHaveCount(0); // other employees never see it
  await expect(e2.getByText("My team's goals")).toHaveCount(0);
  await Promise.all([hr, e1, mgr, e2].map((p) => p.close()));
});

test("learning: catalog, enroll, complete with expiry, expiring certificates are flagged", async ({ browser }) => {
  const [hr, e1, mgr] = await Promise.all([browser.newPage(), browser.newPage(), browser.newPage()]);
  [hr, e1, mgr].forEach(watch);
  await ready(hr, "hr");
  await hr.goto("/learning");
  await hr.getByLabel("Course", { exact: true }).fill("Safety training");
  await hr.getByLabel("Certificate valid for (months, optional)").fill("12");
  await hr.getByRole("button", { name: "Add course" }).click();
  await expect(hr.getByText("Safety training added.")).toBeVisible();
  await hr.getByLabel("Course", { exact: true }).fill("Safety training");
  await hr.getByRole("button", { name: "Add course" }).click();
  await expect(alert(hr)).toContainText("already exists");

  // A manager can enroll their own team only.
  await ready(mgr, "mgr");
  await mgr.goto("/learning");
  await mgr.locator("li", { hasText: "Safety training" }).locator("summary").click();
  await expect(mgr.getByLabel("Mod, Eli")).toBeVisible();
  await expect(mgr.getByLabel("Mod, Eve")).toHaveCount(0);
  await mgr.getByLabel("Mod, Eli").check();
  await mgr.getByRole("button", { name: /Enroll 1 person/ }).click();
  await expect(mgr.getByText("1 enrolled.")).toBeVisible();

  await ready(e1, "e1");
  await e1.goto("/learning");
  await expect(e1.locator("li", { hasText: "Safety training" }).getByText("Enrolled", { exact: true })).toBeVisible();
  await expect(e1.getByText("Everyone's enrollments")).toHaveCount(0);

  await mgr.goto("/learning");
  const enr = mgr.locator("li", { hasText: "Eli Mod" }).filter({ hasText: "Safety training" });
  await enr.getByRole("button", { name: "Mark complete" }).click();
  await expect.poll(() => db.enrollment.count({ where: { employeeId: ids.e1, status: "COMPLETED" } })).toBe(1);
  await e1.reload();
  await expect(e1.locator("li", { hasText: "Safety training" }).first()).toContainText("valid until");
  const done = await db.enrollment.findFirstOrThrow({ where: { employeeId: ids.e1 } });
  expect(done.status).toBe("COMPLETED");
  expect(done.expiresOn!.getTime()).toBeGreaterThan(Date.now() + 300 * 86_400_000); // about a year ahead

  // An expired certificate for someone else shows up for HR.
  const course = await db.course.findFirstOrThrow({ where: { organizationId: orgId } });
  await db.enrollment.create({ data: { organizationId: orgId, courseId: course.id, employeeId: ids.e2, status: "COMPLETED", completedOn: new Date("2024-01-01T00:00:00Z"), expiresOn: new Date("2025-01-01T00:00:00Z") } });
  await hr.goto("/learning");
  await expect(hr.getByText("Certificates that need attention")).toBeVisible();
  await expect(hr.locator("li", { hasText: "Eve Mod" }).getByText("Expired")).toBeVisible();
  await Promise.all([hr, e1, mgr].map((p) => p.close()));
});

test("documents: upload, versions, expiry, and only the owner and HR can open a file", async ({ browser }) => {
  const [e1, e2, mgr, hr, sb] = await Promise.all([browser.newPage(), browser.newPage(), browser.newPage(), browser.newPage(), browser.newPage()]);
  [e1, hr].forEach(watch);
  await ready(e1, "e1");
  await e1.goto("/documents");
  const upload = async (page: Page, file: { name: string; mimeType: string; buffer: Buffer }, title: string, expires?: string) => {
    await page.getByLabel("Category").selectOption("Identification");
    await page.getByLabel("Title").fill(title);
    if (expires) await page.getByLabel("Expires on (optional)").fill(expires);
    const form = page.locator("form", { has: page.getByLabel("Category") }); // the general upload, not the 201 checklist
    await form.locator("input[type=file]").setInputFiles(file);
    await form.getByRole("button", { name: "Upload" }).click();
  };
  await upload(e1, pdf("id-front.pdf", "v1"), "National ID", addDays(today, 20));
  await expect(e1.getByText("National ID saved.")).toBeVisible();
  await expect(e1.getByText("Expires soon")).toBeVisible();

  // The browser's file name and type are not trusted: only real PDF/PNG/JPEG content passes.
  await upload(e1, { name: "totally-a-pdf.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ\x90\x00 this is an executable") }, "Fake");
  await expect(alert(e1)).toContainText("Only PDF, PNG and JPEG files are accepted");
  await upload(e1, { name: "huge.pdf", mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(6 * 1024 * 1024)]) }, "Huge");
  await expect(alert(e1)).toContainText("too large");

  await upload(e1, pdf("id-front-new.pdf", "v2"), "National ID", addDays(today, 20));
  await expect(e1.getByText("National ID saved as version 2.")).toBeVisible();
  await e1.reload();
  await expect(e1.getByText("version 2")).toBeVisible();
  await e1.getByText("Older versions (1)").click();

  const doc = await db.employeeDocument.findFirstOrThrow({ where: { employeeId: ids.e1, version: 2 } });
  const old = await db.employeeDocument.findFirstOrThrow({ where: { employeeId: ids.e1, version: 1 } });
  expect(old.archivedAt).not.toBeNull();
  expect(doc.mimeType).toBe("application/pdf");

  // The owner opens it; nobody else but HR can.
  const mine = await e1.request.get(`/documents/${doc.id}/file`);
  expect(mine.status()).toBe(200);
  expect(mine.headers()["content-type"]).toBe("application/pdf");
  expect(mine.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await mine.body()).toString()).toContain("v2");
  await ready(e2, "e2");
  expect((await e2.request.get(`/documents/${doc.id}/file`)).status()).toBe(404);
  await ready(mgr, "mgr");
  expect((await mgr.request.get(`/documents/${doc.id}/file`)).status()).toBe(404); // a manager is not HR
  await ready(sb, "sb");
  expect((await sb.request.get(`/documents/${doc.id}/file`)).status()).toBe(404); // another organization
  await ready(hr, "hr");
  expect((await hr.request.get(`/documents/${doc.id}/file`)).status()).toBe(200);
  expect(await db.auditLog.count({ where: { organizationId: orgId, action: "document.viewed" } })).toBe(1); // HR opening someone else's file is recorded

  // A URL cannot reveal someone else's file list to a non-HR user.
  await e2.goto(`/documents?employee=${ids.e1}`);
  await expect(e2.getByText("National ID")).toHaveCount(0);
  await hr.goto(`/documents?employee=${ids.e1}`);
  await expect(hr.getByText("National ID").first()).toBeVisible();
  await hr.goto("/documents");
  await expect(hr.getByText(/Expiring within 60 days/)).toBeVisible();
  await expect(hr.getByText("Eli Mod").first()).toBeVisible();
  await Promise.all([e1, e2, mgr, hr, sb].map((p) => p.close()));
});

test("HR requests: ask, HR is told, answers, employee is told", async ({ browser }) => {
  const [e1, hr] = await Promise.all([browser.newPage(), browser.newPage()]);
  [e1, hr].forEach(watch);
  await ready(e1, "e1");
  await e1.goto("/requests");
  await e1.getByLabel("What is it about?").selectOption("Employment certificate");
  await e1.getByLabel("Subject").fill("Certificate for a bank loan");
  await e1.getByLabel("Message").fill("Please issue an employment certificate. I need it by next week.");
  await e1.getByRole("button", { name: "Send to HR" }).click();
  await expect(e1.getByText("Sent to HR.")).toBeVisible();

  await ready(hr, "hr");
  await hr.goto("/notifications");
  await expect(hr.getByText("Eli Mod: Certificate for a bank loan")).toBeVisible();
  await hr.goto("/requests");
  const card = hr.locator("li", { hasText: "Certificate for a bank loan" });
  await card.getByRole("button", { name: "Send answer and resolve" }).click(); // an answer is required to resolve
  await expect(card.locator("p[role=alert]")).toContainText("Write the answer");
  await card.getByLabel("Answer").fill("Ready for pick-up at the HR desk tomorrow.");
  await card.getByRole("button", { name: "Send answer and resolve" }).click();
  await hr.reload();
  await expect(hr.getByText("Certificate for a bank loan")).toHaveCount(0); // resolved: out of the queue

  await e1.goto("/requests");
  await expect(e1.getByText("Ready for pick-up at the HR desk tomorrow.")).toBeVisible();
  await expect(e1.getByText("Resolved")).toBeVisible();
  await e1.goto("/notifications");
  await expect(e1.getByText("HR answered: Certificate for a bank loan")).toBeVisible();
  await Promise.all([e1, hr].map((p) => p.close()));
});

test("announcements: HR posts, everyone sees it on Home and is notified", async ({ browser }) => {
  const [hr, e1] = await Promise.all([browser.newPage(), browser.newPage()]);
  [hr, e1].forEach(watch);
  await ready(hr, "hr");
  await hr.goto("/announcements");
  await hr.getByLabel("Title").fill("Office closed on Friday");
  await hr.getByLabel("Message").fill("The office is closed this Friday for maintenance.\nWork from home if you can.");
  await hr.getByLabel("Keep it at the top").check();
  await hr.getByRole("button", { name: "Post to everyone" }).click();
  await expect(hr.getByText("Posted. Everyone was notified")).toBeVisible();

  await ready(e1, "e1");
  await expect(e1.getByRole("region", { name: "Announcements" }).getByText("Office closed on Friday")).toBeVisible();
  await e1.goto("/notifications");
  await expect(e1.getByText("Announcement: Office closed on Friday")).toBeVisible();
  await e1.goto("/announcements");
  await expect(e1).toHaveURL(/denied=1/); // employees read, they do not post

  await hr.getByRole("button", { name: "Archive Office closed on Friday" }).click();
  await e1.goto("/dashboard");
  await expect(e1.getByText("Office closed on Friday")).toHaveCount(0);
  await Promise.all([hr, e1].map((p) => p.close()));
});

test("reports: headcount, attendance and a CSV, for HR only", async ({ browser }) => {
  const [hr, e1] = await Promise.all([browser.newPage(), browser.newPage()]);
  [hr, e1].forEach(watch);
  await ready(hr, "hr");
  await hr.goto("/reports");
  await expect(hr.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(hr.getByText("Headcount now")).toBeVisible();
  await expect(hr.getByRole("region", { name: "Attendance" }).getByText("Mod, Eli")).toBeVisible();
  await expect(hr.getByRole("region", { name: "People" }).getByText("Operations")).toBeVisible();
  const csv = await hr.request.get(`/reports/attendance/export?from=${addDays(today, -7)}&to=${today}`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.text();
  expect(body.split("\r\n")[0]).toContain("Employee no,Name,Department");
  expect(body).toContain("M-e1");
  expect((await hr.request.get("/reports/attendance/export?from=bad&to=bad")).status()).toBe(400);

  await ready(e1, "e1");
  await e1.goto("/reports");
  await expect(e1).toHaveURL(/denied=1/);
  const denied = await e1.request.get(`/reports/attendance/export?from=${today}&to=${today}`);
  expect(denied.headers()["content-type"]).not.toContain("text/csv");
  await Promise.all([hr, e1].map((p) => p.close()));
});
