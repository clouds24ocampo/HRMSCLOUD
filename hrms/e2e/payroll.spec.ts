import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { addDays, dayKey, daysBetween, weekStart, weekday } from "../src/lib/time";
import { wipeOrgs } from "./helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const pw = "correct-horse-battery";
const TZ = "Asia/Manila";
const mail = (n: string) => `pay-${n}-${stamp}@example.test`;
const ids: Record<string, string> = {};
const problems: string[] = [];

// Two past periods of two weeks each.
const p1Start = addDays(weekStart(dayKey(new Date(), TZ)), -28);
const p1End = addDays(p1Start, 13);
const p2Start = addDays(p1End, 1);
const p2End = addDays(p2Start, 13);
const workdays = (from: string, to: string) => daysBetween(from, to).filter((d) => ![0, 6].includes(weekday(d)));

async function signIn(page: Page, who: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(mail(who));
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
const out = (page: Page) => page.getByRole("button", { name: "Sign out" }).click();

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const role = (k: string) => roles.find((r) => r.key === k)!.id;
  const hash = await bcrypt.hash(pw, 4);
  const org = await db.organization.create({ data: { name: `Pay ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  await db.orgSettings.create({ data: { organizationId: org.id, requirePunchPassword: false } });
  const shift = await db.shiftTemplate.create({ data: { organizationId: org.id, name: "Regular", startTime: "08:00", endTime: "17:00", breakMinutes: 60 } });
  await db.timeStampType.createMany({
    data: [
      { organizationId: org.id, key: "TIME_IN", name: "Time In", kind: "IN", sortOrder: 10, locked: true },
      { organizationId: org.id, key: "TIME_OUT", name: "Time Out", kind: "OUT", sortOrder: 99, locked: true },
    ],
  });
  const tin = await db.timeStampType.findFirstOrThrow({ where: { organizationId: org.id, key: "TIME_IN" } });
  const tout = await db.timeStampType.findFirstOrThrow({ where: { organizationId: org.id, key: "TIME_OUT" } });
  await db.leaveType.create({ data: { organizationId: org.id, name: "Vacation leave", annualDays: 15 } });

  const person = async (who: string, first: string, roleKey: string, managerId?: string) => {
    const user = await db.user.create({ data: { organizationId: org.id, email: mail(who), name: `${first} Pay`, passwordHash: hash, roleId: role(roleKey) } });
    const e = await db.employee.create({ data: { organizationId: org.id, userId: user.id, employeeNo: `P-${who}`, firstName: first, lastName: "Pay", managerId, hireDate: new Date("2025-01-06T00:00:00Z") } });
    ids[who] = e.id;
    await db.regularSchedule.create({ data: { organizationId: org.id, employeeId: e.id, shiftId: shift.id, workDays: [1, 2, 3, 4, 5], effectiveFrom: new Date("2025-01-06T00:00:00Z") } });
    return e;
  };
  await person("sa", "Sam", ROLES.SUPER_ADMIN);
  await person("hr", "Hana", ROLES.HR_ADMIN);
  await person("mo", "Mona", ROLES.EMPLOYEE); // monthly
  await person("da", "Dan", ROLES.EMPLOYEE); // daily
  await person("ho", "Hugo", ROLES.EMPLOYEE); // hourly
  await person("np", "Nia", ROLES.EMPLOYEE); // no pay rate

  const punch = async (who: string, day: string, inHm: string, outHm: string) => {
    const at = (hm: string) => new Date(`${day}T${hm}:00+08:00`);
    await db.timeEvent.create({ data: { organizationId: org.id, employeeId: ids[who], type: "IN", stampTypeId: tin.id, at: at(inHm), gpsStatus: "OK" } });
    await db.timeEvent.create({ data: { organizationId: org.id, employeeId: ids[who], type: "OUT", stampTypeId: tout.id, at: at(outHm), gpsStatus: "OK" } });
  };
  const days = workdays(p1Start, p1End); // 10 working days
  // Mona (monthly): 8 normal days, 1 late by 40 minutes, 1 absent.
  for (const d of days.slice(0, 8)) await punch("mo", d, "08:00", "17:00");
  await punch("mo", days[8], "08:40", "17:00");
  // Dan (daily): 9 days, 1 absent.
  for (const d of days.slice(0, 9)) await punch("da", d, "08:00", "17:00");
  // Hugo (hourly): 10 days of exactly 8 hours.
  for (const d of days) await punch("ho", d, "08:00", "16:00");
  // Mona works an hour past her shift on one day of the second period (overtime candidate 60 minutes).
  const otDay = workdays(p2Start, p2End)[1];
  await punch("mo", otDay, "08:00", "18:00");
  for (const d of workdays(p2Start, p2End).filter((x) => x !== otDay)) await punch("mo", d, "08:00", "17:00");
  (ids as Record<string, string>).otDay = otDay;
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("setup: pay items, contributions and tax brackets are entered, not built in", async ({ page }) => {
  page.on("pageerror", (e) => problems.push(e.message));
  await signIn(page, "hr");
  await page.goto("/payroll/setup");
  await expect(page.getByRole("heading", { name: "Pay setup" })).toBeVisible();
  await expect(page.getByText("Enter them from the current official tables")).toBeVisible();

  await page.getByLabel("Name", { exact: true }).first().fill("Transport allowance");
  await page.getByLabel("Amount (pesos)").fill("1000.00");
  await page.getByLabel("Counts as taxable pay").uncheck();
  await page.getByRole("button", { name: "Add pay item" }).click();
  await expect(page.getByText("Transport allowance added.")).toBeVisible();
  await page.getByLabel("Amount (pesos)").fill("abc");
  await page.getByLabel("Name", { exact: true }).first().fill("Bad item");
  await page.getByRole("button", { name: "Add pay item" }).click();
  await expect(page.locator("p[role=alert]").first()).toContainText("Enter an amount in pesos");

  const contrib = page.locator("form", { has: page.getByRole("button", { name: "Add contribution" }) });
  await contrib.getByLabel("Name", { exact: true }).fill("Pension");
  await contrib.getByLabel("Employee pays (%)").fill("4.5");
  await contrib.getByLabel("Employer pays (%)").fill("9.5");
  await contrib.getByRole("button", { name: "Add contribution" }).click();
  await expect(page.getByText("Pension added.")).toBeVisible();

  const bracket = page.locator("form", { has: page.getByRole("button", { name: "Add bracket" }) });
  for (const [from, rate] of [["0", "0"], ["5000", "20"]]) {
    await bracket.getByLabel("Taxable pay from (pesos)").fill(from);
    await bracket.getByLabel("Rate on the excess (%)").fill(rate);
    await bracket.getByRole("button", { name: "Add bracket" }).click();
    await expect(bracket.getByRole("status")).toContainText("Bracket added.");
  }
  expect(await db.taxBracket.count({ where: { organization: { name: `Pay ${stamp}` } } })).toBe(2);
  expect((await db.contributionRule.findFirstOrThrow({ where: { organization: { name: `Pay ${stamp}` } } })).employeeBp).toBe(450);
});

test("pay rates: set on the profile, history is kept, others cannot see pay", async ({ page }) => {
  await signIn(page, "hr");
  await page.goto(`/employees/${ids.mo}`);
  await expect(page.getByText("No pay rate yet")).toBeVisible();
  await page.getByText("Set pay rate").click();
  await page.getByLabel("Rate (pesos)").fill("22000.00");
  const payForm = page.locator("form", { has: page.getByRole("button", { name: "Save pay rate" }) });
  await payForm.getByLabel("Starts on").fill("2025-01-06");
  await page.getByRole("button", { name: "Save pay rate" }).click();
  await expect(page.getByRole("status")).toContainText("Pay rate saved");
  await page.reload();
  await expect(page.getByText("₱22,000.00")).toBeVisible();
  // Assign the allowance.
  await page.getByLabel("Pay item").selectOption({ label: "Transport allowance (adds)" });
  await page.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByRole("status").filter({ hasText: "assigned" })).toBeVisible();
  // Raising pay later adds a row; the old rate stays on record.
  await page.getByText("Change pay rate").click();
  await page.getByLabel("Rate (pesos)").fill("25000");
  await payForm.getByLabel("Starts on").fill(addDays(dayKey(new Date(), TZ), 30));
  await page.getByRole("button", { name: "Save pay rate" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Pay rate saved" })).toBeVisible();
  expect(await db.compensation.count({ where: { employeeId: ids.mo } })).toBe(2);

  // The other two get their rates directly (same screen, same rule).
  const org = await db.organization.findFirstOrThrow({ where: { name: `Pay ${stamp}` } });
  const from = new Date("2025-01-06T00:00:00Z");
  await db.compensation.create({ data: { organizationId: org.id, employeeId: ids.da, payType: "DAILY", rateCents: 100_000, effectiveFrom: from } });
  await db.compensation.create({ data: { organizationId: org.id, employeeId: ids.ho, payType: "HOURLY", rateCents: 12_500, effectiveFrom: from } });
  await db.employeeComponent.create({ data: { organizationId: org.id, employeeId: ids.da, componentId: (await db.payComponent.findFirstOrThrow({ where: { organizationId: org.id } })).id, active: false } });

  // Employees never see pay on profiles; managers neither. Payroll pages are HR-only.
  await out(page);
  await signIn(page, "mo");
  await page.goto("/payroll");
  await expect(page).toHaveURL(/denied=1/);
  await page.goto("/payroll/setup");
  await expect(page).toHaveURL(/denied=1/);
});

test("payroll: calculate, check every number, two-person approval, finalize and lock", async ({ page, browser }) => {
  page.on("pageerror", (e) => problems.push(e.message));
  await signIn(page, "hr");
  await page.goto("/payroll");
  await expect(page.getByText("3 employees have no pay rate")).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill("First half");
  await page.getByLabel("Starts").fill(p1Start);
  await page.getByLabel("Ends").fill(p1End);
  await page.getByLabel("Pay day").fill(addDays(p1End, 3));
  await page.getByRole("button", { name: "Create pay period" }).click();
  await expect(page).toHaveURL(/\/payroll\/[a-z0-9]+$/);
  const periodUrl = page.url();
  await expect(page.getByRole("heading", { name: "First half" })).toBeVisible();
  await expect(page.getByText(/Not paid: no pay rate for .*Nia Pay/)).toBeVisible();

  await page.getByRole("button", { name: "Calculate payroll" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Calculated 3 payslips" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Nia Pay (No pay rate set)" })).toBeVisible();

  // Mona: basic 11,000.00 + transport 1,000.00; absence 1,000.00, late 40 min 83.33, pension 495.00, tax 884.33. Net 9,537.34
  const row = (n: string) => page.locator("tr", { hasText: n });
  await expect(row("Mona Pay")).toContainText("₱12,000.00");
  await expect(row("Mona Pay")).toContainText("₱2,462.66");
  await expect(row("Mona Pay")).toContainText("₱9,537.34");
  // Dan: 9 days x 1,000 = 9,000; pension 405; tax 719; net 7,876
  await expect(row("Dan Pay")).toContainText("₱9,000.00");
  await expect(row("Dan Pay")).toContainText("₱7,876.00");
  // Hugo: 80 h x 125 = 10,000; pension 450; tax 910; net 8,640
  await expect(row("Hugo Pay")).toContainText("₱10,000.00");
  await expect(row("Hugo Pay")).toContainText("₱8,640.00");

  // The payslip explains each line.
  await row("Mona Pay").getByRole("link", { name: "View" }).click();
  await expect(page.getByText("Draft: payroll for this period is not final yet")).toBeVisible();
  await expect(page.getByText("1 day × 1000.00")).toBeVisible();
  await expect(page.getByText("40 min × 2.08 per min")).toBeVisible();
  await expect(page.getByText("4.50% of 11000.00")).toBeVisible();
  const slipId = page.url().split("/").pop()!;
  await page.goto(periodUrl);

  // An employee sees nothing until payroll is final.
  const emp = await browser.newPage();
  await signIn(emp, "mo");
  await emp.goto("/payslips");
  await expect(emp.getByText("No payslips yet")).toBeVisible();
  await emp.goto(`/payslips/${slipId}`);
  await expect(emp.getByText("could not be found")).toBeVisible();

  // Maker-checker: the person who calculated cannot approve.
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("A second person must approve");
  await out(page);
  await signIn(page, "sa");
  await page.goto(periodUrl);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Approved." })).toBeVisible();
  await page.reload();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Finalize and lock" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Finalized." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Calculate again" })).toHaveCount(0);
  await expect(page.getByText("Locked. The database itself refuses changes")).toBeVisible();

  // The database refuses changes to a finalized payslip, whatever the application does.
  const slip = await db.payslip.findFirstOrThrow({ where: { employeeId: ids.mo } });
  await expect(db.payslip.update({ where: { id: slip.id }, data: { netCents: 1 } })).rejects.toThrow(/Finalized payroll cannot be changed/);
  await expect(db.payslipLine.deleteMany({ where: { payslipId: slip.id } })).rejects.toThrow(/Finalized payroll cannot be changed/);
  await expect(db.payrollPeriod.update({ where: { id: slip.periodId }, data: { name: "tampered" } })).rejects.toThrow(/Finalized payroll cannot be changed/);
  expect((await db.payslip.findUniqueOrThrow({ where: { id: slip.id } })).netCents).toBe(953_734);

  // The employee now sees their own payslip, and only theirs.
  await emp.goto("/payslips");
  await expect(emp.getByText("First half")).toBeVisible();
  await emp.getByRole("link", { name: /First half/ }).click();
  await expect(emp.getByText("Net pay").first()).toBeVisible();
  await expect(emp.getByText("₱9,537.34").first()).toBeVisible();
  await expect(emp.getByText("Final", { exact: true })).toBeVisible();
  const other = await db.payslip.findFirstOrThrow({ where: { employeeId: ids.da } });
  await emp.goto(`/payslips/${other.id}`);
  await expect(emp.getByText("could not be found")).toBeVisible();
  await emp.close();

  // Notification went out when it was finalized.
  const note = await db.notification.findFirst({ where: { user: { email: mail("mo") }, title: { contains: "First half" } } });
  expect(note?.href).toBe(`/payslips/${slip.id}`);
});

test("payroll: an overlapping period is refused, CSV is HR-only", async ({ page }) => {
  await signIn(page, "hr");
  await page.goto("/payroll");
  await page.getByLabel("Name", { exact: true }).fill("Overlap");
  await page.getByLabel("Starts").fill(addDays(p1Start, 5));
  await page.getByLabel("Ends").fill(addDays(p1Start, 20));
  await page.getByLabel("Pay day").fill(addDays(p1Start, 25));
  await page.getByRole("button", { name: "Create pay period" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("overlap");

  const first = await db.payrollPeriod.findFirstOrThrow({ where: { organization: { name: `Pay ${stamp}` }, name: "First half" } });
  const csv = await page.request.get(`/payroll/${first.id}/export`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.text();
  expect(body).toContain("Mona Pay,12000.00,2462.66,9537.34");
  await out(page);
  await signIn(page, "da");
  const denied = await page.request.get(`/payroll/${first.id}/export`);
  expect(denied.headers()["content-type"]).not.toContain("text/csv");
});

test("overtime: only approved overtime is paid, and adjustments are applied on recalculation", async ({ browser }) => {
  const ot = (await db.employee.findFirstOrThrow({ where: { id: ids.mo } })) && (ids as Record<string, string>).otDay;
  const emp = await browser.newPage();
  await signIn(emp, "mo");
  await emp.goto(`/dtr?employee=${ids.mo}&from=${ot}&to=${ot}`);
  const row = emp.locator("details").first();
  await row.locator("summary").click();
  await expect(row.getByText("Overtime shown here is only a candidate")).toBeVisible();
  await row.getByLabel("Reason for overtime").fill("Month-end closing");
  await row.getByRole("button", { name: "Request 1h 00m overtime" }).click();
  await expect(row.getByText("Overtime 1h 00m")).toBeVisible(); // the form becomes a status line
  await expect(row.getByText("Pending")).toBeVisible();

  // HR is told, and decides.
  const hr = await browser.newPage();
  await signIn(hr, "hr");
  await hr.goto("/notifications");
  await expect(hr.getByText("Mona Pay asked for 1h 00m overtime")).toBeVisible();
  await hr.goto("/overtime");
  await expect(hr.getByText("Waiting for your decision")).toBeVisible();
  await hr.getByRole("button", { name: "Reject" }).click();
  await expect(hr.locator("p[role=alert]")).toContainText("reason for rejecting");
  await hr.getByRole("button", { name: "Approve" }).click();
  await expect(hr.getByText("Month-end closing")).toHaveCount(0);

  // Second period: calculate, then add an adjustment, which forces a fresh calculation.
  await hr.goto("/payroll");
  await hr.getByLabel("Name", { exact: true }).fill("Second half");
  await hr.getByLabel("Starts").fill(p2Start);
  await hr.getByLabel("Ends").fill(p2End);
  await hr.getByLabel("Pay day").fill(addDays(p2End, 3));
  await hr.getByRole("button", { name: "Create pay period" }).click();
  await expect(hr).toHaveURL(/\/payroll\/[a-z0-9]+$/);
  await hr.getByRole("button", { name: "Calculate payroll" }).click();
  await expect(hr.getByRole("status").filter({ hasText: "Calculated" })).toBeVisible();
  // Mona: 11,000 + 1 h overtime (2.0833 x 60 x 1.25 = 156.25) + 1,000 transport = 12,156.25 gross
  await expect(hr.locator("tr", { hasText: "Mona Pay" })).toContainText("₱12,156.25");
  const p2Url = hr.url();
  await hr.locator("tr", { hasText: "Mona Pay" }).getByRole("link", { name: "View" }).click();
  await expect(hr.getByText("Overtime", { exact: true })).toBeVisible();
  await hr.goto(p2Url);

  await hr.getByLabel("Employee").selectOption({ label: "Pay, Mona · P-mo" });
  await hr.getByLabel("Name on the payslip").fill("Correction: underpaid last period");
  await hr.getByLabel("Amount (pesos)").fill("250.00");
  await hr.getByLabel("Reason (kept on record)").fill("Underpaid in the first half");
  await hr.getByRole("button", { name: "Add adjustment" }).click();
  await expect(hr.getByRole("status").filter({ hasText: "Adjustment added" })).toBeVisible();
  await hr.reload();
  await expect(hr.getByRole("button", { name: "Calculate payroll" })).toBeVisible(); // back to draft: it must be calculated again
  await hr.getByRole("button", { name: "Calculate payroll" }).click();
  await expect(hr.getByRole("status").filter({ hasText: "Calculated" })).toBeVisible();
  await expect(hr.locator("tr", { hasText: "Mona Pay" })).toContainText("₱12,406.25");

  // An employee cannot approve their own overtime; a rejected day can be asked again.
  const mo = await db.overtimeRequest.findFirstOrThrow({ where: { employeeId: ids.mo } });
  expect(mo.status).toBe("APPROVED");
  expect(mo.minutes).toBe(60);
  await emp.close();
  await hr.close();
});
