import { describe, expect, it } from "vitest";
import { readStored, safeName, sniffType } from "./documents";

const bytes = (...n: number[]) => new Uint8Array(n);

describe("sniffType", () => {
  it("recognizes PDF, PNG and JPEG by content", () => {
    expect(sniffType(new TextEncoder().encode("%PDF-1.7 rest"))?.ext).toBe("pdf");
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))?.mime).toBe("image/png");
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
  });
  it("refuses anything else, whatever the file is called", () => {
    expect(sniffType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffType(new TextEncoder().encode("MZ\x90\x00 an exe"))).toBeNull();
    expect(sniffType(bytes())).toBeNull();
  });
});

describe("safeName", () => {
  it("removes anything that could break a header or a path", () => {
    expect(safeName('../../etc/passwd"\r\nX: y')).not.toMatch(/[\r\n"/\\]/);
    expect(safeName("")).toBe("document");
    expect(safeName("My ID (front).pdf")).toBe("My ID (front).pdf");
  });
});

describe("readStored", () => {
  it("rejects keys outside the organization or with path tricks", async () => {
    expect(await readStored("org1/../../secret", "org1")).toBeNull();
    expect(await readStored("org2/11111111-1111-1111-1111-111111111111", "org1")).toBeNull();
    expect(await readStored("..\\x", "org1")).toBeNull();
  });
});
