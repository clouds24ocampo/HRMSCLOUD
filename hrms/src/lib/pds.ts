// Personal Data Sheet rules: clean what the browser sends, count what is still missing, and check the answers. Pure, so it is tested.
// Questions live in pds-config.ts. Everything here reads that list.
import { GOV_LABEL, parseGovId, type GovKind } from "@/lib/gov-ids";
import { PDS_SECTIONS, type Cond, type Field, type FieldsSection, type RowsSection, type Section } from "@/lib/pds-config";

export type Row = Record<string, string>;
export type FieldsData = Record<string, string>;
export type RowsData = { none: boolean; rows: Row[] };
export type PdsData = Record<string, FieldsData | RowsData>;
export type Missing = { section: string; label: string };

const plain = (t: string) => t.replace(/^\d+\.\s*/, "");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRows = (s: Section): s is RowsSection => s.kind === "rows";
const fieldsOf = (d: PdsData, key: string): FieldsData => (d[key] as FieldsData | undefined) ?? {};
const rowsOf = (d: PdsData, key: string): RowsData => (d[key] as RowsData | undefined) ?? { none: false, rows: [] };

export function cond(c: Cond | undefined, values: Record<string, string>) {
  if (!c) return true;
  const v = values[c.key] ?? "";
  if (c.is !== undefined) return v === c.is;
  if (c.not !== undefined) return v !== c.not;
  return true;
}
export const isFilled = (f: Field, v: string | undefined) => (f.type === "check" ? v === "Yes" : (v ?? "").trim() !== "");
export const fieldRequired = (f: Field, values: Record<string, string>) => (f.requiredIf ? cond(f.requiredIf, values) : !!f.required) && cond(f.showIf, values);

export function emptyPds(prefill: { email?: string; name?: string; mobile?: string } = {}): PdsData {
  const d: PdsData = {};
  for (const s of PDS_SECTIONS) d[s.key] = isRows(s) ? { none: false, rows: [] } : Object.fromEntries(s.fields.map((f) => [f.key, ""]));
  const personal = d.personal as FieldsData, contact = d.contact as FieldsData;
  personal.citizenship = "Filipino";
  const parts = (prefill.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) { personal.firstName = parts.slice(0, -1).join(" "); personal.surname = parts[parts.length - 1]; } else if (parts.length === 1) personal.firstName = parts[0];
  contact.email = prefill.email ?? "";
  contact.mobile = prefill.mobile ?? "";
  return d;
}

// ---- cleaning: whatever the browser sends is cut to size, so stored data is always small, plain text
function cleanValue(f: Field, raw: unknown): string {
  let v = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
  v = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  const max = f.max ?? (f.type === "textarea" ? 800 : 160);
  switch (f.type) {
    case "check": return v === "Yes" || raw === true ? "Yes" : "";
    case "date": return DATE.test(v) && !Number.isNaN(Date.parse(v)) ? v : "";
    case "number": return v.replace(/\D/g, "").slice(0, max);
    case "select": return f.options?.includes(v) ? v : "";
    case "tel": return v.replace(/[^\d+()\-\s]/g, "").slice(0, max);
    case "email": return v.toLowerCase().slice(0, max);
    case "url": {
      if (!v) return "";
      const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
      return /^https?:\/\/[^\s<>"']+$/i.test(withScheme) ? withScheme.slice(0, max) : ""; // only http(s) links: never javascript: or data:
    }
    case "textarea": return v.slice(0, max);
    default: return v.replace(/\s+/g, " ").slice(0, max);
  }
}

export function sanitizePds(raw: unknown): PdsData {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: PdsData = {};
  for (const s of PDS_SECTIONS) {
    const part = src[s.key] && typeof src[s.key] === "object" ? (src[s.key] as Record<string, unknown>) : {};
    if (isRows(s)) {
      const list = Array.isArray(part.rows) ? part.rows.slice(0, s.max) : [];
      const rows = list
        .map((r) => Object.fromEntries(s.columns.map((c) => [c.key, cleanValue(c, (r as Record<string, unknown> | null)?.[c.key])])))
        .filter((r) => Object.values(r).some((v) => v !== ""));
      out[s.key] = { none: !!s.none && (part.none === true || part.none === "Yes"), rows };
    } else {
      out[s.key] = Object.fromEntries(s.fields.map((f) => [f.key, cleanValue(f, part[f.key])]));
    }
  }
  return out;
}

// ---- what is still missing
export function requiredItems(d: PdsData): (Missing & { done: boolean })[] {
  const items: (Missing & { done: boolean })[] = [];
  for (const s of PDS_SECTIONS) {
    const title = plain(s.title);
    if (!isRows(s)) {
      const v = fieldsOf(d, s.key);
      for (const f of s.fields) if (fieldRequired(f, v)) items.push({ section: title, label: f.label.length > 60 ? `${f.label.slice(0, 57)}...` : f.label, done: isFilled(f, v[f.key]) });
      continue;
    }
    const { none, rows } = rowsOf(d, s.key);
    if (s.min > 0) {
      for (let i = 0; i < s.min; i++) for (const c of s.columns) if (c.required) items.push({ section: title, label: `${s.rowLabel} ${i + 1}: ${c.label}`, done: isFilled(c, rows[i]?.[c.key]) });
    } else if (s.none) {
      items.push({ section: title, label: `Add at least one, or tick "${s.none}"`, done: none || rows.length > 0 });
    }
  }
  return items;
}

export function pdsCompletion(d: PdsData) {
  const items = requiredItems(d);
  const done = items.filter((i) => i.done).length;
  return { pct: items.length ? Math.round((done / items.length) * 100) : 100, done, total: items.length, missing: items.filter((i) => !i.done).map(({ section, label }) => ({ section, label })) };
}

// ---- answers that are filled but wrong
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function pdsProblems(d: PdsData, today = new Date()): string[] {
  const out: string[] = [];
  for (const s of PDS_SECTIONS) {
    const title = plain(s.title);
    if (isRows(s)) {
      const { rows } = rowsOf(d, s.key);
      rows.forEach((r, i) => {
        for (const c of s.columns) if (c.required && !isFilled(c, r[c.key])) out.push(`${title}, ${s.rowLabel.toLowerCase()} ${i + 1}: ${c.label} is needed.`);
        for (const c of s.columns) if (c.type === "email" && r[c.key] && !EMAIL.test(r[c.key])) out.push(`${title}, ${s.rowLabel.toLowerCase()} ${i + 1}: ${c.label} is not a valid email.`);
      });
      continue;
    }
    const v = fieldsOf(d, s.key);
    for (const f of (s as FieldsSection).fields) if (f.type === "email" && v[f.key] && !EMAIL.test(v[f.key])) out.push(`${title}: ${f.label} is not a valid email.`);
  }
  const p = fieldsOf(d, "personal"), c = fieldsOf(d, "contact"), g = fieldsOf(d, "govIds");
  if (p.birthDate) {
    const b = new Date(`${p.birthDate}T00:00:00Z`);
    const years = (today.getTime() - b.getTime()) / 31_557_600_000;
    if (years < 15) out.push("Personal information: check your date of birth (you must be at least 15 years old).");
    else if (years > 90) out.push("Personal information: check your date of birth.");
  }
  if (c.mobile && c.mobile.replace(/\D/g, "").length < 10) out.push("Contact details: the mobile number needs at least 10 digits.");
  for (const kind of ["sss", "philhealth", "tin", "pagibig"] as GovKind[]) {
    const r = parseGovId(kind, g[kind] ?? "");
    if (!r.ok) out.push(`Government numbers: ${r.error}`);
  }
  if (g.driversLicense === "" && g.driversExpiry) out.push("Government numbers: you gave a driver's license expiry but no number.");
  const edu = rowsOf(d, "education").rows;
  for (const [i, r] of edu.entries()) if (r.from && r.to && Number(r.to) < Number(r.from)) out.push(`Educational background, school ${i + 1}: "To" cannot be before "From".`);
  for (const [i, r] of rowsOf(d, "work").rows.entries()) if (r.from && r.to && r.to < r.from) out.push(`Work experience, job ${i + 1}: "To" cannot be before "From".`);
  return out;
}

export function validatePds(d: PdsData, mode: "draft" | "submit") {
  const c = pdsCompletion(d);
  const problems = pdsProblems(d);
  return { ...c, problems, ok: mode === "draft" ? true : c.missing.length === 0 && problems.length === 0 };
}

// ---- values other parts of the system use at hire
export const pdsAddress = (d: PdsData) => {
  const a = fieldsOf(d, "address");
  return [a.resHouse, a.resStreet, a.resSubdivision, a.resBarangay, a.resCity, a.resProvince, a.resZip].filter(Boolean).join(", ");
};
export function pdsGovNumbers(d: PdsData): Partial<Record<GovKind, string>> {
  const g = fieldsOf(d, "govIds");
  const out: Partial<Record<GovKind, string>> = {};
  for (const k of ["sss", "philhealth", "tin", "pagibig"] as GovKind[]) { const r = parseGovId(k, g[k] ?? ""); if (r.ok && r.value) out[k] = r.value; }
  return out;
}
export const GOV_NAMES = GOV_LABEL;
export const pdsBirthDate = (d: PdsData) => fieldsOf(d, "personal").birthDate || null;
export const pdsMobile = (d: PdsData) => fieldsOf(d, "contact").mobile || null;
export const pdsSignature = (d: PdsData) => fieldsOf(d, "declaration").signedName || null;
export { PDS_SECTIONS };
