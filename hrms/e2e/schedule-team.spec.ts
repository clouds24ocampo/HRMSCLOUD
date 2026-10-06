import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { wipeOrgs } from "./helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const pw = "correct-horse-battery";
const mail = (n: string) => `team-${n}-${stamp}@example.test`;
const ids: Record<string, string> = {};

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const role = (k: string) => roles.find((r) => r.key === k)!.id;
  const org = await db.organization.create({ data: { name: `Team ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  await db.orgSettings.create({ data: { organizationId: org.id } });
  await db.shiftTemplate.create({ data: { organizationId: org.id, name: "Regular", startTime: "08:00", endTime: "17:00", breakMinutes: 60 } });
  await db.shiftTemplate.create({ data: { organizationId: org.id, name: "Mid", startTime: "14:00", endTime: "23:00", breakMinutes: 60 } });
  const passwordHash = await bcrypt.hash(pw, 4);
  const person = async (who: string, first: string, roleKey: string, managerId?: string) => {
    const user = await db.user.create({ data: { organizationId: org.id, email: mail(who), name: `${first} Test`, passwordHash, roleId: role(roleKey) } });
    const e = await db.employee.create({ data: { organizationId: org.id, userId: user.id, employeeNo: `T-${who}`, firstName: first, lastName: "Test", managerId, hireDate: new Date("2026-01-05T00:00:00Z") } });
    ids[who] = e.id;
    return e;
  };
  const mgr = await person("mgr", "Marco", ROLES.MANAGER);
  await person("e1", "Eli", ROLES.EMPLOYEE, mgr.id);
  await person("e2", "Eve", ROLES.EMPLOYEE, mgr.id);
});
test.afterAll(async () => { await wipeOrgs(stamp); await db.$disconnect(); });

async function signIn(page: import("@playwright/test").Page, who: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(mail(who));
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("leader's schedule flows to the team; editing one member makes them Custom; click a day to change it", async ({ page }) => {
  await signIn(page, "mgr");
  await page.goto("/schedule");

  const reg = page.locator("section").filter({ hasText: "Regular weekly schedule" });
  // Set only the leader: both members follow automatically.
  await reg.getByLabel(/Test, Marco/).check();
  await reg.getByLabel("Regular shift").selectOption({ label: "Regular (08:00–17:00)" });
  await reg.getByRole("button", { name: "Save regular schedule" }).click();
  await expect(page.getByText(/followed their leader automatically/)).toBeVisible();
  expect(await db.regularSchedule.count({ where: { employeeId: { in: [ids.e1, ids.e2] } } })).toBe(2);
  await expect(page.getByText("Follows Marco").first()).toBeVisible();

  // Edit one member alone: Custom, and a later leader change skips them.
  await reg.getByLabel(/Test, Marco/).uncheck();
  await reg.getByLabel(/Test, Eli/).check();
  await reg.getByLabel("Regular shift").selectOption({ label: "Mid (14:00–23:00)" });
  await reg.getByRole("button", { name: "Save regular schedule" }).click();
  await expect(page.getByText(/now Custom/)).toBeVisible();
  expect((await db.employee.findUniqueOrThrow({ where: { id: ids.e1 } })).scheduleLinked).toBe(false);
  expect((await db.employee.findUniqueOrThrow({ where: { id: ids.e2 } })).scheduleLinked).toBe(true);
  await expect(page.getByText("Custom").first()).toBeVisible();

  // One click on a day changes just that day.
  await page.getByRole("button", { name: /^Change \d{4}-\d{2}-\d{2}$/ }).first().click();
  await page.getByRole("menuitem", { name: "Day off" }).click();
  await expect.poll(() => db.scheduleEntry.count({ where: { employeeId: ids.e1, shiftId: null } })).toBe(1);
});

test("Live Personnel and Analytics open for the leader and show the team", async ({ page }) => {
  await signIn(page, "mgr");
  await page.goto("/schedule/live");
  await expect(page.getByRole("navigation", { name: "Schedule sections" })).toBeVisible();
  await expect(page.getByText("Working now")).toBeVisible();
  await expect(page.getByRole("link", { name: "Test, Eli" })).toBeVisible();
  await page.getByPlaceholder("Name or employee number").fill("Eve");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: "Test, Eve" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Test, Eli" })).toHaveCount(0);
  await page.goto("/schedule/analytics");
  await expect(page.getByText("Schedule adherence")).toBeVisible();
  await page.getByRole("link", { name: "Test, Eli" }).click();
  await expect(page.getByText(/Eli:/)).toBeVisible();
  await page.screenshot({ path: "e2e/shot-schedule-analytics.png", fullPage: true });
});

test("an employee has no Live or Analytics tabs", async ({ page }) => {
  await signIn(page, "e2");
  await page.goto("/schedule");
  await expect(page.getByRole("navigation", { name: "Schedule sections" })).toHaveCount(0);
  await page.goto("/schedule/live");
  await expect(page).toHaveURL(/denied=1/);
});
