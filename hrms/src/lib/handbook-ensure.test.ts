import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { DEFAULT_HANDBOOK_SECTIONS, ensureHandbook } from "./handbook";

const stamp = Date.now();
const made: string[] = [];
async function org(categoryKey: string) {
  const o = await prisma.organization.create({ data: { name: `ZZ Handbook ${stamp} ${categoryKey}`, categoryKey, industryKey: "x", sizeKey: "small" } });
  made.push(o.id);
  return o;
}
afterAll(async () => {
  await prisma.handbookSection.deleteMany({ where: { organizationId: { in: made } } });
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: made } } });
  await prisma.organization.deleteMany({ where: { id: { in: made } } });
});

describe("the handbook an organization starts with", () => {
  it("an IT company gets the full IT handbook by itself, and asking again changes nothing", async () => {
    const o = await org("bpo-it");
    await ensureHandbook(o.id, o.name, o.categoryKey);
    const first = await prisma.handbookSection.findMany({ where: { organizationId: o.id }, select: { slug: true, version: true } });
    expect(first.length).toBeGreaterThan(20);
    expect(first.some((s) => s.slug === "welcome-and-purpose")).toBe(true);
    await ensureHandbook(o.id, o.name, o.categoryKey);
    const again = await prisma.handbookSection.findMany({ where: { organizationId: o.id }, select: { slug: true, version: true } });
    expect(again.length).toBe(first.length);
  });
  it("an IT company that only has the generic starter chapters is upgraded; their own chapters are never replaced", async () => {
    const o = await org("bpo-it");
    await ensureHandbook(o.id, o.name); // no category: the generic starter chapters
    expect(await prisma.handbookSection.count({ where: { organizationId: o.id } })).toBe(DEFAULT_HANDBOOK_SECTIONS.length);
    await ensureHandbook(o.id, o.name, o.categoryKey);
    expect(await prisma.handbookSection.count({ where: { organizationId: o.id } })).toBeGreaterThan(20);
    await prisma.handbookSection.create({ data: { organizationId: o.id, slug: "our-own", title: "Our own chapter", content: "x", sortOrder: 99 } });
    const before = await prisma.handbookSection.count({ where: { organizationId: o.id } });
    await ensureHandbook(o.id, o.name, o.categoryKey);
    expect(await prisma.handbookSection.count({ where: { organizationId: o.id } })).toBe(before);
  });
  it("other kinds of organization keep the generic starter chapters", async () => {
    const o = await org("retail-hospitality");
    await ensureHandbook(o.id, o.name, o.categoryKey);
    expect(await prisma.handbookSection.count({ where: { organizationId: o.id } })).toBe(DEFAULT_HANDBOOK_SECTIONS.length);
  });
});
