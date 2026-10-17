import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { addDays, weekStart } from "../src/lib/time";
import { LEGACY_PAY, wipeOrgs } from "./helpers";

// Philippine statutory payroll end to end: install the dated rules, set profiles, run a monthly and a weekly payroll,
// check every number against the worked examples in taxation.md and by hand, then 13th month, year-end adjustment, government bonus and the BIR/remittance reports.
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const pw = "correct-horse-battery";
const mail = (n: string) => `ph-${n}-${stamp}@example.test`;
const ids: Record<string, string> = {};
const periodIds: Record<string, string> = {};
const problems: string[] = [];
const peso = (n: number) => Math.round(n * 100);

const monthStart = "2026-08-01";
const monthEnd = "2026-08-31";
const monthPay = "2026-09-04";
const wk = weekStart("2026-09-17"); // a Monday
const wkEnd = addDays(wk, 6);
const wkHoliday = addDays(wk, 2); // Wednesday

async function signIn(page: Page, who: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(mail(who));
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
const watch = (page: Page) => {
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/geolocation|status of 404/i.test(m.text())) problems.push(`console: ${m.text()}`);
  });
};
const orgName = () => `Philippines ${stamp}`;
const lines = async (periodId: string, who: string) => {
  const s = await db.payslip.findFirstOrThrow({ where: { periodId, employeeId: ids[who] }, include: { lines: true } });
  const get = (label: string) => s.lines.find((l) => l.label === label)?.amountCents ?? 0;
  return { s, get };
};

async function createPeriod(page: Page, o: { name: string; start: string; end: string; pay: string; often?: string; kind?: string; incentive?: string; yearEnd?: boolean }) {
  await page.goto("/payroll");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Create pay period" }) });
  await form.getByLabel("Name", { exact: true }).fill(o.name);
  await form.getByLabel("Starts").fill(o.start);
  await form.getByLabel("Ends").fill(o.end);
  await form.getByLabel("Pay day").fill(o.pay);
  await form.getByLabel("How often do you pay?").selectOption(o.often ?? "1");
  if (o.kind) await form.getByLabel("What does this payroll pay?").selectOption(o.kind);
  if (o.incentive) await form.getByLabel("Which one").selectOption(o.incentive);
  if (o.yearEnd) await form.getByLabel(/Year-end tax adjustment/).check();
  await form.getByRole("button", { name: "Create pay period" }).click();
  await expect(page).toHaveURL(/\/payroll\/[a-z0-9]+$/);
  const id = page.url().split("/").pop()!;
  periodIds[o.name] = id;
  return id;
}
async function calculate(page: Page) {
  await page.getByRole("button", { name: /Calculate/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /Calculated \d+ payslip/ })).toBeVisible();
}

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const role = (k: string) => roles.find((r) => r.key === k)!.id;
  const hash = await bcrypt.hash(pw, 4);
  const org = await db.organization.create({ data: { name: orgName(), categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  await db.orgSettings.create({ data: { organizationId: org.id, requirePunchPassword: false, ...LEGACY_PAY, daysPerYear: 261 } });
  const shift = await db.shiftTemplate.create({ data: { organizationId: org.id, name: "Regular", startTime: "08:00", endTime: "17:00", breakMinutes: 60 } });
  await db.timeStampType.createMany({
    data: [
      { organizationId: org.id, key: "TIME_IN", name: "Time In", kind: "IN", sortOrder: 10, locked: true },
      { organizationId: org.id, key: "TIME_OUT", name: "Time Out", kind: "OUT", sortOrder: 99, locked: true },
    ],
  });
  const tin = await db.timeStampType.findFirstOrThrow({ where: { organizationId: org.id, key: "TIME_IN" } });
  const tout = await db.timeStampType.findFirstOrThrow({ where: { organizationId: org.id, key: "TIME_OUT" } });
  const person = async (who: string, first: string, roleKey: string, pay?: { type: "MONTHLY" | "DAILY"; cents: number }) => {
    const user = await db.user.create({ data: { organizationId: org.id, email: mail(who), name: `${first} Ph`, passwordHash: hash, roleId: role(roleKey) } });
    const e = await db.employee.create({ data: { organizationId: org.id, userId: user.id, employeeNo: `PH-${who}`, firstName: first, lastName: "Ph", hireDate: new Date("2025-01-06T00:00:00Z") } });
    ids[who] = e.id;
    if (pay) await db.compensation.create({ data: { organizationId: org.id, employeeId: e.id, payType: pay.type, rateCents: pay.cents, effectiveFrom: new Date("2025-01-06T00:00:00Z") } });
    return e;
  };
  await person("sa", "Sam", ROLES.SUPER_ADMIN);
  await person("hr", "Hana", ROLES.HR_ADMIN);
  await person("mo", "Mona", ROLES.EMPLOYEE, { type: "MONTHLY", cents: peso(25000) }); // no tax profile on purpose
  await person("gv", "Gus", ROLES.EMPLOYEE, { type: "MONTHLY", cents: peso(30000) }); // government: set through the screen
  const dan = await person("da", "Dan", ROLES.EMPLOYEE, { type: "DAILY", cents: peso(1000) });
  await db.employeeTaxProfile.create({ data: { organizationId: org.id, employeeId: dan.id, sector: "PRIVATE", wageBasis: "FIVE_DAY_261", effectiveFrom: new Date("2025-01-06T00:00:00Z") } });
  await db.regularSchedule.create({ data: { organizationId: org.id, employeeId: dan.id, shiftId: shift.id, workDays: [1, 2, 3, 4, 5], effectiveFrom: new Date("2025-01-06T00:00:00Z") } });
  for (let i = 0; i < 5; i++) {
    const day = addDays(wk, i);
    const at = (hm: string) => new Date(`${day}T${hm}:00+08:00`);
    await db.timeEvent.create({ data: { organizationId: org.id, employeeId: dan.id, type: "IN", stampTypeId: tin.id, at: at("08:00"), gpsStatus: "OK" } });
    await db.timeEvent.create({ data: { organizationId: org.id, employeeId: dan.id, type: "OUT", stampTypeId: tout.id, at: at("17:00"), gpsStatus: "OK" } });
  }
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("rules: switching on is refused until they are installed; install is safe to repeat", async ({ page }) => {
  watch(page);
  await signIn(page, "hr");
  await page.goto("/payroll/setup");
  const profile = page.locator("form", { has: page.getByLabel("Rates come from") });
  await profile.getByLabel("Rates come from").selectOption("PHILIPPINES");
  await profile.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("p[role=alert]").first()).toContainText("Install the Philippine rules first");

  await page.goto("/payroll/rules");
  await expect(page.getByText("11 missing")).toBeVisible();
  const install = page.getByRole("heading", { name: "Install the starter rules" }).locator("xpath=../..");
  await install.getByRole("button", { name: "Both" }).click();
  await expect(install.getByRole("status")).toContainText("rules added");
  await page.reload();
  await expect(page.getByText("complete", { exact: true })).toBeVisible();
  await install.getByRole("button", { name: "Both" }).click();
  await expect(install.getByRole("status")).toContainText("0 rules added");
  expect(await db.statutoryRule.count({ where: { organization: { name: orgName() }, code: "SSS" } })).toBe(1);

  const leaves = page.getByRole("heading", { name: "Statutory leave types" }).locator("xpath=../..");
  await leaves.getByRole("button", { name: "Both" }).click();
  await expect(leaves.getByRole("status")).toContainText("Maternity leave");
  expect(await db.leaveType.count({ where: { organization: { name: orgName() }, name: { in: ["Maternity leave", "Vacation leave (Civil Service)", "Service incentive leave"] } } })).toBe(3);

  await page.goto("/payroll/setup");
  await profile.getByLabel("Rates come from").selectOption("PHILIPPINES");
  await profile.getByRole("button", { name: "Save" }).click();
  await expect(profile.getByRole("status")).toContainText("Saved");
  expect((await db.orgSettings.findFirstOrThrow({ where: { organization: { name: orgName() } } })).statutoryProfile).toBe("PHILIPPINES");
});

test("rules: a new version ends the old one the day before; bad parameters and overlaps are refused", async ({ page }) => {
  await signIn(page, "hr");
  await page.goto("/payroll/rules");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Save this version" }).or(page.getByLabel("Rule to update")) });
  await form.getByLabel("Rule to update").selectOption("DM_RICE");
  const params = form.getByLabel(/Parameters/);
  const current = JSON.parse(await params.inputValue());
  await form.getByLabel("In force from").fill("2027-01-01");
  await form.getByLabel(/Where this comes from/).fill("Test circular 2027");
  await params.fill("{ not json");
  await form.getByRole("button", { name: "Save this version" }).click();
  await expect(form.locator("p[role=alert]")).toContainText("not valid JSON");
  await params.fill(JSON.stringify({ ...current, per: "WEEKLY" }));
  await form.getByRole("button", { name: "Save this version" }).click();
  await expect(form.locator("p[role=alert]")).toContainText("Parameters");
  await params.fill(JSON.stringify({ ...current, ceilingCents: 300000 }));
  await form.getByRole("button", { name: "Save this version" }).click();
  await expect(form.getByRole("status")).toContainText("DM_RICE saved, in force from 2027-01-01");
  await expect(form.getByLabel("Rule to update")).toHaveValue(""); // the form clears itself after a save
  const rows = await db.statutoryRule.findMany({ where: { organization: { name: orgName() }, code: "DM_RICE" }, orderBy: { effectiveFrom: "asc" } });
  expect(rows.length).toBe(2);
  expect(rows[0].effectiveTo!.toISOString().slice(0, 10)).toBe("2026-12-31"); // the old version ends the day before
  expect((rows[1].params as { ceilingCents: number }).ceilingCents).toBe(300000);
  expect((rows[0].params as { ceilingCents: number }).ceilingCents).toBe(250000); // 2026 payrolls keep ₱2,500
  // Dates that overlap an existing version (with an end date on the new one) are refused.
  await form.getByLabel("Rule to update").selectOption("DM_RICE");
  await form.getByLabel(/Where this comes from/).fill("Test circular overlap");
  await form.getByLabel("In force from").fill("2026-06-01");
  await form.getByLabel("Until (leave empty if open-ended)").fill("2026-06-30");
  await form.getByRole("button", { name: "Save this version" }).click();
  await expect(form.locator("p[role=alert]")).toContainText("overlaps");
});

test("holidays and wage orders", async ({ page }) => {
  await signIn(page, "hr");
  await page.goto("/payroll/holidays?year=2026");
  await page.getByRole("button", { name: "Add the holidays fixed by law" }).click();
  await expect(page.getByText(/15 holidays added for 2026/)).toBeVisible();
  await expect(page.getByText("Good Friday")).toBeVisible();
  await expect(page.getByText("Christmas Day")).toBeVisible();
  await expect(page.getByText("Rizal Day")).toBeVisible();
  await page.getByRole("button", { name: "Add the holidays fixed by law" }).click();
  await expect(page.getByText(/0 holidays added for 2026/)).toBeVisible();
  // Good Friday 2026 is April 3 (Easter is April 5).
  expect(await db.holiday.count({ where: { organization: { name: orgName() }, date: new Date("2026-04-03T00:00:00Z"), type: "REGULAR" } })).toBe(1);

  const add = page.locator("form", { has: page.getByRole("button", { name: "Add holiday" }) });
  await add.getByLabel("Date").fill(wkHoliday);
  await add.getByLabel("Name").fill("Test proclaimed holiday");
  await add.getByLabel("Kind").selectOption("REGULAR");
  await add.getByRole("button", { name: "Add holiday" }).click();
  await expect(add.getByRole("status")).toContainText("added");
  await add.getByLabel("Date").fill(wkHoliday);
  await add.getByLabel("Name").fill("Test proclaimed holiday");
  await add.getByLabel("Kind").selectOption("REGULAR");
  await add.getByRole("button", { name: "Add holiday" }).click();
  await expect(add.locator("p[role=alert]")).toContainText("already in the calendar");

  await page.goto("/payroll/rules");
  const wage = page.locator("form", { has: page.getByRole("button", { name: "Add wage order" }) });
  await wage.getByLabel("Region").fill("NCR");
  await wage.getByLabel("Wage order number").fill("NCR-TEST");
  await wage.getByLabel("Daily minimum wage (pesos)").fill("695.00");
  await wage.getByLabel("In force from").fill("2026-01-01");
  await wage.getByRole("button", { name: "Add wage order" }).click();
  await expect(wage.getByRole("status")).toContainText("NCR wage order NCR-TEST saved");
  await expect(page.getByText("₱695.00 a day")).toBeVisible();
});

test("tax profile: set on the employee's page; HR only", async ({ page, browser }) => {
  await signIn(page, "hr");
  await page.goto(`/employees/${ids.gv}`);
  await expect(page.getByText("No tax profile yet")).toBeVisible();
  await page.getByText("Set tax profile").click();
  const form = page.locator("form", { has: page.getByRole("button", { name: "Save tax profile" }) });
  await form.getByLabel("Employee type").selectOption("GOVERNMENT");
  await form.getByLabel("Starts on").fill("2025-01-06");
  await form.getByLabel("TIN", { exact: true }).fill("123-456-789-000");
  await form.getByLabel("GSIS number").fill("GS-1");
  await form.getByRole("button", { name: "Save tax profile" }).click();
  await expect(form.getByRole("status")).toContainText("saved from 2025-01-06");
  await page.reload();
  await expect(page.getByText("Government employee (GSIS)")).toBeVisible();
  const p = await db.employeeTaxProfile.findFirstOrThrow({ where: { employeeId: ids.gv } });
  expect([p.sector, p.tin, p.gsisNo, p.socialCovered]).toEqual(["GOVERNMENT", "123-456-789-000", "GS-1", true]);

  const mo = await browser.newPage();
  await signIn(mo, "mo");
  await mo.goto(`/employees/${ids.mo}`);
  await expect(mo.getByText("Tax and contributions")).toHaveCount(0); // not even your own tax profile: HR only
  await mo.close();
});

test("monthly payroll reproduces the worked examples in taxation.md", async ({ page }) => {
  await signIn(page, "hr");
  const id = await createPeriod(page, { name: "August 2026", start: monthStart, end: monthEnd, pay: monthPay, often: "1" });
  await calculate(page);

  // Mona: ₱25,000, private. taxation.md section 4: SSS 1,250, PhilHealth 625, Pag-IBIG 200, tax 313.80, net 22,611.20.
  const m = await lines(id, "mo");
  expect([m.get("SSS"), m.get("PhilHealth"), m.get("Pag-IBIG"), m.get("Withholding tax")]).toEqual([peso(1250), peso(625), peso(200), peso(313.8)]);
  expect(m.s.netCents).toBe(peso(22611.2));
  expect([m.get("SSS (employer share)"), m.get("SSS EC (employer only)"), m.get("PhilHealth (employer share)"), m.get("Pag-IBIG (employer share)")]).toEqual([peso(2500), peso(30), peso(625), peso(200)]);
  expect([m.s.taxableCents, m.s.taxWithheldCents, m.s.mandatoryEeCents]).toEqual([peso(22925), peso(313.8), peso(2075)]);

  // Gus: ₱30,000, government. GSIS 9% / 12%, PhilHealth 750, Pag-IBIG 200, taxable 26,350, tax 827.55.
  const g = await lines(id, "gv");
  expect([g.get("GSIS"), g.get("GSIS (employer share)"), g.get("PhilHealth"), g.get("Pag-IBIG"), g.get("SSS")]).toEqual([peso(2700), peso(3600), peso(750), peso(200), 0]);
  expect([g.get("Withholding tax"), g.s.netCents]).toEqual([peso(827.55), peso(25522.45)]);

  // The screen explains it, and warns about the missing profile.
  await page.goto(`/payslips/${m.s.id}`);
  await expect(page.getByText("Tax summary")).toBeVisible();
  await expect(page.getByText(/No tax profile: treated as a private employee/)).toBeVisible();
  await expect(page.getByText(/Salary credit 25,000\.00/).first()).toBeVisible();
  await page.goto(`/payslips/${g.s.id}`);
  await expect(page.getByText(/No tax profile/)).toHaveCount(0);
});

test("weekly payroll: daily-paid staff, a worked regular holiday, weekly table and weekly contribution share", async ({ page }) => {
  await signIn(page, "hr");
  const id = await createPeriod(page, { name: "Week of Sept 14", start: wk, end: wkEnd, pay: addDays(wkEnd, 2), often: "4" });
  await calculate(page);
  const d = await lines(id, "da");
  expect(d.get("Basic pay")).toBe(peso(5000)); // 5 days x 1,000
  expect(d.get("Holiday premium")).toBe(peso(1000)); // hourly 125 x 8 hours x (200% - 100%) on the worked regular holiday
  // Contributions on the monthly equivalent (1,000 x 261 / 12 = 21,750), one week's share of a month (x 12 / 52).
  expect([d.get("SSS"), d.get("PhilHealth"), d.get("Pag-IBIG")]).toEqual([25385, 12548, 4615]);
  // taxable 6,000 - 425.48 = 5,574.52 on the weekly table: 15% over 4,808 = 114.98
  expect([d.s.taxableCents, d.get("Withholding tax"), d.s.netCents]).toEqual([557452, 11498, 545954]);
  expect(d.s.grossCents).toBe(peso(6000));
  expect(((d.s.inputs as { warnings?: string[] }).warnings ?? []).filter((w) => !/not finalized/.test(w))).toEqual([]);
});

test("approval by a second person, finalize, then the remittance and BIR reports", async ({ page, browser }) => {
  watch(page);
  const hr = page;
  await signIn(hr, "hr");
  await hr.goto(`/payroll/${periodIds["August 2026"]}`);
  await hr.getByRole("button", { name: "Calculate again" }).click();
  await expect(hr.getByRole("status").filter({ hasText: /Calculated \d+ payslip/ })).toBeVisible();
  const sa = await browser.newPage();
  await signIn(sa, "sa");
  await sa.goto(`/payroll/${periodIds["August 2026"]}`);
  await sa.getByRole("button", { name: "Approve" }).click();
  await expect(sa.locator("p[role=status]")).toContainText("Approved");
  sa.once("dialog", (d) => d.accept());
  await sa.getByRole("button", { name: "Finalize and lock" }).click();
  await expect(sa.locator("p[role=status]")).toContainText("Finalized");
  await sa.close();

  // Sept reports: the pay day of August's payroll falls in September.
  await hr.goto("/payroll/reports?month=2026-09&year=2026");
  const sss = hr.getByRole("heading", { name: /^SSS · 1 employee/ });
  await expect(sss).toContainText("total ₱3,780.00"); // 1,250 + 2,500 + 30
  await expect(hr.getByRole("heading", { name: /^GSIS · 1 employee · total ₱6,300\.00/ })).toBeVisible(); // 2,700 + 3,600
  await expect(hr.getByRole("heading", { name: /^PhilHealth · 2 employees · total ₱2,750\.00/ })).toBeVisible(); // 1,250 + 1,500
  await expect(hr.getByRole("heading", { name: /^Pag-IBIG · 2 employees · total ₱800\.00/ })).toBeVisible();
  await expect(hr.getByRole("region", { name: "Monthly remittances" }).getByText("Not finalized, so not counted: Week of Sept 14")).toBeVisible();
  const tax = hr.getByRole("region", { name: "BIR 1601-C" });
  await expect(tax).toContainText("₱1,141.35"); // 313.80 + 827.55
  await expect(tax).toContainText("₱55,000.00"); // total compensation

  const csv = await hr.request.get("/payroll/reports/export?type=SSS&month=2026-09");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("PH-mo,Mona Ph,,,1250.00,2500.00,30.00,3780.00"); // employee no, name, SSS no, TIN, employee, employer, EC, total
  expect((await hr.request.get("/payroll/reports/export?type=1601C&month=2026-09")).headers()["content-type"]).toContain("text/csv");
  expect((await hr.request.get("/payroll/reports/export?type=NOPE&month=2026-09")).status()).toBe(400);
  expect((await hr.request.get("/payroll/reports/export?type=SSS&month=bad")).status()).toBe(400);

  await hr.goto(`/payroll/reports/2316/${ids.mo}?year=2026`);
  await expect(hr.getByRole("heading", { name: /BIR Form 2316 data: Ph, Mona/ })).toBeVisible();
  await expect(hr.getByText("No TIN on the tax profile")).toBeVisible();
  await expect(hr.getByText("Tax withheld (including earlier employers and year-end adjustment)")).toBeVisible();
  // Gus has a TIN.
  await hr.goto(`/payroll/reports/2316/${ids.gv}?year=2026`);
  await expect(hr.getByText(/TIN 123-456-789-000/)).toBeVisible();
  await hr.goto("/payroll/reports?month=2026-09&year=2026");
  await expect(hr.getByText(/over: do the year-end adjustment|short: do the year-end adjustment/).first()).toBeVisible(); // tax due for the year is 0, tax was withheld
});

test("13th month with the year-end adjustment refunds what the year's total tax does not need", async ({ page }) => {
  await signIn(page, "hr");
  const id = await createPeriod(page, { name: "13th month 2026", start: "2026-12-01", end: "2026-12-15", pay: "2026-12-15", kind: "THIRTEENTH_MONTH", yearEnd: true });
  await calculate(page);
  const m = await lines(id, "mo");
  expect(m.get("13th month pay")).toBe(Math.round(peso(25000) / 12)); // 2,083.33: one twelfth of the basic pay earned
  expect([m.s.benefitsExemptCents, m.s.benefitsTaxableCents, m.get("SSS"), m.get("Withholding tax")]).toEqual([208333, 0, 0, 0]);
  // The year's taxable pay (22,925) is under ₱250,000, so the 313.80 withheld in August comes back.
  const adj = m.s.taxWithheldCents;
  expect(adj).toBe(-31380);
  expect(m.s.netCents).toBe(208333 + 31380);
  const g = await lines(id, "gv");
  expect(g.get("13th month pay")).toBe(250000);
  expect(g.s.taxWithheldCents).toBe(-82755);
  // Dan has no finalized pay yet: nothing to take a twelfth of, and the screen says why. The unfinalized week is flagged on everyone.
  const d = await lines(id, "da");
  expect(d.get("13th month pay")).toBe(0);
  const warns = (m.s.inputs as { warnings?: string[] }).warnings ?? [];
  expect(warns.join(" ")).toMatch(/Earlier payroll.*not finalized \(Week of Sept 14\)/);
  await page.goto(`/payroll/${id}`);
  await expect(page.getByText("13th month pay").first()).toBeVisible();
  await expect(page.getByText("Year-end tax adjustment")).toBeVisible();
});

test("government year-end bonus: eligible staff only, within the yearly exemption", async ({ page }) => {
  await signIn(page, "hr");
  // A bonus run for a private-only organization is refused; Gus is the only government employee.
  const id = await createPeriod(page, { name: "Year-end bonus 2026", start: "2026-12-01", end: "2026-12-20", pay: "2026-12-20", kind: "GOV_INCENTIVE", incentive: "GOV_YEAREND" });
  await calculate(page);
  const g = await lines(id, "gv");
  expect(g.get("Year-end bonus and cash gift")).toBe(peso(35000)); // one month of basic pay + ₱5,000 cash gift
  expect([g.s.benefitsExemptCents, g.s.benefitsTaxableCents]).toEqual([peso(35000), 0]);
  expect(await db.payslip.count({ where: { periodId: id } })).toBe(1); // Mona, Dan and the rest are not government employees
  // The same bonus cannot be paid twice in a year.
  await page.goto("/payroll");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Create pay period" }) });
  await form.getByLabel("Name", { exact: true }).fill("Year-end bonus again");
  await form.getByLabel("Starts").fill("2026-12-01");
  await form.getByLabel("Ends").fill("2026-12-20");
  await form.getByLabel("Pay day").fill("2026-12-21");
  await form.getByLabel("What does this payroll pay?").selectOption("GOV_INCENTIVE");
  await form.getByLabel("Which one").selectOption("GOV_YEAREND");
  await form.getByRole("button", { name: "Create pay period" }).click();
  await expect(form.locator("p[role=alert]")).toContainText("already pays this");
});

test("leaving someone out of a payroll, and keeping the manual payroll for organizations that want it", async ({ page }) => {
  await signIn(page, "hr");
  await page.goto(`/payroll/${periodIds["13th month 2026"]}`);
  await expect(page.getByRole("heading", { name: "Who is included" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Ph, Mona" }).check();
  await page.getByRole("button", { name: "Save the list" }).click();
  await expect(page.locator("p[role=status]").filter({ hasText: "1 left out" })).toBeVisible();
  await page.getByRole("button", { name: "Calculate payroll" }).click();
  await expect(page.locator("p[role=status]").filter({ hasText: /Mona Ph \(Left out of this payroll\)/ })).toBeVisible();
  expect(await db.payslip.count({ where: { periodId: periodIds["13th month 2026"], employeeId: ids.mo } })).toBe(0);

  // Switching back to entered-by-hand rates keeps working (the old payroll is untouched).
  await page.goto("/payroll/setup");
  const profile = page.locator("form", { has: page.getByLabel("Rates come from") });
  await profile.getByLabel("Rates come from").selectOption("MANUAL");
  await profile.getByRole("button", { name: "Save" }).click();
  await expect(profile.getByRole("status")).toContainText("Saved");
  expect((await db.payslip.findFirstOrThrow({ where: { periodId: periodIds["August 2026"], employeeId: ids.mo } })).taxWithheldCents).toBe(31380);
});

test("employees cannot reach rules, holidays, reports or their exports", async ({ page }) => {
  await signIn(page, "mo");
  for (const path of ["/payroll/rules", "/payroll/holidays", "/payroll/reports", `/payroll/reports/2316/${ids.mo}?year=2026`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/denied=1/);
  }
  const r = await page.request.get("/payroll/reports/export?type=SSS&month=2026-09");
  expect(r.headers()["content-type"]).not.toContain("text/csv");
  // Someone else's profile shows nothing of theirs (the page renders the not-found screen).
  await page.goto(`/employees/${ids.gv}`);
  await expect(page.getByText("Gus Ph")).toHaveCount(0);
  await expect(page.getByText("123-456-789-000")).toHaveCount(0);
  await expect(page.getByText(/could not be found|not found/i).first()).toBeVisible();
});
