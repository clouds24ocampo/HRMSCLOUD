import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../src/lib/db-client";
import { ROLES } from "../src/lib/roles";
import { wipeOrgs } from "./helpers";

// WorkSync: project boards. HR starts a network project, the employee on it works the card, a stranger sees nothing,
// and the daily activity page tells HR who did what.
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const pw = "correct-horse-battery";
const mail = (n: string) => `ws-${n}-${stamp}@example.test`;
const ids: Record<string, string> = {};
const problems: string[] = [];
let projectId = "";
const onBoard = (page: Page) => page.getByLabel("Project board").getByRole("link", { name: "Pull fibre to the second floor" });

async function signIn(page: Page, who: string) {
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email").fill(mail(who));
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeAll(async () => {
  const roles = await db.role.findMany();
  const role = (k: string) => roles.find((r) => r.key === k)!.id;
  const hash = await bcrypt.hash(pw, 4);
  const org = await db.organization.create({ data: { name: `WorkSync ${stamp}`, categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } });
  await db.orgSettings.create({ data: { organizationId: org.id } });
  const person = async (who: string, first: string, roleKey: string) => {
    const user = await db.user.create({ data: { organizationId: org.id, email: mail(who), name: `${first} Sync`, passwordHash: hash, roleId: role(roleKey) } });
    const e = await db.employee.create({ data: { organizationId: org.id, userId: user.id, employeeNo: `WS-${who}`, firstName: first, lastName: "Sync", hireDate: new Date("2025-01-06T00:00:00Z") } });
    ids[who] = e.id;
  };
  await person("hr", "Hana", ROLES.HR_ADMIN);
  await person("tech", "Tito", ROLES.EMPLOYEE);
  await person("viewer", "Vera", ROLES.EMPLOYEE);
  await person("stranger", "Sam", ROLES.EMPLOYEE);
});
test.afterAll(async () => {
  await wipeOrgs(stamp);
  await db.$disconnect();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("HR starts a network project, adds people and a card with a checklist", async ({ page }) => {
  await signIn(page, "hr");
  await page.goto("/worksync");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Branch fibre rollout");
  await page.getByLabel("Kind").selectOption("NETWORK");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Branch fibre rollout" })).toBeVisible();
  projectId = page.url().split("/worksync/")[1].split(/[?#]/)[0];
  for (const l of ["Planned", "Site survey / design", "Installation / configuration", "Testing", "Blocked", "Handed over"]) await expect(page.getByRole("heading", { name: l })).toBeVisible();

  await page.getByRole("link", { name: /People/ }).first().click();
  for (const [who, role, name] of [["tech", "MEMBER", "Tito Sync"], ["viewer", "VIEWER", "Vera Sync"]]) {
    await page.getByLabel("Add a person").selectOption({ value: ids[who] });
    await page.getByLabel("Role").selectOption(role);
    await page.getByRole("button", { name: "Add to project" }).click();
    await expect(page.getByText(`${name} added.`)).toBeVisible();
  }
  expect(await db.wsMember.count({ where: { projectId } })).toBe(3); // HR (lead), tech, viewer
  await page.keyboard.press("Escape"); // the panel closes
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByPlaceholder("+ Add a card").first().fill("Pull fibre to the second floor");
  await page.keyboard.press("Enter");
  await expect(onBoard(page)).toBeVisible();
  await onBoard(page).click();
  await page.getByRole("dialog").getByRole("button", { name: /Tito Sync/ }).click(); // assign
  await expect.poll(() => db.wsAssignee.count({ where: { employeeId: ids.tech } })).toBe(1);
  await page.getByPlaceholder("Add a step").fill("Survey the conduit");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Survey the conduit")).toBeVisible();
  expect(await db.notification.count({ where: { user: { email: mail("tech") }, title: { contains: "assigned you" } } })).toBe(1);
});

test("drag and drop moves a card between lists and keeps it", async ({ page }) => {
  await signIn(page, "hr");
  await page.goto(`/worksync/${projectId}`);
  const card = onBoard(page);
  await card.locator("xpath=ancestor::li[1]").dragTo(page.getByRole("region", { name: /^Site survey \/ design/ }));
  await expect.poll(async () => (await db.wsCard.findFirstOrThrow({ where: { projectId }, include: { list: true } })).list.name).toBe("Site survey / design");
  expect(await db.wsActivity.count({ where: { projectId, type: "MOVED" } })).toBe(1);
});

test("the employee works the card; finishing it records progress and tells the lead", async ({ page }) => {
  await signIn(page, "tech");
  await page.goto("/worksync");
  await expect(page.getByRole("link", { name: /Branch fibre rollout/ })).toBeVisible();
  await page.goto("/worksync?view=mine");
  await page.getByRole("link", { name: /Pull fibre to the second floor/ }).click();
  await page.getByLabel("Move to").selectOption({ label: "Handed over (Done)" });
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByText(/Moved to Handed over/)).toBeVisible();
  const done = await db.wsCard.findFirstOrThrow({ where: { projectId }, include: { list: true } });
  expect(done.list.category).toBe("DONE");
  expect(done.completedAt).not.toBeNull();
  await page.reload();
  await expect(page.getByText("100%").first()).toBeVisible();
  await page.getByPlaceholder("Write an update or a question").fill("Fibre pulled and tested, 12 dB loss.");
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(page.getByText("Comment sent.")).toBeVisible();
  expect(await db.notification.count({ where: { user: { email: mail("hr") }, title: { contains: "moved" } } })).toBe(1);
});

test("a viewer can read but not change; a stranger sees nothing and gets not found", async ({ browser }) => {
  const v = await browser.newPage();
  await signIn(v, "viewer");
  await v.goto(`/worksync/${projectId}`);
  await expect(v.getByRole("heading", { name: "Branch fibre rollout" })).toBeVisible();
  await expect(v.getByPlaceholder("+ Add a card")).toHaveCount(0);
  await expect(v.getByText(/you are a viewer on this project/)).toBeVisible();

  const s = await browser.newPage();
  await signIn(s, "stranger");
  await s.goto("/worksync");
  await expect(s.getByText("No projects yet")).toBeVisible();
  const card = await db.wsCard.findFirstOrThrow({ where: { projectId } });
  for (const url of [`/worksync/${projectId}`, `/worksync/${projectId}?card=${card.id}`]) {
    await s.goto(url);
    await expect(s.getByText(/could not be found|not found/i).first()).toBeVisible(); // the same page as a project that does not exist
    await expect(s.getByText("Branch fibre rollout")).toHaveCount(0);
    await expect(s.getByText("Pull fibre to the second floor")).toHaveCount(0);
  }
});

test("daily activity shows HR who did what; an employee sees only their own", async ({ browser }) => {
  const hr = await browser.newPage();
  await signIn(hr, "hr");
  await hr.goto("/worksync?view=today");
  await expect(hr.getByRole("heading", { name: "Tito Sync" })).toBeVisible();
  await expect(hr.getByText("1 finished").first()).toBeVisible();
  await expect(hr.getByRole("link", { name: "Pull fibre to the second floor" }).first()).toBeVisible();

  const emp = await browser.newPage();
  await signIn(emp, "tech");
  await emp.goto("/worksync?view=today");
  await expect(emp.getByRole("heading", { name: "Tito Sync" })).toBeVisible();
  await expect(emp.getByRole("heading", { name: "Hana Sync" })).toHaveCount(0);
});

test("table view: cells save in place; timeline, calendar and dashboard show the card", async ({ page }) => {
  await signIn(page, "hr");
  const card = await db.wsCard.findFirstOrThrow({ where: { projectId } });
  await page.goto(`/worksync/${projectId}?view=table`);
  const row = page.getByRole("row").filter({ hasText: "Pull fibre to the second floor" });
  await row.getByLabel("Priority").selectOption("URGENT");
  await expect.poll(async () => (await db.wsCard.findUniqueOrThrow({ where: { id: card.id } })).priority).toBe("URGENT");
  await row.getByLabel(/^Start date/).fill("2026-10-05");
  await row.getByLabel(/^Due date/).fill("2026-10-20");
  await expect.poll(async () => (await db.wsCard.findUniqueOrThrow({ where: { id: card.id } })).dueDate?.toISOString().slice(0, 10)).toBe("2026-10-20");
  // A start date after the due date is refused and the cell goes back.
  await row.getByLabel(/^Start date/).fill("2026-11-30");
  await expect(row.getByRole("alert")).toContainText("after the due date");
  expect((await db.wsCard.findUniqueOrThrow({ where: { id: card.id } })).startDate?.toISOString().slice(0, 10)).toBe("2026-10-05");

  await page.goto(`/worksync/${projectId}?view=timeline`);
  await expect(page.getByRole("link", { name: /Pull fibre to the second floor/ }).first()).toBeVisible();
  await page.goto(`/worksync/${projectId}?view=calendar&m=2026-10`);
  await expect(page.getByRole("grid", { name: "Calendar" }).getByRole("link", { name: /Pull fibre to the second floor/ }).first()).toBeVisible();
  await page.goto(`/worksync/${projectId}?view=dashboard`);
  await expect(page.getByRole("heading", { name: "Workload" })).toBeVisible();
  await expect(page.getByText("Finished per day, last 14 days")).toBeVisible();
});

test("labels and filters: label a card, then find it by label, text and person", async ({ page }) => {
  await signIn(page, "hr");
  const card = await db.wsCard.findFirstOrThrow({ where: { projectId } });
  await page.goto(`/worksync/${projectId}?card=${card.id}`);
  await page.getByRole("dialog").getByRole("button", { name: "Installation" }).click();
  await expect.poll(() => db.wsCardLabel.count({ where: { cardId: card.id } })).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/card=/);
  const label = await db.wsLabel.findFirstOrThrow({ where: { projectId, name: "Installation" } });
  await page.goto(`/worksync/${projectId}?label=${label.id}`);
  await expect(onBoard(page)).toBeVisible();
  await page.goto(`/worksync/${projectId}?q=nothing-like-this`);
  await expect(page.getByText(/Showing 0 of 1 cards/)).toBeVisible();
  await page.goto(`/worksync/${projectId}?who=${ids.tech}`);
  await expect(onBoard(page)).toBeVisible();
  await page.goto(`/worksync/${projectId}?who=none`);
  await expect(page.getByText(/Showing 0 of 1 cards/)).toBeVisible();
});

test("lists: add, rename, reorder by dragging, remove when empty; only leads can", async ({ page, browser }) => {
  await signIn(page, "hr");
  await page.goto(`/worksync/${projectId}`);
  await page.getByRole("button", { name: "+ Add another list" }).click();
  await page.getByLabel("List name").fill("Staging");
  await page.getByRole("button", { name: "Add list" }).click();
  await expect(page.getByRole("heading", { name: /Staging/ })).toBeVisible();
  const staging = await db.wsList.findFirstOrThrow({ where: { projectId, name: "Staging" } });

  const region = page.getByRole("region", { name: /^Staging/ });
  await region.getByLabel("Settings of list Staging").click();
  await region.getByLabel("Name", { exact: true }).fill("Pre-production");
  await region.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await db.wsList.findUniqueOrThrow({ where: { id: staging.id } })).name).toBe("Pre-production");

  await page.reload();
  // Drag the second list's header onto the first list (both are on screen): it becomes the first.
  await page.getByRole("heading", { name: /Site survey/ }).dragTo(page.getByRole("region", { name: /^Planned/ }));
  await expect.poll(async () => (await db.wsList.findMany({ where: { projectId, archivedAt: null }, orderBy: { position: "asc" } }))[0].name).toBe("Site survey / design");

  // A list holding cards cannot be removed.
  await page.reload();
  const full = page.getByRole("region", { name: /^Handed over/ });
  await full.getByLabel("Settings of list Handed over").click();
  await full.getByRole("button", { name: "Remove this list" }).click();
  await expect(full.getByText(/Move or archive the cards/)).toBeVisible();
  expect(await db.wsList.count({ where: { projectId, archivedAt: null } })).toBe(7);

  // An empty list can be removed.
  const empty = page.getByRole("region", { name: /^Testing/ });
  await empty.getByLabel("Settings of list Testing").click();
  await empty.getByRole("button", { name: "Remove this list" }).click();
  await expect.poll(() => db.wsList.count({ where: { projectId, archivedAt: null } })).toBe(6);

  // The member has no list controls.
  const t = await browser.newPage();
  await signIn(t, "tech");
  await t.goto(`/worksync/${projectId}`);
  await expect(t.getByRole("button", { name: "+ Add another list" })).toHaveCount(0);
  await expect(t.getByLabel(/^Settings of list/)).toHaveCount(0);
});
