import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { wipeOrgs } from "./helpers";

const stamp = Date.now();
const temp = "temporary-pass-1";
const mine = "my-own-password-9";
const adminEmail = `emp-admin-${stamp}@example.test`;
const empEmail = `emp-user-${stamp}@example.test`;
const alert = (page: Page) => page.locator("p[role=alert]");

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const id = (k: string) => roles.find((r) => r.key === k)!.id;
  const org = await db.organization.create({ data: { name: `Emp Org ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  const passwordHash = await bcrypt.hash(temp, 4);
  await db.user.create({ data: { organizationId: org.id, email: adminEmail, name: "Admin", passwordHash, roleId: id(ROLES.SUPER_ADMIN) } });
  await db.user.create({
    data: { organizationId: org.id, email: empEmail, name: "Juan Dela Cruz", passwordHash, roleId: id(ROLES.EMPLOYEE), mustChangePassword: true },
  });
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("employee signs in with a temporary password and must choose their own", async ({ page, browser }) => {
  await signIn(page, empEmail, temp);
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible();

  // Nothing else is reachable until the password is changed.
  for (const path of ["/dashboard", "/admin/users"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/change-password$/);
  }

  const fill = async (cur: string, next: string, confirm: string) => {
    await page.getByLabel("Temporary password").fill(cur);
    await page.getByLabel("New password (10+ characters)").fill(next);
    await page.getByLabel("Confirm new password").fill(confirm);
    await page.getByRole("button", { name: "Save password" }).click();
  };
  await fill("wrong-current-pass", mine, mine);
  await expect(alert(page)).toContainText("Current password is wrong");
  await fill(temp, mine, "different-password-1");
  await expect(alert(page)).toContainText("do not match");
  await fill(temp, temp, temp);
  await expect(alert(page)).toContainText("not used");

  // A second device signed in earlier is signed out once the password changes.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, empEmail, temp);
  await expect(otherPage).toHaveURL(/\/change-password$/);

  await fill(temp, mine, mine);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Hello, Juan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0); // employee menu: Home only

  await otherPage.goto("/dashboard");
  await expect(otherPage).toHaveURL(/\/login$/);
  await other.close();

  // Old password is dead, new one works, and no forced change next time.
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, empEmail, temp);
  await expect(alert(page)).toContainText("Wrong email, username or password");
  await signIn(page, empEmail, mine);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("anyone can change their password voluntarily from the header", async ({ page }) => {
  await signIn(page, adminEmail, temp);
  await expect(page).toHaveURL(/\/dashboard$/); // admin was not forced
  await page.getByRole("link", { name: "Change password" }).click();
  await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Change password" }).click();
  await page.getByLabel("Current password").fill(temp);
  await page.getByLabel("New password (10+ characters)").fill(mine);
  await page.getByLabel("Confirm new password").fill(mine);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("signed-out visitor cannot open change-password", async ({ page }) => {
  await page.goto("/change-password");
  await expect(page).toHaveURL(/\/login$/);
});
