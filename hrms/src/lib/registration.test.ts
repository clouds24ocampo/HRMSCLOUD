import { afterEach, describe, expect, it, vi } from "vitest";

const count = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { organization: { count } } }));

async function load(multi: string | undefined) {
  vi.resetModules();
  if (multi === undefined) delete process.env.ALLOW_MULTIPLE_ORGS;
  else process.env.ALLOW_MULTIPLE_ORGS = multi;
  return (await import("./registration")).registrationOpen;
}

afterEach(() => {
  delete process.env.ALLOW_MULTIPLE_ORGS;
  count.mockReset();
});

describe("registrationOpen", () => {
  it("is open while no company exists", async () => {
    count.mockResolvedValue(0);
    expect(await (await load(undefined))()).toBe(true);
  });
  it("closes once a company is registered", async () => {
    count.mockResolvedValue(1);
    expect(await (await load(undefined))()).toBe(false);
  });
  it("stays open with ALLOW_MULTIPLE_ORGS=true (tests only)", async () => {
    count.mockResolvedValue(5);
    expect(await (await load("true"))()).toBe(true);
  });
});
