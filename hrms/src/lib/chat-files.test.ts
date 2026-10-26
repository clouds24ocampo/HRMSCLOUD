import { describe, expect, it } from "vitest";
import { sniffChatFile } from "./chat-files";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

describe("sniffChatFile", () => {
  it("recognises pictures by their bytes, whatever the name says", () => {
    expect(sniffChatFile(png, "holiday.exe")).toEqual({ mime: "image/png", image: true });
  });
  it("accepts office files only with a zip signature, and text only without NUL bytes", () => {
    expect(sniffChatFile(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1]), "plan.xlsx")?.image).toBe(false);
    expect(sniffChatFile(Uint8Array.from([1, 2, 3, 4]), "plan.xlsx")).toBeNull();
    expect(sniffChatFile(new TextEncoder().encode("a,b\n1,2"), "data.csv")?.mime).toBe("text/csv");
    expect(sniffChatFile(Uint8Array.from([97, 0, 98]), "data.csv")).toBeNull();
  });
  it("rejects anything else", () => {
    expect(sniffChatFile(new TextEncoder().encode("<script>"), "x.html")).toBeNull();
  });
});
