import { describe, expect, it } from "vitest";
import { buildDtrPdf } from "./dtr-pdf";
import type { DtrReport, ReportDay, ReportPerson } from "./dtr-report";

const at = (hm: string) => new Date(`2026-10-12T${hm}:00+08:00`);
const day = (d: string, o: Partial<ReportDay> = {}): ReportDay => ({ day: d, status: "PRESENT", timeIn: at("08:00"), timeOut: at("17:00"), breakMinutes: 60, issueMinutes: 0, paidMinutes: 480, lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, flags: [], wageCents: 95_847, ...o });
const person = (n: string, days: ReportDay[]): ReportPerson => ({
  id: n, employeeNo: `E-${n}`, name: `${n}, Test`, department: "Operations", hourlyCents: 11_980.83, dailyCents: 95_846.64, days,
  totals: { daysWorked: days.length, absentDays: 0, breakMinutes: 0, issueMinutes: 0, paidMinutes: days.reduce((a, d) => a + d.paidMinutes, 0), lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, wageCents: days.reduce((a, d) => a + (d.wageCents ?? 0), 0) },
});
const report = (people: ReportPerson[], wages = true): DtrReport => ({ organization: "Acme Corp", from: "2026-10-01", to: "2026-10-15", timezone: "Asia/Manila", wages, people, grandWageCents: wages ? people.reduce((a, p) => a + (p.totals.wageCents ?? 0), 0) : null, generatedAt: new Date("2026-10-16T01:00:00Z") });

// Standard-font PDFs store text as hex strings: decode them all to read what was written.
const text = (pdf: Buffer) => [...pdf.toString("latin1").matchAll(/<([0-9a-fA-F]{4,})>/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1")).join(" ");

describe("DTR PDF", () => {
  it("is a real PDF with every person, each day's wage and the totals", async () => {
    const pdf = await buildDtrPdf(report([
      person("Cruz", [day("2026-10-12"), day("2026-10-13", { paidMinutes: 420, wageCents: 83_866, flags: ["Late 15m"] })]),
      person("Reyes", [day("2026-10-12", { status: "ABSENT", timeIn: null, timeOut: null, paidMinutes: 0, wageCents: 0, flags: ["Absent"] })]),
    ]), { compress: false });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const t = text(pdf);
    for (const s of ["Acme Corp", "Cruz, Test", "Reyes, Test", "Daily wage", "PHP 958.47", "PHP 838.66", "Absent", "TOTAL"]) expect(t, s).toContain(s);
    expect(t).toContain("PHP 1,797.13"); // Cruz's total: 958.47 + 838.66
    expect(t).toContain("Total daily wages, all 2 employees: PHP 1,797.13");
  });

  it("leaves pay out entirely on a copy without wages", async () => {
    const pdf = await buildDtrPdf(report([person("Cruz", [day("2026-10-12", { wageCents: null })])], false), { compress: false });
    const t = text(pdf);
    expect(t).toContain("Pay is not shown on this copy.");
    expect(t).not.toContain("PHP");
    expect(t).not.toContain("Daily wage");
  });

  it("starts new pages for a long list and numbers them", async () => {
    const days = Array.from({ length: 70 }, (_, i) => day(`2026-10-${String((i % 28) + 1).padStart(2, "0")}`));
    const pdf = await buildDtrPdf(report([person("Cruz", days)]), { compress: false });
    expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(2);
    expect(text(pdf)).toMatch(/Page 1 of \d+/);
    expect(text(pdf)).toContain("(continued)");
  });

  it("replaces characters the PDF font cannot draw instead of printing garbage", async () => {
    const pdf = await buildDtrPdf(report([person("Ñandú 🌧", [day("2026-10-12")])]), { compress: false });
    expect(text(pdf)).toContain("?");
  });
});
