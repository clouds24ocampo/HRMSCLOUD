import { describe, expect, it } from "vitest";
import { roleArt } from "./role-art";
import { KNOWLEDGE_BANK } from "./exam-bank";

describe("roleArt", () => {
  it("gives every starter position its own picture", () => {
    const icons = new Set<string>();
    for (const title of Object.keys(KNOWLEDGE_BANK)) {
      const a = roleArt(title);
      expect(a.from, title).toMatch(/^#/);
      expect(a.caption.length, title).toBeGreaterThan(5);
      icons.add(`${a.icon}|${a.from}`);
    }
    expect(icons.size).toBe(Object.keys(KNOWLEDGE_BANK).length); // no two positions share the same picture
  });
  it("matches a position HR adds later by the words in its title", () => {
    expect(roleArt("Senior Cloud Architect").icon).toBe("cloud");
    expect(roleArt("Wireless Network Technician").icon).toBe("network");
    expect(roleArt("Security Operations Lead").icon).toBe("shield");
    expect(roleArt("Receptionist").icon).toBe("briefcase"); // nothing matches: a neutral picture
  });
});
