import { describe, expect, it } from "vitest";
import { PDS_SECTIONS } from "./pds-config";
import { emptyPds, pdsAddress, pdsCompletion, pdsGovNumbers, pdsProblems, requiredItems, sanitizePds, validatePds, type PdsData, type RowsData } from "./pds";

// A sheet filled with everything the form asks for.
function full(): PdsData {
  const d = emptyPds({ email: "juan@example.com", name: "Juan Dela Cruz", mobile: "09171234567" });
  Object.assign(d.personal, { middleName: "Santos", birthDate: "1998-04-12", birthPlace: "Quezon City, Metro Manila", sex: "Male", civilStatus: "Single", citizenship: "Filipino" });
  Object.assign(d.address, { resHouse: "12 Mabini St", resBarangay: "Poblacion", resCity: "Makati", resProvince: "Metro Manila", resZip: "1200", permSame: "Yes" });
  Object.assign(d.govIds, { sss: "34-1234567-8", philhealth: "12-345678901-2", pagibig: "1234-5678-9012", tin: "123-456-789" });
  Object.assign(d.family, { motherSurname: "Reyes", motherFirst: "Maria" });
  (d.children as RowsData).none = true; (d.dependents as RowsData).none = true; (d.eligibility as RowsData).none = true; (d.work as RowsData).none = true; (d.trainings as RowsData).none = true;
  (d.education as RowsData).rows = [{ level: "College (Bachelor's)", school: "PUP", course: "BS IT", from: "2016", to: "2020", units: "", graduated: "2020", honors: "" }];
  Object.assign(d.skills, { skills: "TypeScript, PostgreSQL, Linux" });
  Object.assign(d.other, { relatedInCompany: "No", dismissed: "No", convicted: "No", willingShifts: "Yes", willingRelocate: "Yes", expectedSalary: "PHP 30,000", availableStart: "2026-12-01", source: "Careers page" });
  (d.references as RowsData).rows = [
    { fullName: "Ana Lim", relationship: "Former supervisor", company: "", address: "", contact: "09181234567", email: "" },
    { fullName: "Ben Tan", relationship: "Professor", company: "", address: "", contact: "09191234567", email: "" },
  ];
  Object.assign(d.emergency, { name: "Maria Dela Cruz", relationship: "Parent", mobile: "09201234567", address: "12 Mabini St, Makati" });
  Object.assign(d.declaration, { certify: "Yes", consent: "Yes", signedName: "Juan Dela Cruz" });
  return d;
}

describe("the questions", () => {
  it("cover every part of a personal data sheet", () => {
    const titles = PDS_SECTIONS.map((s) => s.title.replace(/^\d+\.\s*/, ""));
    for (const need of ["Personal information", "Contact details and official social media", "Addresses", "Government numbers and IDs", "Family background", "Children", "Educational background", "Licenses and eligibility", "Work experience", "Trainings and seminars", "Skills, achievements and activities", "Other information", "Character references", "Person to contact in an emergency", "Declaration and data privacy consent"]) expect(titles).toContain(need);
  });
  it("ask for email, mobile and the official social media links", () => {
    const contact = PDS_SECTIONS.find((s) => s.key === "contact")!;
    const keys = contact.kind === "fields" ? contact.fields.map((f) => f.key) : [];
    for (const k of ["email", "mobile", "facebook", "linkedin", "instagram", "twitter", "tiktok", "github", "website"]) expect(keys).toContain(k);
  });
  it("have unique keys inside each section", () => {
    for (const s of PDS_SECTIONS) {
      const keys = s.kind === "fields" ? s.fields.map((f) => f.key) : s.columns.map((c) => c.key);
      expect(new Set(keys).size, s.key).toBe(keys.length);
    }
    expect(new Set(PDS_SECTIONS.map((s) => s.key)).size).toBe(PDS_SECTIONS.length);
  });
});

describe("completion", () => {
  it("an empty sheet is mostly missing, with prefilled name, email and mobile counted", () => {
    const c = pdsCompletion(emptyPds({ email: "a@b.co", name: "Juan Cruz", mobile: "09171234567" }));
    expect(c.pct).toBeGreaterThan(0);
    expect(c.pct).toBeLessThan(25);
    expect(c.missing.length).toBeGreaterThan(30);
  });
  it("a fully filled sheet is 100% and valid", () => {
    const v = validatePds(full(), "submit");
    expect(v.missing).toEqual([]);
    expect(v.problems).toEqual([]);
    expect(v.pct).toBe(100);
    expect(v.ok).toBe(true);
  });
  it("a draft can always be saved, a submit needs everything", () => {
    expect(validatePds(emptyPds(), "draft").ok).toBe(true);
    expect(validatePds(emptyPds(), "submit").ok).toBe(false);
  });
  it("names exactly what is missing", () => {
    const d = full(); (d.personal as Record<string, string>).birthPlace = ""; (d.emergency as Record<string, string>).mobile = "";
    const m = validatePds(d, "submit").missing.map((x) => `${x.section}: ${x.label}`);
    expect(m).toEqual(["Personal information: Place of birth", "Person to contact in an emergency: Mobile number"]);
  });
  it("shows the permanent address questions only when it differs from the present one", () => {
    const d = full(); (d.address as Record<string, string>).permSame = "";
    expect(requiredItems(d).filter((i) => i.section === "Addresses" && !i.done).length).toBe(5);
    (d.address as Record<string, string>).permSame = "Yes";
    expect(requiredItems(d).filter((i) => i.section === "Addresses").length).toBe(5); // the five present-address answers
  });
  it("government numbers are optional once 'I do not have all of these yet' is ticked", () => {
    const d = full(); Object.assign(d.govIds, { sss: "", philhealth: "", pagibig: "", tin: "" });
    expect(validatePds(d, "submit").missing.length).toBe(4);
    (d.govIds as Record<string, string>).noneYet = "Yes";
    expect(validatePds(d, "submit").ok).toBe(true);
  });
  it("a Yes answer needs its details", () => {
    const d = full(); (d.other as Record<string, string>).convicted = "Yes";
    expect(validatePds(d, "submit").missing.map((m) => m.label)).toContain("Please explain");
    (d.other as Record<string, string>).convictedDetails = "Case dismissed in 2020";
    expect(validatePds(d, "submit").ok).toBe(true);
  });
  it("needs a work history or the 'no experience' box, and two references", () => {
    const d = full(); (d.work as RowsData).none = false;
    expect(validatePds(d, "submit").missing.some((m) => m.section === "Work experience")).toBe(true);
    (d.work as RowsData).rows = [{ company: "Acme", position: "Dev", from: "2021-01-01", to: "", status: "", salary: "", address: "", supervisor: "", contact: "", reason: "" }];
    expect(validatePds(d, "submit").ok).toBe(true);
    (d.references as RowsData).rows.pop();
    expect(validatePds(d, "submit").ok).toBe(false);
  });
});

describe("cleaning what the browser sends", () => {
  it("keeps only http(s) links and adds https to a bare address", () => {
    const d = sanitizePds({ contact: { facebook: "facebook.com/juan", linkedin: "javascript:alert(1)", github: "data:text/html,<script>", website: "http://juan.dev/page", instagram: "https://x.com/a b" } });
    const c = d.contact as Record<string, string>;
    expect(c.facebook).toBe("https://facebook.com/juan");
    expect(c.linkedin).toBe("");
    expect(c.github).toBe("");
    expect(c.website).toBe("http://juan.dev/page");
    expect(c.instagram).toBe("");
  });
  it("cuts long text, drops control characters, rejects bad dates and unknown choices, ignores unknown fields", () => {
    const d = sanitizePds({ personal: { surname: "A".repeat(500), firstName: "Jo\u0000hn", birthDate: "12/04/1998", sex: "Robot", evil: "x" }, nope: { a: 1 } });
    const p = d.personal as Record<string, string>;
    expect(p.surname.length).toBe(60);
    expect(p.firstName).toBe("John");
    expect(p.birthDate).toBe("");
    expect(p.sex).toBe("");
    expect("evil" in p).toBe(false);
    expect("nope" in d).toBe(false);
  });
  it("limits the number of rows and drops empty ones", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ fullName: i % 2 ? "" : `Child ${i}`, birthDate: "" }));
    const d = sanitizePds({ children: { rows } });
    expect((d.children as RowsData).rows.length).toBeLessThanOrEqual(12);
    expect((d.children as RowsData).rows.every((r) => r.fullName)).toBe(true);
  });
  it("survives garbage input", () => {
    for (const raw of [null, undefined, 5, "x", [], { personal: "x", work: { rows: "x" } }]) expect(() => sanitizePds(raw)).not.toThrow();
  });
  it("only accepts 'none' for sections that have it", () => {
    const d = sanitizePds({ education: { none: true, rows: [] }, work: { none: true } });
    expect((d.education as RowsData).none).toBe(false);
    expect((d.work as RowsData).none).toBe(true);
  });
});

describe("answers that are wrong", () => {
  it("checks email, mobile, date of birth, government numbers and date order", () => {
    const d = full();
    (d.contact as Record<string, string>).email = "not-an-email"; (d.contact as Record<string, string>).mobile = "0917";
    (d.personal as Record<string, string>).birthDate = "2026-01-01"; (d.govIds as Record<string, string>).sss = "123";
    (d.education as RowsData).rows[0].to = "2010";
    const p = pdsProblems(d, new Date("2026-11-21T00:00:00Z")).join(" | ");
    expect(p).toContain("Email address is not a valid email");
    expect(p).toContain("mobile number needs at least 10 digits");
    expect(p).toContain("at least 15 years old");
    expect(p).toContain("SSS #");
    expect(p).toContain("cannot be before");
  });
});

describe("what the rest of the system takes from it", () => {
  it("makes the address and the formatted government numbers", () => {
    const d = full();
    expect(pdsAddress(d)).toBe("12 Mabini St, Poblacion, Makati, Metro Manila, 1200");
    expect(pdsGovNumbers(d)).toEqual({ sss: "34-1234567-8", philhealth: "12-345678901-2", tin: "123-456-789", pagibig: "1234-5678-9012" });
  });
});

describe("the printable copy", () => {
  it("is a real PDF with every section on it, and survives characters the PDF fonts do not know", async () => {
    const { buildPdsPdf } = await import("./pds-pdf");
    const d = full();
    (d.personal as Record<string, string>).religion = "Pagkakaisa 😀 日本";
    const pdf = await buildPdsPdf(d, { company: "Quantum Cloud Corporation", applicantNo: "20261121-0001", name: "Juan Dela Cruz", submittedOn: "2026-11-21" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(3000);
    expect(pdf.toString("latin1")).toContain("/Count");
  });
});
