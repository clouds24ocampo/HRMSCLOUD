import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { wipeOrgs } from "./helpers";

const stamp = Date.now();
const pw = "correct-horse-battery";
const email = `punch-${stamp}@example.test`;

test.beforeAll(async () => {
  const role = await db.role.findFirstOrThrow({ where: { key: ROLES.EMPLOYEE } });
  const org = await db.organization.create({ data: { name: `Punch ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  await db.orgSettings.create({ data: { organizationId: org.id, gpsPolicy: "ALLOW_FLAG" } });
  const user = await db.user.create({ data: { organizationId: org.id, email, name: "Pia Test", passwordHash: await bcrypt.hash(pw, 4), roleId: role.id } });
  await db.employee.create({ data: { organizationId: org.id, userId: user.id, employeeNo: "P-1", firstName: "Pia", lastName: "Test", hireDate: new Date("2026-01-05T00:00:00Z") } });
});
test.afterAll(async () => { await wipeOrgs(stamp); await db.$disconnect(); });
// A desktop browser with a good location fix (on a computer without one, the clock asks for the phone instead).
test.use({ geolocation: { latitude: 14.6, longitude: 121.0, accuracy: 10 }, permissions: ["geolocation"] });

test("punch screen: two pages, Break 3 locked, trip form, issues page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dtr");
  const card = page.getByRole("region", { name: "Time clock" });
  for (const n of ["Time In", "Break 1", "Break 2", "Break 3", "Meal", "Bio Break", "On Trip", "Time Out"]) await expect(card.getByRole("button", { name: new RegExp(`^.*${n}`) }).first()).toBeVisible();
  await expect(card.getByRole("button", { name: /Clinic Break/ })).toHaveCount(0);
  await card.getByRole("tab", { name: "Issues" }).click();
  await expect(card.getByRole("button", { name: /Clinic Break/ })).toBeVisible();
  await expect(card.getByRole("button", { name: /System Issue/ })).toBeVisible();
  for (const n of ["Heavy Rain / Flood", "Extreme Heat", "Typhoon / Storm Signal", "Earthquake", "Power Outage", "Other Calamity"]) await expect(card.getByRole("button", { name: n })).toBeVisible();
  await card.getByRole("tab", { name: "Punch" }).click();
  // unlock and time in
  await card.getByLabel("Your password").fill(pw);
  await card.getByRole("button", { name: "Verify and unlock" }).click();
  await expect(card.getByText(/Unlocked/)).toBeVisible();
  await card.getByLabel(/^Note/).fill("test");
  await card.getByRole("button", { name: /Time In/ }).click();
  await expect(card.getByText(/Timed in at/)).toBeVisible();
  const last = await db.timeEvent.findFirstOrThrow({ where: { employee: { employeeNo: "P-1", organization: { name: `Punch ${stamp}` } } }, orderBy: { createdAt: "desc" } });
  await db.timeEvent.update({ where: { id: last.id }, data: { at: new Date(Date.now() - 10 * 60_000) } }); // get past the 5 s double-press guard
  // Break 3 is locked until overtime is approved
  await card.getByLabel("Your password").fill(pw);
  await card.getByRole("button", { name: "Verify and unlock" }).click();
  await expect(card.getByText(/Unlocked/)).toBeVisible();
  await expect(card.getByRole("button", { name: /Break 3/ })).toBeDisabled();
  await expect(card.getByText("Needs approved overtime over 2 h")).toBeVisible();
  await card.getByRole("button", { name: /On Trip/ }).click();
  await expect(card.getByText("On Trip: where are you going?")).toBeVisible();
  await card.getByLabel("Departure").fill("Main Office");
  await card.getByLabel("Destination").fill("Client HQ");
  await card.getByLabel("Reason for travel").fill("Site visit");
  await page.screenshot({ path: "e2e/shot-punch-screen.png", fullPage: true });
  await card.getByLabel(/^Note/).fill("no signal at site"); // headless browser has no GPS, so a note is required
  await card.getByRole("button", { name: "Start trip" }).click();
  await expect(card.getByText(/On Trip started at/)).toBeVisible();
  await page.goto("/dtr");
  await page.locator("summary").filter({ hasText: "today" }).click();
  await expect(page.getByText(/Main Office → Client HQ/)).toBeVisible();
});
