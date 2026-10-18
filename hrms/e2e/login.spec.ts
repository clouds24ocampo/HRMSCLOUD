import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { wipeOrgs } from "./helpers";

const pw = "correct-horse-battery";
const stamp = Date.now();
const mail = (n: string) => `e2e-${n}-${stamp}@example.test`;
const admin = mail("admin");
const emp = mail("emp");
const otherAdmin = mail("other-admin");
const alert = (page: Page) => page.locator("p[role=alert]");

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const id = (k: string) => roles.find((r) => r.key === k)!.id;
  const passwordHash = await bcrypt.hash(pw, 4);
  const mk = (name: string) =>
    db.organization.create({ data: { name: `E2E ${name} ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  const [a, b] = [await mk("A"), await mk("B")];
  const user = (organizationId: string, email: string, name: string, role: string) =>
    db.user.create({ data: { organizationId, email, name, passwordHash, roleId: id(role) } });
  await user(a.id, admin, "E2E Admin", ROLES.SUPER_ADMIN);
  await user(a.id, emp, "E2E Employee", ROLES.EMPLOYEE);
  await user(b.id, otherAdmin, "Other Org Admin", ROLES.SUPER_ADMIN);
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
});

async function signIn(page: Page, email: string, password = pw) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("anonymous user sees landing, protected pages redirect to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Register your organization" }).first()).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("register an organization: pick industry, details, account -> Super Admin dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Register your organization" }).first().click();
  const next = page.getByRole("button", { name: "Continue" });
  // A click before the page has hydrated does nothing: press again until the second step opens.
  await expect(async () => {
    await page.getByRole("button", { name: /Government & Public Sector/ }).click();
    await expect(next).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(next).toBeDisabled(); // must pick type + size
  await page.getByRole("radio", { name: /LGU/ }).click();
  await page.getByRole("radio", { name: /20 to 200/ }).click();
  await next.click();
  await page.getByLabel("Organization name").fill(`E2E City ${stamp}`);
  await page.getByLabel("Your full name").fill("Maria Santos");
  await page.getByLabel("Your email").fill(mail("owner"));
  await page.getByLabel("Password (10+ characters)").fill(pw);
  await page.getByLabel("Confirm password").fill("different-password");
  await page.getByRole("button", { name: "Register organization" }).click();
  await expect(alert(page)).toContainText("do not match");
  await page.getByLabel("Password (10+ characters)").fill(pw); // passwords are cleared after an error
  await page.getByLabel("Confirm password").fill(pw);
  await expect(page.getByLabel("Organization name")).toHaveValue(`E2E City ${stamp}`); // text kept
  await page.getByRole("button", { name: "Register organization" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(`E2E City ${stamp} · Super Admin`)).toBeVisible();
  const org = await db.organization.findFirstOrThrow({ where: { name: `E2E City ${stamp}` } });
  expect([org.categoryKey, org.industryKey, org.sizeKey]).toEqual(["government", "lgu", "small"]);
});

test("registering an already-used email is refused", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: /BPO, IT/ }).click();
  await page.getByRole("radio", { name: /BPO/ }).click();
  await page.getByRole("radio", { name: /Under 20/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Organization name").fill(`E2E Dup ${stamp}`);
  await page.getByLabel("Your full name").fill("Dup");
  await page.getByLabel("Your email").fill(admin);
  await page.getByLabel("Password (10+ characters)").fill(pw);
  await page.getByLabel("Confirm password").fill(pw);
  await page.getByRole("button", { name: "Register organization" }).click();
  await expect(alert(page)).toContainText("already registered");
});

test("wrong password shows an error and stays on login", async ({ page }) => {
  await signIn(page, admin, "wrong-password-here");
  await expect(alert(page)).toContainText("Wrong email, username or password");
  await expect(page).toHaveURL(/\/login/);
});

test("employee cannot open Users page or see it in the menu", async ({ page }) => {
  await signIn(page, emp);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/denied=1/);
  await expect(alert(page)).toContainText("permission");
});

test("super admin sees only own organization's users; adds a user; logout works", async ({ page }) => {
  await signIn(page, admin);
  await page.getByRole("link", { name: "Users" }).first().click();
  await expect(page.getByText(emp)).toBeVisible();
  await expect(page.getByText(otherAdmin)).toHaveCount(0); // tenant isolation

  const newEmail = mail("new");
  await page.getByLabel("Full name").fill("New Person");
  await page.getByLabel("Email").fill(newEmail);
  await page.locator("aside").getByLabel("Role").selectOption({ label: "Manager" });
  await page.locator("aside").getByLabel("Temporary password").fill(pw);
  await page.getByRole("button", { name: "Add user" }).click();
  await expect(page.getByRole("status")).toContainText("can now sign in");
  await expect(page.getByText(newEmail)).toBeVisible();
  const created = await db.user.findUniqueOrThrow({ where: { email: newEmail } });
  const adminRow = await db.user.findUniqueOrThrow({ where: { email: admin } });
  expect(created.organizationId).toBe(adminRow.organizationId);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await signIn(page, newEmail);
  await expect(page).toHaveURL(/\/change-password$/); // temporary password: must choose their own first
});

test("mobile: landing and wizard fit, bottom nav in app, no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await page.goto("/");
  expect(await noOverflow()).toBe(true);
  await page.screenshot({ path: "e2e/shot-landing-mobile.png" });
  await page.goto("/register");
  expect(await noOverflow()).toBe(true);
  await page.screenshot({ path: "e2e/shot-register-mobile.png" });
  await signIn(page, admin);
  await expect(page.getByRole("navigation", { name: "Main" }).last()).toBeVisible();
  expect(await noOverflow()).toBe(true);
});

test("desktop screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "e2e/shot-landing-desktop.png" });
  await page.goto("/register");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e/shot-register-desktop.png" });
});
