import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { addDays, dayKey, weekStart } from "../src/lib/time";
import { wipeOrgs } from "./helpers";

// Whole-system check, in order. Each step uses real pages and buttons.
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const pw = "correct-horse-battery";
const TZ = "Asia/Manila";
const today = dayKey(new Date(), TZ);
const nextMonday = addDays(weekStart(today), 7);
const mail = (n: string) => `sys-${n}-${stamp}@example.test`;
const problems: string[] = [];
const ids: Record<string, string> = {}; // employee ids
const alert = (page: Page) => page.locator("p[role=alert]");

function watch(page: Page) {
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/geolocation|Geolocation|status of 404/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
}
async function signIn(page: Page, who: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(mail(who));
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
const h1 = (page: Page, name: string | RegExp) => expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
// Move the newest punch back in time so a quick test can press several buttons in a row.
const backdate = async (employeeId: string, minutes: number) => {
  const last = await db.timeEvent.findFirstOrThrow({ where: { employeeId }, orderBy: { createdAt: "desc" } });
  await db.timeEvent.update({ where: { id: last.id }, data: { at: new Date(Date.now() - minutes * 60_000) } });
};

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const role = (k: string) => roles.find((r) => r.key === k)!.id;
  const passwordHash = await bcrypt.hash(pw, 4);
  const mkOrg = (n: string) => db.organization.create({ data: { name: `Sys ${n} ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  const [a, b] = [await mkOrg("A"), await mkOrg("B")];
  for (const o of [a, b]) {
    await db.orgSettings.create({ data: { organizationId: o.id } });
    await db.shiftTemplate.create({ data: { organizationId: o.id, name: "Regular", startTime: "08:00", endTime: "17:00", breakMinutes: 60 } });
    await db.leaveType.create({ data: { organizationId: o.id, name: "Vacation leave", annualDays: 15 } });
    await db.leaveType.create({ data: { organizationId: o.id, name: "Sick leave", annualDays: 10 } });
  }
  const person = async (orgId: string, who: string, first: string, roleKey: string, managerId?: string) => {
    const user = await db.user.create({ data: { organizationId: orgId, email: mail(who), name: `${first} Test`, passwordHash, roleId: role(roleKey) } });
    const e = await db.employee.create({
      data: { organizationId: orgId, userId: user.id, employeeNo: `T-${who}`, firstName: first, lastName: "Test", managerId, hireDate: new Date("2026-01-05T00:00:00Z") },
    });
    ids[who] = e.id;
    return e;
  };
  await person(a.id, "sa", "Sam", ROLES.SUPER_ADMIN);
  await person(a.id, "hr", "Hana", ROLES.HR_ADMIN);
  const mgr = await person(a.id, "mgr", "Marco", ROLES.MANAGER);
  await person(a.id, "e1", "Eli", ROLES.EMPLOYEE, mgr.id); // under the manager
  await person(a.id, "e2", "Eve", ROLES.EMPLOYEE); // not under the manager
  await person(b.id, "sb", "Sol", ROLES.SUPER_ADMIN); // another organization
  const shift = await db.shiftTemplate.findFirstOrThrow({ where: { organizationId: a.id } });
  await db.scheduleEntry.create({ data: { organizationId: a.id, employeeId: ids.e1, date: new Date(`${today}T00:00:00Z`), shiftId: shift.id } });
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("tour: every page opens for the Super Admin, menu is grouped", async ({ page }) => {
  watch(page);
  await signIn(page, "sa");
  const nav = page.locator("nav:visible");
  for (const g of ["People", "Time", "Pay", "Talent", "Support", "Manage"]) await expect(nav.getByText(g, { exact: true })).toBeVisible();
  const pages: [string, string | RegExp][] = [
    ["/dashboard", /Hello, Sam/], ["/employees", "Employees"], ["/organization", "Organization"], ["/schedule", "Schedule"], ["/dtr", "DTR"],
    ["/leave", "Leave"], ["/settings", "Settings"], ["/admin/users", "Users"], ["/audit", "Audit log"],
    ["/overtime", "Overtime"], ["/payroll", "Payroll"], ["/payroll/setup", "Pay setup"], ["/payroll/rules", "Philippine rules"], ["/payroll/holidays", "Holiday calendar"], ["/payroll/reports", "Remittance and BIR reports"], ["/payroll/calculators", "Benefit estimates"], ["/payslips", "My payslips"], ["/recruitment", "Recruitment"],
    ["/performance", "Performance"], ["/learning", "Learning"], ["/documents", "Documents"], ["/requests", "HR requests"],
    ["/announcements", "Announcements"], ["/reports", "Reports"], ["/notifications", "Notifications"],
  ];
  for (const [path, name] of pages) {
    await page.goto(path);
    await h1(page, name);
  }
  await page.goto("/no-such-page");
  await expect(page.getByText("could not be found")).toBeVisible();
});

test("an employee only gets their own pages", async ({ page }) => {
  await signIn(page, "e2");
  const nav = page.locator("nav:visible");
  for (const l of ["Home", "Schedule", "DTR", "Overtime", "Leave", "My payslips", "Performance", "Learning", "Documents", "HR requests"]) await expect(nav.getByRole("link", { name: l })).toBeVisible();
  for (const l of ["Employees", "Organization", "Recruitment", "Payroll", "Announcements", "Reports", "Settings", "Users", "Audit log"]) await expect(nav.getByRole("link", { name: l, exact: true })).toHaveCount(0);
  for (const path of ["/settings", "/employees", "/organization", "/audit", "/payroll", "/payroll/setup", "/payroll/rules", "/payroll/holidays", "/payroll/reports", "/payroll/calculators", "/recruitment", "/reports", "/announcements", "/admin/users"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/denied=1/);
  }
});

test("a manager sees only their own team", async ({ page }) => {
  await signIn(page, "mgr");
  await page.goto("/employees");
  await h1(page, "My team");
  await expect(page.getByText(`T-e1`)).toBeVisible();
  await expect(page.getByText(`T-e2`)).toHaveCount(0);
  await expect(page.getByText("Add an employee")).toHaveCount(0);
  await page.goto(`/employees/${ids.e1}`);
  await h1(page, "Eli Test");
  await page.goto(`/employees/${ids.e2}`);
  await expect(page.getByText("could not be found")).toBeVisible();
  await page.goto("/organization");
  await expect(page).toHaveURL(/denied=1/);
});

test("organization: departments, suggestions, positions, archive and restore", async ({ page }) => {
  watch(page);
  await signIn(page, "sa");
  await page.goto("/organization");
  await page.getByRole("button", { name: /Add all \d+/ }).first().click();
  await expect(page.getByRole("status").first()).toContainText("added");
  await expect(page.locator("li", { hasText: "Quality Assurance" })).toBeVisible();
  await page.getByLabel("Department name").fill("Night Operations");
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByText("Night Operations added.")).toBeVisible();
  await page.getByLabel("Department name").fill("Night Operations");
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(alert(page)).toContainText("already exists");
  await page.getByLabel("Position title").fill("Floor Agent");
  await page.getByRole("button", { name: "Add position" }).click();
  await expect(page.getByText("Floor Agent added.")).toBeVisible();
  await page.getByRole("button", { name: "Archive Night Operations" }).click();
  await expect(page.getByText("Archived (1)")).toBeVisible();
  await page.getByText("Archived (1)").click();
  await page.getByRole("button", { name: "Restore" }).first().click();
  await expect(page.getByRole("button", { name: "Archive Night Operations" })).toBeVisible();
});

test("employees: HR adds one with a sign-in, edits assignment, history is kept", async ({ page }) => {
  watch(page);
  await signIn(page, "hr");
  await page.goto("/employees");
  await page.getByText("Add an employee").click();
  await page.getByLabel("First name").fill("Pia");
  await page.getByLabel("Last name").fill("Reyes");
  await page.getByLabel("Email (optional)").fill(mail("pia"));
  await page.locator("#departmentId").selectOption({ label: "Night Operations" });
  await page.locator("#positionId").selectOption({ label: "Floor Agent (Entry level)" });
  await page.locator("#managerId").selectOption({ label: "Marco Test · T-mgr" });
  await page.getByLabel("Also create a sign-in for this person").check();
  await page.locator("#roleId").selectOption({ label: "Employee" });
  await page.getByLabel("Temporary password").fill(pw);
  await page.getByRole("button", { name: "Add employee" }).click();
  await expect(page.getByRole("status")).toContainText("Pia Reyes added as");
  await page.getByLabel("Last name").fill("Dupe");
  await page.getByLabel("First name").fill("Pia");
  await page.getByLabel("Email (optional)").fill(mail("pia"));
  await page.getByLabel("Also create a sign-in for this person").check();
  await page.locator("#roleId").selectOption({ label: "Employee" });
  await page.getByLabel("Temporary password").fill(pw);
  await page.getByRole("button", { name: "Add employee" }).click();
  await expect(alert(page)).toContainText("already has a login");

  const pia = await db.employee.findFirstOrThrow({ where: { user: { email: mail("pia") } }, include: { user: true } });
  expect(pia.user?.mustChangePassword).toBe(true);
  expect(pia.managerId).toBe(ids.mgr);
  ids.pia = pia.id;

  await page.getByRole("link", { name: /Reyes, Pia/ }).click();
  await h1(page, "Pia Reyes");
  await expect(page.getByText(/^Hired/)).toBeVisible();
  await page.locator("#departmentId").selectOption({ label: "Operations" });
  await page.locator("#status").selectOption({ label: "On leave" });
  await page.getByLabel("Reason or note (optional)").fill("Transfer test");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.reload();
  await expect(page.getByText("Assignment changed")).toBeVisible();
  await expect(page.getByText("Status changed")).toBeVisible();
  await expect(page.getByText(/^Hired/)).toBeVisible(); // original row still there
  expect(await db.employmentHistory.count({ where: { employeeId: pia.id } })).toBe(3);

  // A person cannot be their own boss, or create a loop.
  await page.locator("#managerId").selectOption({ label: "Marco Test · T-mgr" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText(/Saved|Nothing changed/);
});

test("settings: work rules, a new shift and a new leave type", async ({ page }) => {
  watch(page);
  await signIn(page, "sa");
  await page.goto("/settings");
  await page.getByLabel("Grace period (minutes)").fill("15");
  await page.getByRole("button", { name: "Save work rules" }).click();
  await expect(page.getByText("Work rules saved.")).toBeVisible();
  expect((await db.orgSettings.findFirstOrThrow({ where: { organization: { name: `Sys A ${stamp}` } } })).graceMinutes).toBe(15);
  await page.getByLabel("Shift name").fill("Night test");
  await page.getByLabel("Starts").fill("22:00");
  await page.getByLabel("Ends").fill("06:00");
  await page.getByRole("button", { name: "Add shift" }).click();
  await expect(page.getByText("Night test added.")).toBeVisible();
  await page.getByLabel("Leave type", { exact: true }).fill("Study leave");
  await page.getByRole("button", { name: "Add leave type" }).click();
  await expect(page.getByText("Study leave added.")).toBeVisible();
  await page.getByLabel("Grace period (minutes)").fill("500");
  await page.getByRole("button", { name: "Save work rules" }).click();
  await expect(page.getByLabel("Grace period (minutes)")).toBeVisible(); // browser max blocks it
});

test("schedule: regular weekly schedule, day overrides, warning when missing, manager limited to own team", async ({ page }) => {
  watch(page);
  await signIn(page, "hr");
  await page.goto("/schedule");
  await h1(page, "Schedule");
  await expect(page.getByText(/(have|has) no regular schedule/)).toBeVisible();
  await expect(page.getByText("Late, undertime and overtime cannot be measured")).toBeVisible();

  const regular = page.locator("form", { has: page.getByRole("button", { name: "Save regular schedule" }) });
  await regular.getByRole("button", { name: "Choose everyone" }).click();
  await regular.getByLabel("Regular shift").selectOption({ label: "Regular (08:00–17:00)" });
  await regular.getByRole("button", { name: "Save regular schedule" }).click();
  await expect(regular.getByRole("status")).toContainText("Regular schedule saved for");
  await page.reload();
  await expect(page.getByText(/(have|has) no regular schedule/)).toHaveCount(0);
  expect(await db.regularSchedule.count({ where: { employeeId: ids.e1 } })).toBe(1);

  // It repeats every week from its start date.
  await page.getByRole("link", { name: "Next →" }).click();
  await expect(page.locator("tr", { hasText: "Test, Eli" }).getByText("08:00–17:00").first()).toBeVisible();

  // A one-day change sits on top of the regular schedule.
  const wed = addDays(nextMonday, 2);
  const change = page.locator("form", { has: page.getByRole("button", { name: "Save changes" }) });
  await change.getByLabel("Test, Eli").check();
  await change.getByLabel("Shift").selectOption("OFF");
  await change.getByLabel("From", { exact: true }).fill(wed);
  await change.getByLabel("To", { exact: true }).fill(wed);
  await change.getByRole("button", { name: "Save changes" }).click();
  await expect(change.getByRole("status")).toContainText("Schedule saved");
  await page.goto(`/schedule?week=${nextMonday}`);
  await expect(page.locator("tr", { hasText: "Test, Eli" }).locator("span.text-warning", { hasText: "Off" })).toHaveCount(1); // only the changed day is orange
  expect(await db.scheduleEntry.count({ where: { employeeId: ids.e1, shiftId: null } })).toBe(1);

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "mgr");
  await page.goto("/schedule");
  await expect(page.getByLabel("Test, Eli").first()).toBeVisible();
  await expect(page.getByLabel("Test, Eve")).toHaveCount(0);
  await expect(page.getByText("Test, Eve")).toHaveCount(0);
});

// Step 2 + 3 of the time stamp: verify the password, then press an action tile.
async function pressAction(card: import("@playwright/test").Locator, name: string | RegExp) {
  await card.getByLabel("Your password").fill(pw);
  await card.getByRole("button", { name: "Verify and unlock" }).click();
  await expect(card.getByText(/Unlocked · /)).toBeVisible();
  await card.getByRole("button", { name }).click();
}

test("time clock: password unlock, then Time In, Break, End Break and Time Out with GPS", async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: { latitude: 14.5995, longitude: 120.9842, accuracy: 12 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  watch(page);
  await signIn(page, "e1");
  const card = page.getByRole("region", { name: "Time clock" });
  await expect(card.getByText("Not timed in")).toBeVisible();

  // Locked until the password is verified.
  await expect(card.getByRole("button", { name: "Time In" })).toBeDisabled();
  await expect(card.getByRole("button", { name: "Enter your password to continue" })).toBeDisabled();
  await card.getByLabel("Your password").fill("not-my-password");
  await card.getByRole("button", { name: "Verify and unlock" }).click();
  await expect(card.locator("p[role=alert]")).toContainText("Wrong password");
  await expect(card.getByRole("button", { name: "Time In" })).toBeDisabled();

  await card.getByRole("radio", { name: "Field work" }).click();
  await pressAction(card, "Time In");
  await expect(card.getByRole("status").filter({ hasText: "Timed in at" })).toContainText(/location recorded \(±12 m\)/);
  await expect(card.getByText("Timed in", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Time In" })).toBeDisabled(); // one unlock, one time stamp: locked again
  await backdate(ids.e1, 240);

  await pressAction(card, /^Break/);
  await expect(card.getByRole("status").filter({ hasText: "Break started" })).toBeVisible();
  await expect(card.getByText(/^Break · \d+:\d\d$/)).toBeVisible();
  await backdate(ids.e1, 180);

  await card.getByLabel("Your password").fill(pw);
  await card.getByRole("button", { name: "Verify and unlock" }).click();
  await expect(card.getByText(/Unlocked · /)).toBeVisible();
  await expect(card.getByRole("button", { name: /^Meal/ })).toBeDisabled(); // on a break: other pauses wait
  await expect(card.getByRole("button", { name: "Time In" })).toBeDisabled();
  await card.getByRole("button", { name: /^End Break/ }).click();
  await expect(card.getByRole("status").filter({ hasText: "Break ended" })).toBeVisible();
  await backdate(ids.e1, 150);

  await pressAction(card, "Time Out");
  await expect(card.getByRole("status").filter({ hasText: "Timed out" })).toBeVisible();
  await expect(card.getByText("Not timed in")).toBeVisible();

  const events = await db.timeEvent.findMany({ where: { employeeId: ids.e1 }, orderBy: { at: "asc" }, include: { stampType: true } });
  expect(events.map((e) => e.type)).toEqual(["IN", "PAUSE_START", "PAUSE_END", "OUT"]);
  expect(events.map((e) => e.stampType?.key)).toEqual(["TIME_IN", "BREAK", "BREAK", "TIME_OUT"]);
  expect(events[0]).toMatchObject({ workContext: "FIELD", gpsStatus: "OK", source: "WEB" });
  expect(events[0].lat).toBeCloseTo(14.5995, 3);

  await page.goto("/dtr");
  await h1(page, "DTR");
  const todayRow = page.locator("details", { hasText: "today" }).first();
  await expect(todayRow.getByText("Present")).toBeVisible();
  await todayRow.locator("summary").click();
  await expect(todayRow.getByRole("link", { name: /View location \(±12 m\)/ }).first()).toHaveAttribute("href", /openstreetmap\.org.*14\.5995/);
  await expect(todayRow.getByText(/Break.*\(start\)/)).toBeVisible();
  await ctx.close();
});

test("time clock without GPS: note required, flagged, and BLOCK policy refuses", async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: [] }); // location denied
  const page = await ctx.newPage();
  watch(page);
  await signIn(page, "e2");
  const card = page.getByRole("region", { name: "Time clock" });
  await pressAction(card, "Time In");
  await expect(card.locator("p[role=alert]")).toContainText("Add a short note");
  await card.getByLabel(/^Note/).fill("no signal at site");
  await card.getByRole("button", { name: "Time In" }).click(); // the unlock is kept after a failed try
  await expect(card.getByRole("status").filter({ hasText: "no location, flagged" })).toBeVisible();
  const ev = await db.timeEvent.findFirstOrThrow({ where: { employeeId: ids.e2 } });
  expect(ev.gpsStatus).toBe("DENIED");
  expect(ev.lat).toBeNull();
  expect(ev.note).toBe("no signal at site");

  await backdate(ids.e2, 60);
  await db.orgSettings.updateMany({ where: { organization: { name: `Sys A ${stamp}` } }, data: { gpsPolicy: "BLOCK" } });
  await pressAction(card, /^Break/);
  await expect(card.locator("p[role=alert]")).toContainText("requires your location");
  expect(await db.timeEvent.count({ where: { employeeId: ids.e2 } })).toBe(1);
  await db.orgSettings.updateMany({ where: { organization: { name: `Sys A ${stamp}` } }, data: { gpsPolicy: "ALLOW_FLAG" } });

  await page.goto("/dtr");
  await expect(page.getByText("Location flag").first()).toBeVisible();
  await ctx.close();
});

test("a custom time stamp: Super Admin adds it, people use it, a note is required", async ({ browser }) => {
  const sa = await browser.newPage();
  watch(sa);
  await signIn(sa, "sa");
  await sa.goto("/settings");
  await expect(sa.getByRole("heading", { name: "Time stamps" })).toBeVisible();
  await expect(sa.getByText("Required").first()).toBeVisible(); // Time In / Time Out cannot be archived
  await expect(sa.getByRole("button", { name: "Archive Time In" })).toHaveCount(0);
  await sa.getByLabel("Name", { exact: true }).fill("Training");
  await sa.getByLabel("Flag when longer than (minutes, optional)").fill("30");
  await sa.getByLabel("Needs a note").check();
  await sa.getByRole("button", { name: "Add time stamp" }).click();
  await expect(sa.getByText("Training added.")).toBeVisible();
  await sa.getByLabel("Name", { exact: true }).fill("training");
  await sa.getByRole("button", { name: "Add time stamp" }).click();
  await expect(sa.locator("p[role=alert]")).toContainText("already exists");
  const custom = await db.timeStampType.findFirstOrThrow({ where: { organization: { name: `Sys A ${stamp}` }, name: "Training" } });
  expect(custom).toMatchObject({ kind: "PAUSE", requiresNote: true, allowedMinutes: 30, paid: true, locked: false });

  // An employee who is timed in now sees the new tile.
  await db.timeEvent.deleteMany({ where: { employeeId: ids.pia ?? "none" } });
  const ctx = await browser.newContext({ geolocation: { latitude: 14.6, longitude: 121.0, accuracy: 10 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  watch(page);
  await signIn(page, "mgr");
  const card = page.getByRole("region", { name: "Time clock" });
  await pressAction(card, "Time In");
  await expect(card.getByRole("status").filter({ hasText: "Timed in" })).toBeVisible();
  await backdate(ids.mgr, 120);
  await pressAction(card, /^Training/);
  await expect(card.locator("p[role=alert]")).toContainText("Training needs a short note");
  await card.getByLabel(/^Note/).fill("Product training");
  await card.getByRole("button", { name: /^Training/ }).click();
  await expect(card.getByRole("status").filter({ hasText: "Training started" })).toBeVisible();
  await expect(card.getByText(/^Training · /)).toBeVisible();
  await backdate(ids.mgr, 40);
  await pressAction(card, /^End Training/); // same tile ends it; no note needed
  await expect(card.getByRole("status").filter({ hasText: "Training ended" })).toBeVisible();
  await ctx.close();

  // Archive it: gone from the clock, but its history stays.
  await sa.goto("/settings");
  await sa.getByRole("button", { name: "Archive Training" }).click();
  await expect(sa.getByRole("button", { name: "Restore Training" })).toBeVisible();
  expect(await db.timeEvent.count({ where: { stampTypeId: custom.id } })).toBe(2);
  await sa.close();
});

test("paid and unpaid pauses: worked time and the over-limit flag", async ({ page }) => {
  watch(page);
  const org = await db.organization.findFirstOrThrow({ where: { name: `Sys A ${stamp}` } });
  const [brk, meal, tin, tout] = await Promise.all(
    ["BREAK", "MEAL", "TIME_IN", "TIME_OUT"].map((key) => db.timeStampType.findFirstOrThrow({ where: { organizationId: org.id, key } })),
  );
  const day = addDays(today, -3); // inside a window HR can open
  const at = (hm: string) => new Date(`${day}T${hm}:00+08:00`);
  const ev = (type: "IN" | "OUT" | "PAUSE_START" | "PAUSE_END", hm: string, t: { id: string }) =>
    db.timeEvent.create({ data: { organizationId: org.id, employeeId: ids.e2, type, stampTypeId: t.id, at: at(hm), gpsStatus: "OK", lat: 14.6, lng: 121 } });
  await ev("IN", "08:00", tin);
  await ev("PAUSE_START", "10:00", brk);
  await ev("PAUSE_END", "10:30", brk); // allowed 15: 15 minutes over
  await ev("PAUSE_START", "12:00", meal);
  await ev("PAUSE_END", "13:00", meal); // unpaid hour
  await ev("OUT", "17:00", tout);

  await signIn(page, "hr");
  await page.goto(`/dtr?employee=${ids.e2}&from=${day}&to=${day}`);
  const row = page.locator("details").first();
  await expect(row.getByText("Over break limit 15m")).toBeVisible();
  await row.locator("summary").click();
  await expect(row.getByText(/Break.*30m.*paid/)).toBeVisible();
  await expect(row.getByText(/Meal.*1h 00m.*unpaid/)).toBeVisible();
  await expect(row.getByText("over by 15m")).toBeVisible();
  await expect(row.locator("summary")).toContainText("8h 00m"); // 9h on site minus the unpaid meal; the paid break counts
});

test("late, undertime and overtime are judged by the schedule that applied on that day", async ({ page }) => {
  watch(page);
  const org = await db.organization.findFirstOrThrow({ where: { name: `Sys A ${stamp}` } });
  const shift = await db.shiftTemplate.findFirstOrThrow({ where: { organizationId: org.id, name: "Regular" } });
  const [tin, tout] = await Promise.all(["TIME_IN", "TIME_OUT"].map((key) => db.timeStampType.findFirstOrThrow({ where: { organizationId: org.id, key } })));
  const dayOfWeek = (k: string) => new Date(`${k}T00:00:00Z`).getUTCDay();
  const weekdayBack = (from: number) => { let k = addDays(today, -from); while ([0, 6].includes(dayOfWeek(k))) k = addDays(k, -1); return k; };
  const lateDay = weekdayBack(12);
  const otDay = weekdayBack(14);
  const noPlanDay = addDays(today, -60);
  const punch = (d: string, type: "IN" | "OUT", hm: string) =>
    db.timeEvent.create({ data: { organizationId: org.id, employeeId: ids.e2, type, stampTypeId: (type === "IN" ? tin : tout).id, at: new Date(`${d}T${hm}:00+08:00`), gpsStatus: "OK", lat: 14.6, lng: 121 } });
  await punch(lateDay, "IN", "08:35"); await punch(lateDay, "OUT", "16:30"); // 35 late (grace 15), 30 under
  await punch(otDay, "IN", "07:50"); await punch(otDay, "OUT", "18:15"); // early, 75 over
  await punch(noPlanDay, "IN", "08:30"); await punch(noPlanDay, "OUT", "17:00"); // before any schedule existed
  await db.regularSchedule.create({ data: { organizationId: org.id, employeeId: ids.e2, shiftId: shift.id, workDays: [1, 2, 3, 4, 5], effectiveFrom: new Date(`${addDays(today, -30)}T00:00:00Z`) } });

  await signIn(page, "hr");
  const open = async (d: string) => {
    await page.goto(`/dtr?employee=${ids.e2}&from=${d}&to=${d}`);
    return page.locator("details").first();
  };
  let row = await open(lateDay);
  await expect(row.getByText("Late 35m")).toBeVisible();
  await expect(row.getByText("Under 30m")).toBeVisible();
  row = await open(otDay);
  await expect(row.getByText("Over 1h 15m")).toBeVisible();
  await expect(row.getByText(/^Late/)).toHaveCount(0); // 07:50 is early
  row = await open(noPlanDay); // nothing was scheduled then, so nothing is judged
  await expect(row.getByText("No schedule: not measured")).toBeVisible();
  await expect(row.getByText(/Late \d/)).toHaveCount(0);

  // HR moves Eve to the night shift from today. Past days must not change.
  await page.goto(`/employees/${ids.e2}`);
  await expect(page.getByText("Regular (08:00–17:00) · Mon–Fri")).toBeVisible();
  await page.getByText("Change regular schedule").click();
  await page.getByLabel("Regular shift").selectOption({ label: "Night test (22:00–06:00)" });
  await page.getByRole("button", { name: "Save regular schedule" }).click();
  await expect(page.getByRole("status")).toContainText("Regular schedule saved");
  await page.reload();
  await expect(page.getByText("Night test (22:00–06:00) · Mon–Fri").first()).toBeVisible();
  await expect(page.getByText(/From .*Regular · Mon–Fri/)).toBeVisible(); // history keeps the old one
  row = await open(lateDay);
  await expect(row.getByText("Late 35m")).toBeVisible(); // unchanged

  // Someone with no schedule is called out on the Employees list, the DTR and for managers.
  const nora = await db.employee.create({
    data: { organizationId: org.id, employeeNo: "T-noplan", firstName: "Nora", lastName: "Noplan", hireDate: new Date("2026-01-05T00:00:00Z") },
  });
  await page.goto("/employees");
  await expect(page.locator("li", { hasText: "Noplan, Nora" }).getByText("No schedule")).toBeVisible();
  await expect(page.locator("li", { hasText: "Test, Eve" }).getByText("No schedule")).toHaveCount(0);
  await page.goto(`/dtr?employee=${nora.id}`);
  await expect(page.getByText("No schedule for Nora in this period")).toBeVisible();
  await expect(page.getByRole("link", { name: "Set a regular schedule" })).toBeVisible();
});

test("a regular schedule decides which days cost leave", async ({ page }) => {
  watch(page);
  const org = await db.organization.findFirstOrThrow({ where: { name: `Sys A ${stamp}` } });
  const shift = await db.shiftTemplate.findFirstOrThrow({ where: { organizationId: org.id, name: "Regular" } });
  // Marco works Tuesday to Saturday, so a Monday-Tuesday leave costs one day.
  await db.regularSchedule.create({ data: { organizationId: org.id, employeeId: ids.mgr, shiftId: shift.id, workDays: [2, 3, 4, 5, 6], effectiveFrom: new Date(`${today}T00:00:00Z`) } }); // same start as the earlier one; the newer row wins
  await signIn(page, "mgr");
  await page.goto("/leave");
  await page.getByLabel("Leave type").selectOption({ label: "Sick leave" });
  await page.getByLabel("From", { exact: true }).fill(nextMonday);
  await page.getByLabel("To", { exact: true }).fill(addDays(nextMonday, 1));
  await page.getByLabel("Reason").fill("Check-up");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("status")).toContainText("Request sent for 1 day.");
  await page.getByLabel("Leave type").selectOption({ label: "Sick leave" }); // the form resets after a success
  await page.getByLabel("From", { exact: true }).fill(addDays(nextMonday, 6)); // Sunday: not a work day for Marco
  await page.getByLabel("To", { exact: true }).fill(addDays(nextMonday, 6));
  await page.getByLabel("Reason").fill("Sunday only");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("days off");
});

test("password step can be switched off: tiles work straight away", async ({ browser }) => {
  await db.orgSettings.updateMany({ where: { organization: { name: `Sys A ${stamp}` } }, data: { requirePunchPassword: false } });
  const ctx = await browser.newContext({ geolocation: { latitude: 14.6, longitude: 121.0, accuracy: 10 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  watch(page);
  await signIn(page, "e1");
  const card = page.getByRole("region", { name: "Time clock" });
  await expect(card.getByLabel("Your password")).toHaveCount(0);
  await expect(card.getByText("Verify your password")).toHaveCount(0);
  await card.getByRole("button", { name: "Time In" }).click();
  await expect(card.getByRole("status").filter({ hasText: "Timed in" })).toBeVisible();
  await ctx.close();
  await db.orgSettings.updateMany({ where: { organization: { name: `Sys A ${stamp}` } }, data: { requirePunchPassword: true } });
});

test("DTR visibility follows the chain", async ({ page }) => {
  watch(page);
  await signIn(page, "e1");
  await page.goto(`/dtr?employee=${ids.e2}`);
  await expect(page.getByText("could not be found")).toBeVisible();
  await page.goto(`/schedule?employee=${ids.e2}`); // must not list a coworker just because the id is in the URL
  await expect(page.getByText("Test, Eve")).toHaveCount(0);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click().catch(() => {});
  await page.goto("/login");
  await signIn(page, "mgr");
  await page.goto(`/dtr?employee=${ids.e1}`);
  await expect(page.getByText(/Eli Test · T-e1/)).toBeVisible();
  await page.goto(`/dtr?employee=${ids.e2}`);
  await expect(page.getByText("could not be found")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click().catch(() => {});
  await page.goto("/login");
  await signIn(page, "hr");
  await page.goto(`/dtr?employee=${ids.e2}`);
  await expect(page.getByText(/Eve Test · T-e2/)).toBeVisible();
});

test("HR corrects the record: missed punch added, then voided, both on record", async ({ page }) => {
  watch(page);
  await signIn(page, "hr");
  const yesterday = addDays(today, -1);
  await page.goto(`/dtr?employee=${ids.e1}&from=${yesterday}&to=${today}`);
  await page.getByLabel("Date").fill(yesterday);
  await page.getByLabel("Time", { exact: true }).fill("09:05");
  await page.getByLabel("Reason (required, kept on record)").fill("ab");
  await page.getByRole("button", { name: "Add missed punch" }).click();
  await expect(alert(page)).toContainText("at least 5");
  await page.getByLabel("Reason (required, kept on record)").fill("Forgot to clock in, confirmed by supervisor");
  await page.getByRole("button", { name: "Add missed punch" }).click();
  await expect(page.getByRole("status")).toContainText("Missed punch added");
  await page.reload();
  const row = page.locator("details", { hasText: "Manual entry" }).first();
  await row.locator("summary").click();
  await expect(row.getByText("Manual entry")).toBeVisible();
  await row.getByRole("button", { name: "Void" }).click();
  await row.getByLabel("Reason for voiding").fill("Entered by mistake");
  await row.getByRole("button", { name: "Void punch" }).click();
  await page.reload();
  await page.locator("details", { hasText: "Manual entry" }).first().locator("summary").click();
  await expect(page.getByText("Voided: Entered by mistake")).toBeVisible();
  const ev = await db.timeEvent.findFirstOrThrow({ where: { employeeId: ids.e1, source: "MANUAL" } });
  expect(ev.voidedAt).not.toBeNull();
  expect(ev.gpsStatus).toBe("NOT_CAPTURED");
});

test("DTR download is a CSV and respects access", async ({ page }) => {
  await signIn(page, "hr");
  const url = `/dtr/export?employee=all&from=${weekStart(today)}&to=${addDays(weekStart(today), 6)}`;
  const res = await page.request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const body = await res.text();
  expect(body.split("\r\n")[0]).toContain("Employee no,Name,Date");
  expect(body).toContain("T-e1");
  const bad = await page.request.get("/dtr/export?employee=all&from=bad&to=bad");
  expect(bad.status()).toBe(400);
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "e1");
  const other = await page.request.get(`/dtr/export?employee=${ids.e2}&from=${today}&to=${today}`);
  expect(other.status()).toBe(404);
});

test("leave: request, validation, manager approves, DTR shows it", async ({ page }) => {
  watch(page);
  await signIn(page, "e1");
  await page.goto("/leave");
  await h1(page, "Leave");
  await expect(page.getByText("Waiting for your decision")).toHaveCount(0);
  const ask = async (from: string, to: string, reason: string) => {
    await page.getByLabel("Leave type").selectOption({ label: "Vacation leave" });
    await page.getByLabel("From", { exact: true }).fill(from);
    await page.getByLabel("To", { exact: true }).fill(to);
    await page.getByLabel("Reason").fill(reason);
    await page.getByRole("button", { name: "Send request" }).click();
  };
  await ask(nextMonday, addDays(nextMonday, 1), "Family trip");
  await expect(page.getByRole("status")).toContainText("Request sent for 2 days");
  await expect(page.getByText("Pending").first()).toBeVisible();
  await ask(nextMonday, nextMonday, "Overlap");
  await expect(alert(page)).toContainText("overlaps");
  await ask(addDays(nextMonday, 14), addDays(nextMonday, 40), "Too long");
  await expect(alert(page)).toContainText("Not enough vacation leave left");
  await ask(addDays(nextMonday, 5), addDays(nextMonday, 6), "Weekend only");
  await expect(alert(page)).toContainText("days off");

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "e2");
  await page.goto("/leave");
  await expect(page.getByText("Family trip")).toHaveCount(0); // not visible to other employees

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "mgr");
  await page.goto("/leave");
  const card = page.locator("li", { hasText: "Family trip" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Reject" }).click();
  await expect(card.locator("p[role=alert]")).toContainText("reason for rejecting");
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Family trip")).toHaveCount(0); // gone from the queue
  expect((await db.leaveRequest.findFirstOrThrow({ where: { employeeId: ids.e1 } })).status).toBe("APPROVED");

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "hr");
  await page.goto(`/dtr?employee=${ids.e1}&from=${nextMonday}&to=${addDays(nextMonday, 2)}`);
  await expect(page.getByText("On leave").first()).toBeVisible();
});

test("leave: nobody approves their own, HR can reject with a reason", async ({ page }) => {
  watch(page);
  await signIn(page, "hr");
  await page.goto("/leave");
  await page.getByLabel("Leave type").selectOption({ label: "Sick leave" });
  await page.getByLabel("From", { exact: true }).fill(addDays(nextMonday, 3)); // a weekday: weekends cost no leave
  await page.getByLabel("To", { exact: true }).fill(addDays(nextMonday, 3));
  await page.getByLabel("Reason").fill("Fever");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("status")).toContainText("Request sent");
  await expect(page.locator("li", { hasText: "Fever" }).getByRole("button", { name: "Approve" })).toHaveCount(0); // HR cannot self-approve

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "e2");
  await page.goto("/leave");
  await page.getByLabel("Leave type").selectOption({ label: "Sick leave" });
  await page.getByLabel("From", { exact: true }).fill(addDays(nextMonday, 7));
  await page.getByLabel("To", { exact: true }).fill(addDays(nextMonday, 7));
  await page.getByLabel("Reason").fill("Dentist");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("status")).toContainText("Request sent");
  await page.getByRole("button", { name: "Cancel request" }).click();
  await expect(page.getByText("Cancelled")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "sa");
  await page.goto("/leave");
  await expect(page.getByText("Fever")).toBeVisible(); // Super Admin may decide for HR
});

test("another organization's data is invisible", async ({ page }) => {
  watch(page);
  await signIn(page, "sb");
  await page.goto("/employees");
  await expect(page.locator("li", { hasText: "T-sb" })).toBeVisible();
  await expect(page.getByText("T-e1")).toHaveCount(0);
  for (const path of [`/employees/${ids.e1}`, `/dtr?employee=${ids.e1}`]) {
    await page.goto(path);
    await expect(page.getByText("could not be found")).toBeVisible();
  }
  await page.goto("/audit");
  await expect(page.getByText("Sys A")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "sa");
  await page.goto(`/employees/${ids.sb}`);
  await expect(page.getByText("could not be found")).toBeVisible();
});

test("audit log records what happened, with who", async ({ page }) => {
  await signIn(page, "sa");
  await page.goto("/audit");
  await h1(page, "Audit log");
  await expect(page.getByText("Leave approved").first()).toBeVisible();
  await expect(page.getByText("Employee created").first()).toBeVisible();
  await page.getByLabel("Filter").fill("shift");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("Shift created").first()).toBeVisible();
});

test("phone: bottom bar, More sheet, and no sideways scroll", async ({ page }) => {
  watch(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page, "sa");
  const bar = page.locator("nav:visible");
  for (const l of ["Home", "DTR", "Schedule", "Leave"]) await expect(bar.getByRole("link", { name: l })).toBeVisible();
  await expect(bar.getByRole("button", { name: "More" })).toBeVisible();
  await bar.getByRole("button", { name: "More" }).click();
  const sheet = page.getByRole("dialog", { name: "All pages" });
  await expect(sheet.getByRole("link", { name: "Audit log" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Payroll" })).toBeVisible();
  await sheet.getByRole("link", { name: "Audit log" }).click();
  await expect(page).toHaveURL(/\/audit$/);
  await expect(sheet).toHaveCount(0);
  for (const path of ["/dashboard", "/employees", "/organization", "/schedule", "/dtr", "/leave", "/settings", "/admin/users", "/audit"]) {
    await page.goto(path);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} scrolls sideways`).toBe(true);
  }
  await page.goto("/dashboard");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e/shot-system-mobile.png" });
});

test("desktop screenshots of the main screens", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 860 });
  await signIn(page, "sa");
  for (const [path, name] of [["/dashboard", "dashboard"], ["/employees", "employees"], ["/dtr", "dtr"], ["/schedule", "schedule"], ["/leave", "leave"], ["/organization", "organization"], ["/settings", "settings"]]) {
    await page.goto(path);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `e2e/shot-system-${name}.png` });
  }
});
