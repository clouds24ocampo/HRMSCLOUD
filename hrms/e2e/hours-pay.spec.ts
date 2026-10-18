import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { cutoffFor, previousCutoff } from "../src/lib/cutoffs";
import { addDays, dayKey } from "../src/lib/time";
import { wipeOrgs } from "./helpers";

// Default settings of a new organization: monthly salary paid by logged hours, 313 days a year, automatic
// semi-monthly cut-offs, government contributions shown but not deducted, overtime approved by the head then HR.
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const pw = "correct-horse-battery";
const TZ = "Asia/Manila";
const mail = (n: string) => `hp-${n}-${stamp}@example.test`;
const ids: Record<string, string> = {};
const problems: string[] = [];
const today = dayKey(new Date(), TZ);
const prev = previousCutoff(today); // fully in the past, so every day of it is final
const day1 = prev.start;
const day2 = addDays(prev.start, 1);

async function signIn(page: Page, who: string) {
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email").fill(mail(who));
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const role = (k: string) => roles.find((r) => r.key === k)!.id;
  const hash = await bcrypt.hash(pw, 4);
  const org = await db.organization.create({ data: { name: `HoursPay ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  await db.orgSettings.create({ data: { organizationId: org.id, requirePunchPassword: false } });
  const tin = await db.timeStampType.create({ data: { organizationId: org.id, key: "TIME_IN", name: "Time In", kind: "IN", sortOrder: 10, locked: true } });
  const tout = await db.timeStampType.create({ data: { organizationId: org.id, key: "TIME_OUT", name: "Time Out", kind: "OUT", sortOrder: 99, locked: true } });
  const dept = await db.department.create({ data: { organizationId: org.id, name: "Operations" } });
  const headPos = await db.position.create({ data: { organizationId: org.id, title: "Operations Head", level: "DEPT_HEAD", departmentId: dept.id } });
  const person = async (who: string, first: string, roleKey: string, extra: { managerId?: string; positionId?: string; flexible?: boolean } = {}) => {
    const user = await db.user.create({ data: { organizationId: org.id, email: mail(who), name: `${first} Hours`, passwordHash: hash, roleId: role(roleKey) } });
    const e = await db.employee.create({ data: { organizationId: org.id, userId: user.id, employeeNo: `H-${who}`, firstName: first, lastName: "Hours", hireDate: new Date("2025-01-06T00:00:00Z"), departmentId: dept.id, ...extra } });
    ids[who] = e.id;
    return e;
  };
  await person("hr", "Hana", ROLES.HR_ADMIN);
  const head = await person("head", "Hector", ROLES.MANAGER, { positionId: headPos.id });
  await person("emp", "Ella", ROLES.EMPLOYEE, { managerId: head.id, flexible: true });
  await db.compensation.create({ data: { organizationId: org.id, employeeId: ids.emp, payType: "MONTHLY", rateCents: 1_000_000, effectiveFrom: new Date("2025-01-06T00:00:00Z") } });

  const punch = async (day: string, inHm: string, outHm: string) => {
    const at = (hm: string) => new Date(`${day}T${hm}:00+08:00`);
    await db.timeEvent.create({ data: { organizationId: org.id, employeeId: ids.emp, type: "IN", stampTypeId: tin.id, at: at(inHm), gpsStatus: "OK" } });
    await db.timeEvent.create({ data: { organizationId: org.id, employeeId: ids.emp, type: "OUT", stampTypeId: tout.id, at: at(outHm), gpsStatus: "OK" } });
  };
  await punch(day1, "08:00", "15:00"); // 7 hours
  await punch(day2, "08:00", "18:00"); // 10 hours: 8 regular + 2 overtime candidate (flexible: over 8 h)
  await db.overtimeRequest.create({ data: { organizationId: org.id, employeeId: ids.emp, date: new Date(`${day2}T00:00:00Z`), minutes: 120, reason: "Month-end close" } });
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("cut-offs are created on their own and pay the logged hours: 7 h of ₱10,000/month = ₱335.46", async ({ page }) => {
  await signIn(page, "hr");
  await page.goto("/payroll");
  await expect(page.getByText(cutoffFor(today).name, { exact: true }).last()).toBeVisible(); // in the list of pay periods
  await page.getByText(prev.name, { exact: true }).last().click();
  // 7 h (₱335.46) + 8 h (₱383.39); the overtime is not approved yet, so it is not paid.
  await expect(page.locator("tr").filter({ hasText: "Ella Hours" })).toContainText("₱718.85");
  await expect(page.getByText("Automatic, live")).toBeVisible();
  // Live numbers cannot be approved until a person calculates them.
  const period = await db.payrollPeriod.findFirstOrThrow({ where: { organization: { name: `HoursPay ${stamp}` }, name: prev.name } });
  expect(period.calculatedById).toBeNull();
  const slip = await db.payslip.findFirstOrThrow({ where: { periodId: period.id, employeeId: ids.emp }, include: { lines: true } });
  expect(slip.lines.find((l) => l.code === "BASIC")?.detail).toContain("47.9233 an hour");
  expect(slip.deductionsCents).toBe(0); // government contributions are optional and off by default

  // Payroll tab: every employee, and under each one every day with its time stamps, tags and pay.
  await page.goto(`/payroll?standing=${period.id}`);
  const ella = page.getByRole("list", { name: "Employees" }).locator(":scope > li").filter({ hasText: "Hours, Ella" });
  await ella.locator("summary").click();
  await expect(ella.getByText("₱335.46")).toBeVisible(); // the 7-hour day
  await expect(ella.getByText(/Extra 2h.*not approved, not paid/)).toBeVisible();
  await expect(ella.getByText("2 without location").first()).toBeVisible(); // these test stamps were made without GPS
});

test("overtime is paid only after the department head and then HR approve it", async ({ browser }) => {
  const hr = await browser.newPage();
  await signIn(hr, "hr");
  await hr.goto("/overtime");
  await expect(hr.getByText("Ella Hours")).toHaveCount(0); // waiting for the head first

  const head = await browser.newPage();
  await signIn(head, "head");
  await head.goto("/overtime");
  await expect(head.getByText("Step 1 · department head")).toBeVisible();
  await head.getByRole("button", { name: "Approve" }).click();
  await expect(head.getByText("Step 1 · department head")).toHaveCount(0); // done: it moved on to HR
  await expect.poll(async () => (await db.overtimeRequest.findFirstOrThrow({ where: { employeeId: ids.emp } })).headApprovedAt).not.toBeNull();

  await hr.reload();
  await expect(hr.getByText("Step 2 · final (HR)")).toBeVisible();
  await hr.getByRole("button", { name: "Approve" }).click();
  await expect.poll(async () => (await db.overtimeRequest.findFirstOrThrow({ where: { employeeId: ids.emp } })).status).toBe("APPROVED");

  const period = await db.payrollPeriod.findFirstOrThrow({ where: { organization: { name: `HoursPay ${stamp}` }, name: prev.name } });
  await hr.goto(`/payroll/${period.id}`);
  await hr.getByRole("button", { name: /Calculate/ }).click();
  // + 120 min × ₱47.9233 × 1.25 = ₱119.81
  await expect(hr.locator("tr").filter({ hasText: "Ella Hours" })).toContainText("₱838.66");
});

test("HR Home shows government contributions, optional to deduct; the head sees the downline", async ({ page }) => {
  await signIn(page, "hr");
  const row = page.locator("tr").filter({ hasText: "Ella Hours" }).filter({ hasText: "₱10,000.00" }); // the contributions table
  await expect(row).toContainText("₱500.00"); // SSS 5% of ₱10,000
  await expect(row).toContainText("₱250.00"); // PhilHealth 2.5%
  await expect(row).toContainText("₱200.00"); // Pag-IBIG, capped
  await expect(page.getByText("Shown only, not deducted").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Time In" })).toHaveCount(0); // the clock lives on the DTR now

  await page.goto("/organization");
  await page.getByRole("link", { name: /Hector Hours/ }).click();
  await expect(page.getByRole("link", { name: "Ella Hours" }).first()).toBeVisible();

  // Every tab on an employee's profile opens that employee's records, not the admin's own.
  for (const [tab, heading] of [["Performance", "Performance of Ella Hours"], ["Leave", "Leave of Ella Hours"], ["Overtime", "Overtime of Ella Hours"], ["Payslips", "Payslips of Ella Hours"], ["Digital ID", "Digital ID of Ella Hours"]]) {
    await page.goto(`/employees/${ids.emp}`);
    await page.getByRole("navigation", { name: "Ella's records" }).getByRole("link", { name: tab }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("employee: 201 file is mandatory, daily report, own records", async ({ page }) => {
  await signIn(page, "emp");
  await expect(page.getByText("Your 201 file is incomplete.")).toBeVisible();
  await page.getByRole("link", { name: "Upload now" }).click();
  await expect(page).toHaveURL(/\/documents/);
  const item = page.locator("li").filter({ hasText: "NBI Clearance" }).first();
  await item.locator("input[type=file]").setInputFiles({ name: "nbi.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%test\n") });
  await item.getByRole("button", { name: "Upload" }).click();
  await expect(item.getByText("Uploaded.")).toBeVisible();
  expect(await db.employeeDocument.count({ where: { employeeId: ids.emp, category: "201 File", title: "NBI Clearance" } })).toBe(1);

  await page.goto("/daily-report");
  await page.getByLabel("What I worked on today").fill("Closed the month-end payroll checks.");
  await page.getByRole("button", { name: "Send today's report" }).click();
  await expect(page.getByText("Sent. It can no longer be edited")).toBeVisible();
  await expect(page.getByText("Closed the month-end payroll checks.")).toBeVisible();
  // Sent reports are final: a correction is a new report, and the older one is marked replaced.
  await page.getByLabel("What I worked on today").fill("Closed the payroll checks and filed the 1601-C.");
  await page.getByRole("button", { name: "Send a new report for today" }).click();
  await expect(page.getByText("Replaced by a newer report")).toBeVisible();
  expect(await db.dailyReport.count({ where: { employeeId: ids.emp } })).toBe(2);

});

test("policies: the employee reads and e-signs the user agreement; HR sees who signed", async ({ page, browser }) => {
  await db.user.update({ where: { email: mail("emp") }, data: { username: `ella-${stamp}` } });
  // Signs in with the username instead of the email.
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(`ella-${stamp}`);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/policies to read and sign/)).toBeVisible();

  await page.goto("/policies");
  await page.getByRole("link", { name: "User Agreement" }).click();
  const pad = page.getByRole("img", { name: /Signature box/ });
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 60);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 20, box.y + 60 + (i % 2 ? 25 : -15));
  await page.mouse.up();
  await page.getByLabel(/I have read this document/).check();
  await page.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your signature" })).toBeVisible();
  const sig = await db.policySignature.findFirstOrThrow({ where: { employeeId: ids.emp }, include: { policy: true } });
  expect(sig.contentHash).toBe(sig.policy.contentHash);

  const hr = await browser.newPage();
  await signIn(hr, "hr");
  await hr.goto(`/policies/${sig.policyId}`);
  await expect(hr.getByText("Ella Hours").first()).toBeVisible();
  await expect(hr.getByText("1 signed")).toBeVisible();
});

test("digital ID with QR, chat between colleagues, and a head position needs its department", async ({ page }) => {
  await signIn(page, "emp");
  await page.goto("/id");
  await expect(page.getByRole("article", { name: "Employee ID of Ella Hours" })).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code: scan to open/ })).toBeVisible();

  await page.goto("/chat");
  await page.getByRole("button", { name: "Message Hana Hours" }).click();
  await expect(page).toHaveURL(/\/chat\/[a-z0-9]+$/);
  await page.getByRole("textbox", { name: "Message" }).fill("Hello HR, payslip question.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByLabel("Messages").getByText("Hello HR, payslip question.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Video call Hana Hours" })).toBeVisible();
  await expect.poll(() => db.message.count({ where: { sender: { email: mail("emp") } } })).toBe(1);

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "hr");
  await expect(page.getByRole("link", { name: "Chat, 1 unread" })).toBeVisible();
  await page.goto("/organization");
  await page.getByLabel("Position title").fill("Ops Assistant Head");
  await page.locator("#level").selectOption("ASSISTANT_HEAD");
  await expect(page.getByLabel("Assistant head of which department?")).toBeVisible();
  await page.getByLabel("Assistant head of which department?").selectOption({ label: "Operations" });
  await page.getByRole("button", { name: "Add position" }).click();
  await expect(page.getByText("Ops Assistant Head added.")).toBeVisible();
});

test("HR edits an employee, and deletes only someone without work records", async ({ page }) => {
  await signIn(page, "hr");
  // Edit details: saved, and the sign-in name follows.
  await page.goto(`/employees/${ids.emp}`);
  const edit = page.locator("form", { has: page.getByRole("button", { name: "Save details" }) });
  await edit.getByLabel("Phone (optional)").fill("0917 555 0101");
  await edit.getByLabel("Last name").fill("Hours-Santos");
  await edit.getByRole("button", { name: "Save details" }).click();
  await expect(edit.getByText("Saved.")).toBeVisible();
  const ella = await db.employee.findUniqueOrThrow({ where: { id: ids.emp }, include: { user: true } });
  expect([ella.phone, ella.lastName, ella.user?.name]).toEqual(["0917 555 0101", "Hours-Santos", "Ella Hours-Santos"]);
  await db.employee.update({ where: { id: ids.emp }, data: { lastName: "Hours" } });
  await db.user.update({ where: { id: ella.userId! }, data: { name: "Ella Hours" } });

  // Someone with time stamps and payslips cannot be deleted: separate them instead.
  await page.reload();
  const del = page.locator("form", { has: page.getByRole("button", { name: /Delete .* permanently/ }) });
  await del.getByLabel(/Type H-emp to confirm/).fill("H-emp");
  await del.getByRole("button", { name: /permanently/ }).click();
  await expect(del.getByText(/has work records/)).toBeVisible();
  expect(await db.employee.count({ where: { id: ids.emp } })).toBe(1);

  // Added by mistake, no records: deleted with their sign-in.
  const org = await db.organization.findFirstOrThrow({ where: { name: `HoursPay ${stamp}` } });
  const role = await db.role.findFirstOrThrow({ where: { key: ROLES.EMPLOYEE } });
  const user = await db.user.create({ data: { organizationId: org.id, email: mail("oops"), name: "Oops Wrong", passwordHash: "x", roleId: role.id } });
  const oops = await db.employee.create({ data: { organizationId: org.id, userId: user.id, employeeNo: "H-oops", firstName: "Oops", lastName: "Wrong", hireDate: new Date() } });
  await page.goto(`/employees/${oops.id}`);
  await page.getByLabel("Type H-oops to confirm").fill("H-oops");
  await page.getByRole("button", { name: "Delete Oops Wrong permanently" }).click();
  await expect(page).toHaveURL(/\/employees$/);
  expect(await db.employee.count({ where: { id: oops.id } })).toBe(0);
  expect(await db.user.count({ where: { id: user.id } })).toBe(0);
});

test("Super Admin deletes an employee together with their records (finalized payslips always block it)", async ({ page }) => {
  const org = await db.organization.findFirstOrThrow({ where: { name: `HoursPay ${stamp}` } });
  const [sa, emp] = await Promise.all([db.role.findFirstOrThrow({ where: { key: ROLES.SUPER_ADMIN } }), db.role.findFirstOrThrow({ where: { key: ROLES.EMPLOYEE } })]);
  const hash = await bcrypt.hash(pw, 4);
  const boss = await db.user.create({ data: { organizationId: org.id, email: mail("sa"), name: "Sara Admin", passwordHash: hash, roleId: sa.id } });
  await db.employee.create({ data: { organizationId: org.id, userId: boss.id, employeeNo: "H-sa", firstName: "Sara", lastName: "Admin", hireDate: new Date() } });
  const u = await db.user.create({ data: { organizationId: org.id, email: mail("tmp"), name: "Temp Worker", passwordHash: hash, roleId: emp.id } });
  const t = await db.employee.create({ data: { organizationId: org.id, userId: u.id, employeeNo: "H-tmp", firstName: "Temp", lastName: "Worker", hireDate: new Date() } });
  await db.timeEvent.create({ data: { organizationId: org.id, employeeId: t.id, type: "IN", gpsStatus: "OK" } });

  await signIn(page, "sa");
  await page.goto(`/employees/${t.id}`);
  await page.getByLabel("Type H-tmp to confirm").fill("h-tmp"); // not case sensitive
  await page.getByRole("button", { name: "Delete Temp Worker permanently" }).click();
  await expect(page.getByText(/Tick “Also delete all their records”/)).toBeVisible();
  await page.getByLabel(/Also delete all their records/).check();
  await page.getByRole("button", { name: "Delete Temp Worker permanently" }).click();
  await expect(page).toHaveURL(/\/employees$/);
  expect(await db.employee.count({ where: { id: t.id } })).toBe(0);
  expect(await db.timeEvent.count({ where: { employeeId: t.id } })).toBe(0);
  expect(await db.auditLog.count({ where: { action: "employee.deleted_with_records", entityId: t.id } })).toBe(1);
});

test("payslips: only cut-offs with time stamps are listed, and the newest opens by itself with its pay so far", async ({ page }) => {
  await signIn(page, "emp");
  await page.goto("/payslips");
  const picker = page.getByLabel("Cut-off");
  // Ella has time stamps only in the previous cut-off: that is the only option, and it opens on its own.
  await expect(picker.locator("option")).toHaveText([prev.name]);
  await expect(page.getByRole("heading", { name: prev.name, exact: true })).toBeVisible();
  await expect(page.getByText("Waiting for payroll to be finalized")).toBeVisible();
  await expect(page.getByText("₱838.66").first()).toBeVisible(); // 7 h + 8 h + approved overtime, same as the payroll
});

test("cash advance: requested, confirmed by HR, deducted only on the payslip HR picks", async ({ browser }) => {
  const emp = await browser.newPage();
  await signIn(emp, "emp");
  await emp.goto("/cash-advance");
  await emp.getByLabel("Amount (pesos)").fill("3000");
  await emp.getByLabel("Reason").fill("School tuition for my son");
  await emp.getByRole("button", { name: "Request cash advance" }).click();
  await expect(emp.getByText("Requested ₱3,000.00")).toBeVisible();

  const hr = await browser.newPage();
  await signIn(hr, "hr");
  await hr.goto("/cash-advance");
  await expect(hr.getByText("School tuition for my son").first()).toBeVisible();
  await hr.getByRole("button", { name: "Approve" }).click();
  await expect.poll(async () => (await db.cashAdvance.findFirstOrThrow({ where: { employeeId: ids.emp } })).status).toBe("APPROVED");
  // Confirming deducts nothing: it stays "not deducted yet" until HR picks the payslip.
  expect((await db.cashAdvance.findFirstOrThrow({ where: { employeeId: ids.emp } })).firstCutoff).toBeNull();
  await emp.goto("/cash-advance");
  await expect(emp.getByText("Confirmed · not deducted yet")).toBeVisible();
  await expect(emp.getByText(/Confirmed by Hana Hours on/)).toBeVisible();

  await hr.reload();
  await hr.locator("select[name=firstCutoff]").first().selectOption(cutoffFor(today).start);
  await hr.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect.poll(async () => (await db.cashAdvance.findFirstOrThrow({ where: { employeeId: ids.emp } })).firstCutoff?.toISOString().slice(0, 10)).toBe(cutoffFor(today).start);

  const current = await db.payrollPeriod.findFirstOrThrow({ where: { organization: { name: `HoursPay ${stamp}` }, name: cutoffFor(today).name } });
  await hr.goto(`/payroll/${current.id}`);
  await hr.getByRole("button", { name: /Calculate/ }).click();
  await expect.poll(async () => (await db.payslipLine.findFirst({ where: { label: { in: ["Cash advance", "Cash advance repayment"] }, payslip: { periodId: current.id, employeeId: ids.emp } } }))?.amountCents).toBe(300_000);
  // Standing pay on Payroll lists everyone for the cut-off, with the advance already taken off.
  await hr.goto(`/payroll?standing=${current.id}`);
  await expect(hr.getByRole("heading", { name: `Standing pay · ${current.name}` })).toBeVisible();
  const ella = hr.getByRole("list", { name: "Employees" }).locator(":scope > li").filter({ hasText: "Hours, Ella" });
  await ella.locator("summary").click();
  await expect(ella).toContainText("deductions ₱3,000.00");
  await emp.goto("/cash-advance");
  await expect(emp.getByText(`To be deducted on the ${cutoffFor(today).name} payslip`, { exact: false })).toBeVisible();
});

test("payslip: every deduction listed (government marked not deducted), HR records the amount paid with proof, the employee confirms", async ({ browser }) => {
  const period = await db.payrollPeriod.findFirstOrThrow({ where: { organization: { name: `HoursPay ${stamp}` }, name: prev.name } });
  await db.payrollPeriod.update({ where: { id: period.id }, data: { status: "FINALIZED", approvedAt: new Date(), finalizedAt: new Date() } });
  const slip = await db.payslip.findFirstOrThrow({ where: { periodId: period.id, employeeId: ids.emp } });

  const hr = await browser.newPage();
  await signIn(hr, "hr");
  await hr.goto(`/payslips/${slip.id}`);
  await expect(hr.getByText("Government contributions and tax")).toBeVisible();
  await expect(hr.getByText("Not deducted").first()).toBeVisible();
  await expect(hr.getByText("Net pay to receive")).toBeVisible();
  await hr.getByLabel("Amount actually paid (pesos)").fill("838.66");
  await hr.getByLabel("Paid by").selectOption("GCash");
  await hr.getByLabel("Reference no. (optional)").fill("GC-12345");
  await hr.locator("input[name=proof]").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") });
  await hr.getByRole("button", { name: "Record payment" }).click();
  await expect(hr.getByText("Waiting for employee")).toBeVisible(); // the form folds away once a payment is on record

  const emp = await browser.newPage();
  await signIn(emp, "emp");
  await emp.goto(`/payslips/${slip.id}`);
  await expect(emp.getByRole("link", { name: /Open proof of payment/ })).toBeVisible();
  await emp.getByRole("button", { name: "I received ₱838.66" }).click();
  await expect(emp.getByText("Confirmed by employee")).toBeVisible();
  const p = await db.payout.findFirstOrThrow({ where: { payslipId: slip.id } });
  expect([p.status, p.method, p.amountCents, !!p.proofKey]).toEqual(["CONFIRMED", "GCash", 83_866, true]);
});

test("a phone time stamp without location is refused", async ({ browser }) => {
  // A phone (mobile user agent) with location blocked.
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  await db.orgSettings.updateMany({ where: { organization: { name: `HoursPay ${stamp}` } }, data: { requirePunchPassword: false } });
  await signIn(page, "hr");
  await page.goto("/dtr");
  const before = await db.timeEvent.count({ where: { employee: { userId: { not: null }, user: { email: mail("hr") } } } });
  await page.getByRole("region", { name: "Time clock" }).getByRole("button", { name: /Time In/ }).click();
  await expect(page.getByRole("region", { name: "Time clock" }).locator("p[role=alert]")).toContainText(/location/i);
  expect(await db.timeEvent.count({ where: { employee: { user: { email: mail("hr") } } } })).toBe(before);
  await ctx.close();
});

test("daily report comments: the supervisor comments, the employee replies, HR joins, and each is notified", async ({ browser }) => {
  const report = await db.dailyReport.create({ data: { organizationId: (await db.organization.findFirstOrThrow({ where: { name: `HoursPay ${stamp}` } })).id, employeeId: ids.emp, date: new Date(`${today}T00:00:00Z`), accomplishments: "Report for the comment thread" } });

  const head = await browser.newPage();
  await signIn(head, "head");
  await head.goto("/daily-report");
  await head.getByText("💬 Comments").first().click();
  await head.getByPlaceholder("Add a comment").first().fill("Please attach the ticket numbers.");
  await head.getByRole("button", { name: "Send", exact: true }).first().click();
  await expect(head.getByText("Comment sent.")).toBeVisible();
  const c = await db.dailyReportComment.findFirstOrThrow({ where: { reportId: report.id } });
  expect(c.parentId).toBeNull();
  expect(await db.notification.count({ where: { userId: (await db.user.findFirstOrThrow({ where: { email: mail("emp") } })).id, title: { contains: "commented on" } } })).toBe(1);

  const emp = await browser.newPage();
  await signIn(emp, "emp");
  await emp.goto("/daily-report");
  await expect(emp.getByText("Please attach the ticket numbers.")).toBeVisible(); // the thread is open: there is a comment
  await expect(emp.getByText("Hector Hours")).toBeVisible();
  await emp.getByText("Reply", { exact: true }).first().click();
  await emp.getByPlaceholder("Write a reply").fill("Done: tickets 101 to 105.");
  await emp.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(emp.getByText("Reply sent.")).toBeVisible();
  const reply = await db.dailyReportComment.findFirstOrThrow({ where: { reportId: report.id, parentId: c.id } });
  expect(reply.body).toBe("Done: tickets 101 to 105.");

  const hr = await browser.newPage();
  await signIn(hr, "hr");
  await hr.goto(`/daily-report?employee=${ids.emp}`);
  await expect(hr.getByText("Done: tickets 101 to 105.")).toBeVisible(); // HR reads the whole thread
  await hr.getByPlaceholder("Add a comment").first().fill("Thanks both, noted.");
  await hr.getByRole("button", { name: "Send", exact: true }).first().click();
  await expect(hr.getByText("Comment sent.")).toBeVisible();
  expect(await db.dailyReportComment.count({ where: { reportId: report.id } })).toBe(3);
});
