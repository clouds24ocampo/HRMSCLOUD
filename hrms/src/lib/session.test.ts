import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "./db-client";
import { createSession, deleteOtherSessions, deleteSession, findSession, getPunchUnlock, setPunchUnlock } from "./session";
import { ROLES } from "./roles";

const email = `test-${Date.now()}@example.test`;
let userId = "";
let orgId = "";

beforeAll(async () => {
  const role = await db.role.upsert({
    where: { key: ROLES.EMPLOYEE },
    update: {},
    create: { key: ROLES.EMPLOYEE, name: "Employee" },
  });
  orgId = (await db.organization.create({ data: { name: "T", categoryKey: "bpo-it", industryKey: "bpo", sizeKey: "small" } })).id;
  userId = (await db.user.create({ data: { organizationId: orgId, email, name: "T", passwordHash: "x", roleId: role.id } })).id;
});
afterAll(async () => {
  await db.user.delete({ where: { id: userId } }); // sessions cascade
  await db.organization.delete({ where: { id: orgId } });
  await db.$disconnect();
});

describe("sessions", () => {
  it("finds a valid session, then not after logout", async () => {
    const { token } = await createSession(userId);
    expect((await findSession(token))?.id).toBe(userId);
    await deleteSession(token);
    expect(await findSession(token)).toBeNull();
  });
  it("rejects an expired session", async () => {
    const { token } = await createSession(userId);
    await db.session.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await findSession(token)).toBeNull();
  });
  it("rejects a disabled user and a garbage token", async () => {
    const { token } = await createSession(userId);
    await db.user.update({ where: { id: userId }, data: { active: false } });
    expect(await findSession(token)).toBeNull();
    await db.user.update({ where: { id: userId }, data: { active: true } });
    expect(await findSession("garbage")).toBeNull();
  });
  it("password change keeps this device and signs out the others", async () => {
    const mine = await createSession(userId);
    const other = await createSession(userId);
    await deleteOtherSessions(userId, mine.token);
    expect((await findSession(mine.token))?.id).toBe(userId);
    expect(await findSession(other.token)).toBeNull();
  });
  it("the punch password unlock is stored on the session and can be cleared", async () => {
    const { token } = await createSession(userId);
    expect(await getPunchUnlock(token)).toBeNull();
    const until = new Date(Date.now() + 120_000);
    await setPunchUnlock(token, until);
    expect((await getPunchUnlock(token))?.getTime()).toBe(until.getTime());
    await setPunchUnlock(token, null);
    expect(await getPunchUnlock(token)).toBeNull();
    expect(await getPunchUnlock("garbage")).toBeNull();
  });
});
