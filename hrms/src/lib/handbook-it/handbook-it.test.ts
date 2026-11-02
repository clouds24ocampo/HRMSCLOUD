import { describe, expect, it } from "vitest";
import { IT_HANDBOOK, fill } from "./index";

const all = IT_HANDBOOK.map((c) => c.content).join(String.fromCharCode(10));

describe("IT company handbook", () => {
  it("has numbered chapters in order, each with a unique slug and real content", () => {
    expect(IT_HANDBOOK.length).toBeGreaterThanOrEqual(30);
    expect(new Set(IT_HANDBOOK.map((c) => c.slug)).size).toBe(IT_HANDBOOK.length);
    IT_HANDBOOK.forEach((c, i) => {
      expect(c.sortOrder).toBe(i + 1);
      expect(c.content.length, c.slug).toBeGreaterThan(600);
      if (i < 30) expect(c.title.startsWith(`${i + 1}. `), c.title).toBe(true);
    });
  });
  it("covers the business lines of an IT company", () => {
    for (const w of ["software", "hardware", "cloud", "server", "network", "Wi-Fi", "digital security"]) expect(all.toLowerCase(), w).toContain(w.toLowerCase());
  });
  it("cites the Philippine laws the company asked for", () => {
    for (const law of ["RA 10173", "RA 10175", "Labor Code", "RA 11232", "RA 11058", "RA 8293", "RA 11313", "RA 11165", "RA 11210", "RA 4200", "RA 8792", "Presidential Decree 851", "NPC Circular 16-03", "seventy-two (72) hours", "Article 297", "Revised Penal Code", "DOLE"]) expect(all, law).toContain(law);
  });
  it("protects the company: ownership, confidentiality, authority, monitoring, remedies, survival", () => {
    for (const k of ["Work Product", "Confidential Information", "trade secret", "authorized signator", "no expectation of privacy", "Reservation of rights", "litigation hold", "injunction", "continue after"]) expect(all.toLowerCase(), k).toContain(k.toLowerCase());
  });
  it("keeps the employee's legal rights in place (due process, law prevails)", () => {
    for (const k of ["Notice to Explain", "twin-notice", "law or the more favorable", "Preventive suspension", "Single Entry Approach"]) expect(all, k).toContain(k);
  });
  it("uses the company-name token only where it is replaced", () => {
    expect(fill("Welcome to {{COMPANY}}.", "Acme Corp")).toBe("Welcome to Acme Corp.");
    expect(fill(all, "Acme Corp")).not.toContain("{{");
  });
});
