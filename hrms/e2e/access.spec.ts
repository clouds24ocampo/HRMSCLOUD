import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { wipeOrgs } from "./helpers";

const stamp = Date.now();
const pw = "access-pass-12345";
const email = (n: string) => `zz.${n}.${stamp}@example.test`;
let ids: { head: string; entry: string };

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const role = (k: string) => roles.find((r) => r.key === k)!.id;
  const org = await db.organization.create({ data: { name: `Access Org ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  const passwordHash = await bcrypt.hash(pw, 4);
  const mk = async (n: string, roleKey: string, level: "ENTRY" | "DEPT_HEAD" | null) => {
    const user = await db.user.create({ data: { organizationId: org.id, email: email(n), name: `ZZ ${n}`, passwordHash, roleId: role(roleKey) } });
    if (level) {
      const position = await db.position.create({ data: { organizationId: org.id, title: `ZZ ${n} position`, level } });
      await db.employee.create({ data: { organizationId: org.id, userId: user.id, employeeNo: `ZZ-${n}-${stamp}`, firstName: "ZZ", lastName: n, hireDate: new Date("2026-01-05"), positionId: position.id } });
    }
    return user.id;
  };
  await mk("super", ROLES.SUPER_ADMIN, null);
  ids = { head: await mk("head", ROLES.EMPLOYEE, "DEPT_HEAD"), entry: await mk("entry", ROLES.EMPLOYEE, "ENTRY") };
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
});

async function signIn(page: Page, who: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email(who));
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
const row = (page: Page, label: string) => page.locator("li", { hasText: label }).filter({ has: page.getByRole("checkbox") }).first();

test("itemized access: company role, suggestion, extras, removals, entry-level rule", async ({ page, browser }) => {
  await signIn(page, "super");

  // A company role made from a ready-made template, then trimmed.
  await page.goto("/admin/roles");
  await page.getByLabel("Role name").fill(`ZZ Auditor ${stamp}`);
  await page.getByLabel("Start from").selectOption("template:Timekeeper");
  await page.getByRole("button", { name: "Create role" }).click();
  await expect(page).toHaveURL(/\/admin\/roles\/.+/);
  await page.waitForLoadState("networkidle"); // let the page hydrate before clicking
  await expect(row(page, "Plan anyone's schedule").getByRole("checkbox")).toBeChecked();
  await row(page, "Plan anyone's schedule").getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByText(/^Saved\./)).toBeVisible();

  // The Dept Head account: suggestion shown, the company role chosen, one extra added.
  await page.goto(`/admin/users/${ids.head}/access`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Suggested for the Department Head level")).toBeVisible();
  await page.locator("main select, select").first().selectOption({ label: `ZZ Auditor ${stamp} (company role)` });
  await expect(row(page, "See everyone's time records").getByRole("checkbox")).toBeChecked();
  await expect(row(page, "Plan anyone's schedule").getByRole("checkbox")).not.toBeChecked();
  await expect(row(page, "Reports and exports").getByRole("checkbox")).not.toBeChecked();
  await row(page, "Reports and exports").getByRole("checkbox").check();
  await expect(row(page, "Reports and exports")).toContainText("Added for this account");
  await row(page, "Open everyone's 201 file").getByRole("checkbox").check();
  await row(page, "Open everyone's 201 file").getByRole("checkbox").uncheck();
  await page.getByLabel("Reason").fill("e2e");
  await page.getByRole("button", { name: "Save access" }).click();
  await expect(page.getByText("8 permissions (5 added, 0 removed)", { exact: false })).toBeVisible();

  // That account now opens Reports (extra) and the DTR list (role), not Payroll.
  const ctx = await browser.newContext();
  const head = await ctx.newPage();
  await signIn(head, "head");
  await head.goto("/reports");
  await expect(head).toHaveURL(/\/reports/);
  await head.goto("/payroll");
  await expect(head).toHaveURL(/denied=1/);
  await head.goto("/handbook"); // everyone can read the handbook until HR takes it away
  await expect(head).toHaveURL(/\/handbook/);

  // Taking the extra away closes Reports again.
  await page.goto(`/admin/users/${ids.head}/access`);
  await row(page, "Reports and exports").getByRole("checkbox").uncheck();
  await expect(row(page, "Reports and exports")).not.toContainText("Added for this account");
  await row(page, "See everyone's time records").getByRole("checkbox").uncheck(); // a role permission taken away for this account only
  await expect(row(page, "See everyone's time records")).toContainText("Removed for this account");
  await row(page, "Read the company handbook").getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Save access" }).click();
  await expect(page.getByText("5 permissions (0 added, 3 removed)", { exact: false })).toBeVisible();
  const again = await (await browser.newContext()).newPage();
  await signIn(again, "head");
  await again.goto("/reports");
  await expect(again).toHaveURL(/denied=1/);
  await again.goto("/handbook"); // taken away for this account only
  await expect(again).toHaveURL(/denied=1/);

  // Entry-level: manager-level access cannot be ticked and a manager role is refused.
  const plain = await (await browser.newContext()).newPage(); // a plain employee reads the handbook with no extra setup
  await signIn(plain, "entry");
  await plain.goto("/handbook");
  await expect(plain).toHaveURL(/\/handbook/);
  await expect(plain.getByRole("link", { name: "Company Handbook" }).first()).toBeVisible();
  await page.goto(`/admin/users/${ids.entry}/access`);
  await expect(page.getByText("entry-level position").first()).toBeVisible();
  await expect(row(page, "Reports and exports").getByRole("checkbox")).toBeDisabled();
  await expect(row(page, "See every employee").getByRole("checkbox")).toBeDisabled();
  await page.locator("main select, select").first().selectOption({ label: "Manager" });
  await expect(row(page, "Manage my team").getByRole("checkbox")).toBeChecked();
  await page.getByRole("button", { name: "Save access" }).click();
  await expect(page.getByText(/entry-level positions cannot be given manager or higher access/)).toBeVisible();

  // Nobody but a Super Admin reaches these pages.
  await expect(async () => {
    await again.goto("/admin/roles");
    await expect(again).toHaveURL(/denied=1/);
  }).toPass();
  await ctx.close();
});
