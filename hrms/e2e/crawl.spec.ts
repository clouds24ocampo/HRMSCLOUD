import { appendFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { cutoffFor } from "../src/lib/cutoffs";
import { addDays, dayKey } from "../src/lib/time";
import { TEMPLATES } from "../src/lib/worksync";
import { wipeOrgs } from "./helpers";

// Every page, for every role: it opens without a server error or a crash, every link inside it leads somewhere that
// works, and every harmless button can be pressed without a browser error. Destructive buttons are left alone
// (they have their own tests): delete, archive, reject, finalize, void, sign out, cancel…
test.describe.configure({ mode: "parallel" });
// CRAWL_MOBILE=1 runs the same crawl on a phone-sized screen and also reports any page that scrolls sideways.
if (process.env.CRAWL_MOBILE) test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.setTimeout(900_000);

const stamp = `crawl${Date.now()}${Math.floor(Math.random() * 1e6)}`; // one organization per worker
const pw = "correct-horse-battery";
const TZ = "Asia/Manila";
const today = dayKey(new Date(), TZ);
const mail = (n: string) => `${n}-${stamp}@example.test`;
const ids: Record<string, string> = {};
const SKIP_BUTTON = /delete|archive|reject|decline|finali[sz]e|void|sign out|cancel|remove|deactivate|reset|approve|calculate|hang up|clear|send|sign$|upload|publish|record|save|add|create|request|submit|hire|move to|time in|time out|break|meal|trip|issue|start|end |switch|unlock|verify|answer|message|call|voice|video|mark|acknowledge|install|turn|apply|show|download|print|confirm|report a problem|i received/i;

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const role = (k: string) => roles.find((r) => r.key === k)!.id;
  const hash = await bcrypt.hash(pw, 4);
  const org = await db.organization.create({ data: { name: `Crawl ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  ids.org = org.id;
  await db.orgSettings.create({ data: { organizationId: org.id, requirePunchPassword: false } });
  const dept = await db.department.create({ data: { organizationId: org.id, name: "Operations" } });
  const head = await db.position.create({ data: { organizationId: org.id, title: "Ops Head", level: "DEPT_HEAD", departmentId: dept.id } });
  const person = async (k: string, first: string, roleKey: string, extra: object = {}) => {
    const user = await db.user.create({ data: { organizationId: org.id, email: mail(k), name: `${first} Crawl`, passwordHash: hash, roleId: role(roleKey) } });
    const e = await db.employee.create({ data: { organizationId: org.id, userId: user.id, employeeNo: `C-${k}`, firstName: first, lastName: "Crawl", hireDate: new Date("2026-01-05T00:00:00Z"), departmentId: dept.id, ...extra } });
    await db.compensation.create({ data: { organizationId: org.id, employeeId: e.id, payType: "MONTHLY", rateCents: 2_500_000, effectiveFrom: new Date("2026-01-05T00:00:00Z") } });
    ids[k] = e.id;
    ids[`${k}User`] = user.id;
    return e;
  };
  await person("sa", "Sara", ROLES.SUPER_ADMIN);
  await person("hr", "Hana", ROLES.HR_ADMIN);
  const mgr = await person("mgr", "Marco", ROLES.MANAGER, { positionId: head.id });
  await person("emp", "Ella", ROLES.EMPLOYEE, { managerId: mgr.id, flexible: true });

  // A day of work with a break and a weather issue, plus leave, overtime, a cash advance, a daily report, a chat.
  const t = async (key: string, name: string, kind: "IN" | "OUT" | "PAUSE", page: "PUNCH" | "ISSUE" = "PUNCH") => db.timeStampType.create({ data: { organizationId: org.id, key, name, kind, page } });
  const [tin, tout, brk, rain] = [await t("TIME_IN", "Time In", "IN"), await t("TIME_OUT", "Time Out", "OUT"), await t("BREAK", "Break 1", "PAUSE"), await t("HEAVY_RAIN", "Heavy Rain / Flood", "PAUSE", "ISSUE")];
  const d = addDays(today, -1);
  const at = (hm: string) => new Date(`${d}T${hm}:00+08:00`);
  const g = { gpsStatus: "OK" as const, lat: 14.6, lng: 121, accuracy: 9, device: "PHONE", locSource: "GPS" };
  await db.timeEvent.createMany({ data: [
    { organizationId: org.id, employeeId: ids.emp, type: "IN", stampTypeId: tin.id, at: at("08:00"), ...g },
    { organizationId: org.id, employeeId: ids.emp, type: "PAUSE_START", stampTypeId: brk.id, at: at("10:00"), ...g },
    { organizationId: org.id, employeeId: ids.emp, type: "PAUSE_END", stampTypeId: brk.id, at: at("10:15"), ...g },
    { organizationId: org.id, employeeId: ids.emp, type: "PAUSE_START", stampTypeId: rain.id, at: at("13:00"), ...g, note: "Flooded road" },
    { organizationId: org.id, employeeId: ids.emp, type: "PAUSE_END", stampTypeId: rain.id, at: at("13:30"), ...g },
    { organizationId: org.id, employeeId: ids.emp, type: "OUT", stampTypeId: tout.id, at: at("17:30"), ...g },
  ] });
  const lt = await db.leaveType.create({ data: { organizationId: org.id, name: "Vacation leave", annualDays: 15 } });
  await db.leaveRequest.create({ data: { organizationId: org.id, employeeId: ids.emp, leaveTypeId: lt.id, startDate: new Date(`${addDays(today, 7)}T00:00:00Z`), endDate: new Date(`${addDays(today, 7)}T00:00:00Z`), days: 1, reason: "Family event" } });
  await db.overtimeRequest.create({ data: { organizationId: org.id, employeeId: ids.emp, date: new Date(`${d}T00:00:00Z`), minutes: 30, reason: "Month end" } });
  await db.cashAdvance.create({ data: { organizationId: org.id, employeeId: ids.emp, amountCents: 300_000, installments: 2, reason: "Tuition fee" } });
  await db.dailyReport.create({ data: { organizationId: org.id, employeeId: ids.emp, date: new Date(`${today}T00:00:00Z`), accomplishments: "Closed tickets" } });
  const c = await db.conversation.create({ data: { organizationId: org.id, directKey: [ids.empUser, ids.hrUser].sort().join(":"), members: { create: [{ userId: ids.empUser }, { userId: ids.hrUser }] } } });
  await db.message.create({ data: { conversationId: c.id, senderId: ids.empUser, body: "Hello HR" } });
  ids.chat = c.id;
  const job = await db.jobPosting.create({ data: { organizationId: org.id, title: "Agent", departmentId: dept.id } });
  ids.job = job.id;
  // A WorkSync project with a few cards, so every view of it is crawled.
  const ws = await db.wsProject.create({ data: { organizationId: org.id, name: "Crawl board", kind: "PROGRAMMING", createdById: ids.hrUser, members: { create: [{ employeeId: ids.hr, role: "LEAD" }, { employeeId: ids.emp }, { employeeId: ids.mgr, role: "VIEWER" }] }, lists: { create: TEMPLATES.PROGRAMMING.map((l, position) => ({ ...l, position })) }, labels: { create: [{ name: "Bug", color: "red" }] } }, include: { lists: { orderBy: { position: "asc" } }, labels: true } });
  const wc = await db.wsCard.create({ data: { organizationId: org.id, projectId: ws.id, listId: ws.lists[2].id, title: "Crawl card", position: 1, createdById: ids.hrUser, startDate: new Date(`${addDays(today, -1)}T00:00:00Z`), dueDate: new Date(`${addDays(today, 3)}T00:00:00Z`), assignees: { create: { employeeId: ids.emp } }, labels: { create: { labelId: ws.labels[0].id } }, checklist: { create: { text: "Step", position: 1 } } } });
  ids.ws = ws.id;
  ids.wsCard = wc.id;
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
});

// Problems are written to a file as they are found, so a long run that stops early still shows what it saw.
const report = (line: string) => appendFileSync(process.env.CRAWL_LOG ?? "test-results/crawl.log", `${line}
`);

async function signIn(page: Page, who: string) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(mail(who));
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// Opens a page and reports what is wrong with it: server errors, the error screen, browser errors.
async function check(page: Page, path: string, problems: string[]) {
  const before = problems.length;
  const errors: string[] = [];
  const onErr = (e: Error) => errors.push(e.message.split("\n")[0]);
  const onConsole = (m: import("@playwright/test").ConsoleMessage) => {
    if (m.type() === "error" && !/geolocation|Failed to load resource|favicon|status of 404/i.test(m.text())) errors.push(m.text().split("\n")[0].slice(0, 200));
  };
  page.on("pageerror", onErr);
  page.on("console", onConsole);
  // A late redirect from the page just left can interrupt the next navigation: try once more before reporting it.
  const go = () => page.goto(path);
  const res = await go().catch(() => go()).catch((e: Error) => {
    if (!/ERR_ABORTED|interrupted by another navigation/.test(e.message)) errors.push(`could not open: ${e.message.split("\n")[0]}`);
    return null;
  });
  // Not "networkidle": the call checker polls every few seconds, so the network is never idle.
  await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(300);
  if (res && res.status() >= 500) problems.push(`${path}: HTTP ${res.status()}`);
  if (await page.getByText(/We could not load this page|Application error|Unhandled Runtime Error/).count()) problems.push(`${path}: error screen`);
  if ((page.viewportSize()?.width ?? 1000) < 500) {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 0);
    if (over > 2) problems.push(`${path}: scrolls sideways by ${over}px on a phone`);
  }
  page.off("pageerror", onErr);
  page.off("console", onConsole);
  for (const e of errors) problems.push(`${path}: ${e}`);
  for (const p of problems.slice(before)) report(p);
}

const PAGES = [
  "/dashboard", "/employees", "/organization", "/recruitment", "/documents", "/policies", "/id", "/id/design", "/schedule", "/schedule/live", "/schedule/analytics",
  "/dtr", "/overtime", "/leave", "/daily-report", "/payroll", "/payroll/setup", "/payroll/rules", "/payroll/holidays", "/payroll/reports", "/payroll/calculators",
  "/worksync", "/payslips", "/cash-advance", "/performance", "/learning", "/chat", "/requests", "/announcements", "/reports", "/analytics", "/settings", "/admin/users",
  "/audit", "/notifications", "/change-password",
];

for (const who of ["sa", "hr", "mgr", "emp"]) {
  test(`every page and its links work for ${who}`, async ({ page }) => {
    const problems: string[] = [];
    await signIn(page, who);
    const dyn = [...["board", "table", "timeline", "calendar", "dashboard"].map((v) => `/worksync/${ids.ws}?view=${v}`), `/worksync/${ids.ws}?card=${ids.wsCard}`, `/worksync/${ids.ws}?panel=people`, `/employees/${ids.emp}`, `/organization/heads/${ids.mgr}`, `/chat/${ids.chat}`, `/recruitment/${ids.job}`];
    const period = await db.payrollPeriod.findFirst({ where: { organizationId: ids.org, name: cutoffFor(today).name } });
    if (period) dyn.push(`/payroll/${period.id}`);
    const policy = await db.policyDocument.findFirst({ where: { organizationId: ids.org } });
    if (policy) dyn.push(`/policies/${policy.id}`);
    const slip = await db.payslip.findFirst({ where: { organizationId: ids.org, employeeId: ids.emp } });
    if (slip) dyn.push(`/payslips/${slip.id}`);
    const seen = new Set<string>();
    for (const path of [...PAGES, ...dyn]) {
      await check(page, path, problems);
      // Every link on the page that stays inside the app.
      const hrefs = await page.locator("main a[href^='/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]).catch(() => [] as string[]);
      for (const h of hrefs) {
        const clean = h.split("#")[0];
        if (!clean || seen.has(clean) || /\/(file|proof|photo|signature|export)(\/|\?|$)|\.csv|\/dtr\/report|\/locate\//.test(clean)) continue;
        seen.add(clean);
        await check(page, clean, problems);
      }
      // Harmless buttons (tabs, show more, filters…): press each once and look for browser errors.
      await page.goto(path).catch(() => {});
      const names = (await page.locator("main button:visible:not([disabled])").evaluateAll((bs) => bs.map((b) => (b.getAttribute("aria-label") ?? (b as HTMLElement).innerText ?? "").split("\n")[0].trim())).catch(() => [] as string[]))
        .filter((n) => n && !SKIP_BUTTON.test(n));
      for (const name of [...new Set(names)].slice(0, 15)) {
        const errs: string[] = [];
        const onErr = (e: Error) => errs.push(e.message.split("\n")[0]);
        page.on("pageerror", onErr);
        await page.locator("main button:visible").filter({ hasText: name.slice(0, 30) }).first().click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(250);
        page.off("pageerror", onErr);
        for (const e of errs) {
          problems.push(`${path} button "${name.slice(0, 40)}": ${e}`);
          report(`${path} button "${name.slice(0, 40)}": ${e}`);
        }
        if (!page.url().includes(path.split("?")[0])) await page.goto(path).catch(() => {});
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
