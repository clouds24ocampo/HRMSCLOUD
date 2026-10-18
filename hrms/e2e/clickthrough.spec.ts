import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { CATEGORIES } from "../src/lib/industries";
import { wipeOrgs } from "./helpers";

// Clicks every button and link on every page and fails on any console error, page error or failed request.
// Shared with worker processes, which are restarted after a failed test.
process.env.QA_STAMP ??= String(Date.now());
const stamp = process.env.QA_STAMP;
const pw = "correct-horse-battery";
const owner = `qa-owner-${stamp}@example.test`;
const added = `qa-added-${stamp}@example.test`;
const problems: string[] = [];

function watch(page: Page) {
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("requestfailed", (r) => {
    if (!r.url().includes("_rsc") && r.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`requestfailed: ${r.url()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("favicon")) problems.push(`http ${r.status()}: ${r.url()}`);
  });
}

test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("landing and login: every link goes where it says", async ({ page }) => {
  watch(page);
  const go = async (name: string | RegExp, url: RegExp, index = 0) => {
    await page.goto("/");
    await page.getByRole("link", { name }).nth(index).click();
    await expect(page).toHaveURL(url);
  };
  await go("Sign in", /\/login$/);
  await go("Register your organization", /\/register$/, 0); // hero button
  await go("I already have an account", /\/login$/);
  await go("Register your organization", /\/register$/, 1); // footer link

  await page.goto("/login");
  await page.getByRole("link", { name: "HRMS" }).first().click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await page.goto("/login");
  await page.getByRole("link", { name: "Register your organization" }).click();
  await expect(page).toHaveURL(/\/register$/);

  // Empty submit stays on login (browser validation); bad credentials show an error.
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByLabel("Password").fill("whatever-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Wrong email, username or password");
  await expect(page.getByLabel("Email")).toHaveValue("nobody@example.test"); // kept
});

test("register wizard: every category, every Back/Continue, header links", async ({ page }) => {
  watch(page);
  await page.goto("/register");
  for (const c of CATEGORIES) {
    await page.getByRole("button", { name: new RegExp(c.name.replace(/[&]/g, "\\$&")) }).click();
    await expect(page.getByRole("heading", { name: c.name })).toBeVisible();
    for (const s of c.segments) await expect(page.getByRole("radio", { name: s.name })).toBeVisible();
    const next = page.getByRole("button", { name: "Continue" });
    await expect(next).toBeDisabled();
    await page.getByRole("radio", { name: c.segments[0].name }).click();
    if (c === CATEGORIES[0]) await expect(next).toBeDisabled(); // size still missing (size is kept when you go Back)
    await page.getByRole("radio", { name: /Under 20/ }).click();
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).last().click(); // last = the entering step during the slide
    await expect(page.getByRole("heading", { name: c.name })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).last().click(); // last = the entering step during the slide
    await expect(page.getByRole("heading", { name: "What kind of organization are you?" })).toBeVisible();
  }
  await page.getByRole("link", { name: "Sign in" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/register");
  await page.getByRole("link", { name: "Sign in" }).last().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/register");
  await page.getByRole("link", { name: "HRMS" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});

test("register, then every button inside the app", async ({ page }) => {
  watch(page);
  await page.goto("/register");
  await page.getByRole("button", { name: /Healthcare/ }).click();
  await page.getByRole("radio", { name: "Hospital" }).click();
  await page.getByRole("radio", { name: /200 to 1,000/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Organization name").fill(`QA Hospital ${stamp}`);
  await page.getByLabel("Your full name").fill("Qa Owner");
  await page.getByLabel("Your email").fill(owner);
  await page.getByLabel("Password (10+ characters)").fill("short");
  await page.getByLabel("Confirm password").fill("short");
  await page.getByRole("button", { name: "Register organization" }).click();
  await expect(page).toHaveURL(/\/register$/); // too short: browser blocks submit
  await page.getByLabel("Password (10+ characters)").fill(pw);
  await page.getByLabel("Confirm password").fill(pw);
  await page.getByRole("button", { name: "Register organization" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(`QA Hospital ${stamp} · Super Admin`)).toBeVisible();

  const nav = page.locator("nav:visible");
  await nav.getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await nav.getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);

  await expect(page.getByLabel("Role")).toBeVisible();
  const roles = await page.getByLabel("Role").locator("option").allTextContents();
  expect(roles).toEqual(["Choose a role", "Employee", "HR Admin", "Manager", "Sub Contractor", "Super Admin"]);
  await page.getByRole("button", { name: "Add user" }).click(); // empty: browser validation
  await expect(page.getByRole("status")).toHaveCount(0);

  const fill = async (email: string) => {
    await page.getByLabel("Full name").fill("Added Person");
    await page.getByLabel("Email").fill(email);
    await page.locator("aside").getByLabel("Role").selectOption({ label: "Employee" });
    await page.locator("aside").getByLabel("Temporary password").fill(pw);
    await page.getByRole("button", { name: "Add user" }).click();
  };
  await fill(added);
  await expect(page.getByRole("status")).toContainText("can now sign in");
  await expect(page.getByLabel("Full name")).toHaveValue(""); // cleared on success
  await fill(added);
  await expect(page.locator("p[role=alert]")).toContainText("already exists");
  await expect(page.getByLabel("Full name")).toHaveValue("Added Person"); // kept on error

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/register"); // signed out: allowed
  await page.getByLabel("Email").count();
  await page.goto("/login");
  await page.getByLabel("Email").fill(owner);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/login"); // signed in: bounced to dashboard
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("phone: bottom nav and sign out work", async ({ page }) => {
  watch(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/login");
  await page.getByLabel("Email").fill(owner);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const nav = page.locator("nav:visible");
  await nav.getByRole("button", { name: "More" }).click(); // Users sits behind More on a phone
  await page.getByRole("dialog", { name: "All pages" }).getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByText(added)).toBeVisible();
  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
