import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import pg from "pg";
import { expect, test } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { wipeOrgs } from "./helpers";

// Proves the app explains a stopped database instead of crashing, and recovers when it is back.
// Stops the real database container for a few seconds, so it must not run next to other tests.
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const email = `down-${stamp}@example.test`;
const pw = "correct-horse-battery";
const container = "hrms-db-1";

async function dbReady() {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    return true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => {});
  }
}

test.beforeAll(async () => {
  const role = await db.role.findUniqueOrThrow({ where: { key: ROLES.EMPLOYEE } });
  const org = await db.organization.create({ data: { name: `Down ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  await db.user.create({ data: { organizationId: org.id, email, name: "Dee Down", passwordHash: await bcrypt.hash(pw, 4), roleId: role.id } });
});
test.afterAll(async () => {
  try {
    execSync(`docker start ${container}`, { stdio: "ignore" });
  } catch {}
  for (let i = 0; i < 30 && !(await dbReady()); i++) await new Promise((r) => setTimeout(r, 1000));
  await wipeOrgs(stamp);
  await db.$disconnect();
});

test("with the database stopped: a clear page, a clear login message, then recovery", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  execSync(`docker stop ${container}`, { stdio: "ignore" });
  try {
    // Signed in, database gone: a plain explanation, not a stack trace.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/unavailable$/);
    await expect(page.getByRole("heading", { name: "We cannot reach the database" })).toBeVisible();
    await expect(page.getByText("npm run dev")).toBeVisible();
    await expect(page.getByText(/Runtime|PrismaClient|ECONNREFUSED/)).toHaveCount(0);

    // Signing in while it is down says so instead of crashing.
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(pw);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("database is not running");
  } finally {
    execSync(`docker start ${container}`, { stdio: "ignore" });
  }

  for (let i = 0; i < 40 && !(await dbReady()); i++) await new Promise((r) => setTimeout(r, 1000));
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/); // back to normal without restarting anything
});

test("the explanation page opens without any data", async ({ page }) => {
  await page.goto("/unavailable");
  await expect(page.getByRole("heading", { name: "We cannot reach the database" })).toBeVisible();
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page).toHaveURL(/localhost:3300\/($|login)/);
});
