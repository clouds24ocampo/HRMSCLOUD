import { describe, expect, it } from "vitest";
import { isDbDown } from "./db-health";

describe("isDbDown", () => {
  it("recognizes a refused connection, even when wrapped", () => {
    expect(isDbDown(Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:3366"), { code: "ECONNREFUSED" }))).toBe(true);
    expect(isDbDown(new Error("outer", { cause: Object.assign(new Error("inner"), { code: "ECONNREFUSED" }) }))).toBe(true);
  });
  it("recognizes Prisma's own wording", () => {
    expect(isDbDown(Object.assign(new Error("x"), { code: "P1001" }))).toBe(true);
    expect(isDbDown(Object.assign(new Error("x"), { name: "PrismaClientInitializationError" }))).toBe(true);
    expect(isDbDown(new Error("Can't reach database server at localhost:3366"))).toBe(true);
  });
  it("does not hide real bugs", () => {
    expect(isDbDown(new Error("Unique constraint failed on the fields: (`email`)"))).toBe(false);
    expect(isDbDown(Object.assign(new Error("x"), { code: "P2002" }))).toBe(false);
    expect(isDbDown(undefined)).toBe(false);
    expect(isDbDown("string")).toBe(false);
  });
  it("survives a circular cause chain", () => {
    const a: { cause?: unknown } = {};
    a.cause = a;
    expect(isDbDown(a)).toBe(false);
  });
});
