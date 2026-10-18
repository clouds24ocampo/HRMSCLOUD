import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { wipeOrgs } from "./helpers";

// Time stamp from the login page: ID number + password, no sign-in.
test.describe.configure({ mode: "serial" });
test.use({ geolocation: { latitude: 14.5995, longitude: 120.9842, accuracy: 10 }, permissions: ["geolocation"] });

const stamp = `kiosk${Date.now()}`;
const pw = "correct-horse-battery";
const ids: Record<string, string> = {};

test.beforeAll(async () => {
  const role = (await db.role.findFirstOrThrow({ where: { key: ROLES.EMPLOYEE } })).id;
  const hash = await bcrypt.hash(pw, 4);
  const other = await bcrypt.hash("another-long-password", 4);
  const mkOrg = async (n: string) => {
    const org = await db.organization.create({ data: { name: `Kiosk ${n} ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
    await db.orgSettings.create({ data: { organizationId: org.id } });
    for (const [key, name, kind] of [["TIME_IN", "Time In", "IN"], ["TIME_OUT", "Time Out", "OUT"]] as const) {
      await db.timeStampType.create({ data: { organizationId: org.id, key, name, kind, sortOrder: key === "TIME_IN" ? 10 : 99, locked: true } });
    }
    return org;
  };
  const person = async (orgId: string, k: string, employeeNo: string, passwordHash: string, extra: { mustChangePassword?: boolean } = {}) => {
    const user = await db.user.create({ data: { organizationId: orgId, email: `${k}-${stamp}@example.test`, name: `${k} Kiosk`, passwordHash, roleId: role, ...extra } });
    const e = await db.employee.create({ data: { organizationId: orgId, userId: user.id, employeeNo, firstName: k, lastName: "Kiosk", hireDate: new Date("2026-01-05T00:00:00Z") } });
    ids[k] = e.id;
  };
  const a = await mkOrg("A");
  const b = await mkOrg("B");
  await person(a.id, "ella", `K1-${stamp}`, hash);
  // The same ID number exists in another company with a different password: the password decides who it is.
  await person(b.id, "ben", `K1-${stamp}`, other);
  await person(a.id, "tmp", `T1-${stamp}`, hash, { mustChangePassword: true });
  await person(a.id, "lock", `L1-${stamp}`, hash);
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
});

async function open(page: Page) {
  await page.goto("/login?stamp=1");
  await expect(page.getByRole("tab", { name: /Time stamp/ })).toHaveAttribute("aria-selected", "true");
}
async function check(page: Page, idNo: string, password: string) {
  await page.getByLabel("ID number").fill(idNo);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("time in and out from the login page, no sign-in, with location", async ({ page }) => {
  await open(page);
  await check(page, `K1-${stamp}`, pw);
  await expect(page.getByText("ella Kiosk")).toBeVisible();
  await expect(page.getByText("Not timed in")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Time Out/ })).toBeDisabled(); // not timed in yet
  await page.getByRole("button", { name: /^Time In/ }).click();
  await expect(page.getByText(/Timed in at .*location recorded/)).toBeVisible();

  const ev = await db.timeEvent.findFirstOrThrow({ where: { employeeId: ids.ella } });
  expect(ev).toMatchObject({ type: "IN", source: "KIOSK", gpsStatus: "OK" });
  expect(ev.lat).toBeCloseTo(14.5995, 3);
  // Nothing was signed in: the workspace still asks for a login, and the password is gone from the screen.
  expect(await db.session.count({ where: { user: { employee: { id: ids.ella } } } })).toBe(0);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  // Later the same way: the state is read from the record, and the stamp is a Time Out.
  await open(page);
  await check(page, `K1-${stamp}`.toLowerCase(), pw); // ID numbers are not case sensitive
  await expect(page.getByText("Timed in · Working")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Time In/ })).toBeDisabled();
  await db.timeEvent.updateMany({ where: { employeeId: ids.ella }, data: { at: new Date(Date.now() - 3600_000) } }); // get past the double-press guard
  await page.getByRole("button", { name: /^Time Out/ }).click();
  await expect(page.getByText(/Timed out at/)).toBeVisible();
  expect(await db.timeEvent.count({ where: { employeeId: ids.ella, source: "KIOSK" } })).toBe(2);
});

test("the password decides which company's person it is; a wrong one is refused and nothing is stamped", async ({ page }) => {
  await open(page);
  await check(page, `K1-${stamp}`, "another-long-password");
  await expect(page.getByText("ben Kiosk")).toBeVisible(); // same ID number, other company
  await page.getByRole("button", { name: "Not you? Start over" }).click();

  await check(page, `K1-${stamp}`, "wrong-password-here");
  await expect(page.locator("p[role=alert]")).toContainText("Wrong ID number or password.");
  await check(page, `NOPE-${stamp}`, pw);
  await expect(page.locator("p[role=alert]")).toContainText("Wrong ID number or password."); // same message: an unknown ID is not revealed
  expect(await db.timeEvent.count({ where: { employeeId: ids.ben } })).toBe(0);
});

test("a temporary password must be changed first; repeated wrong passwords lock the ID", async ({ page }) => {
  await open(page);
  await check(page, `T1-${stamp}`, pw);
  await expect(page.locator("p[role=alert]")).toContainText("choose your own password first");
  expect(await db.timeEvent.count({ where: { employeeId: ids.tmp } })).toBe(0);

  for (let i = 0; i < 5; i++) {
    await check(page, `L1-${stamp}`, `wrong-${i}-password`);
    await expect(page.locator("p[role=alert]")).toBeVisible();
  }
  await check(page, `L1-${stamp}`, pw); // even the right password waits out the lockout
  await expect(page.locator("p[role=alert]")).toContainText("Too many wrong attempts");
});

test("the sign-in tab still works and is the default", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("tab", { name: "Sign in" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /Time stamp/ }).click();
  await expect(page.getByLabel("ID number")).toBeVisible();
  await page.getByRole("tab", { name: "Sign in" }).click();
  await expect(page.getByLabel("Email or username")).toBeVisible();
});

test("on a phone, a stamp without location is refused", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", viewport: { width: 390, height: 844 }, isMobile: true, permissions: [] });
  const page = await ctx.newPage();
  await open(page);
  await check(page, `K1-${stamp}`, pw);
  await db.timeEvent.deleteMany({ where: { employeeId: ids.ella } });
  await page.getByRole("button", { name: /^Time In/ }).click();
  await expect(page.locator("p[role=alert]")).toContainText(/location/i);
  expect(await db.timeEvent.count({ where: { employeeId: ids.ella } })).toBe(0);
  await ctx.close();
});

test("the animated panel shows on the sign-in tab only, not on the time stamp page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login");
  await expect(page.getByText("People first. Everything else follows.")).toBeVisible();
  await page.getByRole("tab", { name: /Time stamp/ }).click();
  await expect(page.getByText("People first. Everything else follows.")).toHaveCount(0);
  await page.goto("/login?stamp=1");
  await expect(page.getByText("People first. Everything else follows.")).toHaveCount(0);
  await page.getByRole("tab", { name: "Sign in" }).click();
  await expect(page.getByText("People first. Everything else follows.")).toBeVisible();
});
