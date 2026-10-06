import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { wipeOrgs } from "./helpers";

const stamp = Date.now();
const pw = "correct-horse-battery";
const email = `auto-${stamp}@example.test`;
let orgId = "", userId = "";

test.beforeAll(async () => {
  const role = await db.role.findFirstOrThrow({ where: { key: ROLES.EMPLOYEE } });
  const org = await db.organization.create({ data: { name: `Auto ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  orgId = org.id;
  await db.orgSettings.create({ data: { organizationId: org.id } });
  const user = await db.user.create({ data: { organizationId: org.id, email, name: "Ana Test", passwordHash: await bcrypt.hash(pw, 4), roleId: role.id } });
  userId = user.id;
  await db.employee.create({ data: { organizationId: org.id, userId: user.id, employeeNo: "A-1", firstName: "Ana", lastName: "Test", hireDate: new Date("2026-01-05T00:00:00Z") } });
});
test.afterAll(async () => { await wipeOrgs(stamp); await db.$disconnect(); });

test("pages refresh by themselves: a new notification shows on the bell without reloading", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dtr");
  await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();
  await db.notification.create({ data: { organizationId: orgId, userId, title: "Auto refresh check" } });
  await expect(page.getByRole("link", { name: /Notifications, 1 unread/ })).toBeVisible({ timeout: 30_000 });
});
