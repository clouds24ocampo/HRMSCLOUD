// Philippine government numbers shown on the back of the ID: format, check and mask. Pure, so it is tested.
export const GOV_KINDS = ["sss", "philhealth", "tin", "pagibig"] as const;
export type GovKind = (typeof GOV_KINDS)[number];
export const GOV_LABEL: Record<GovKind, string> = { sss: "SSS #", philhealth: "PhilHealth #", tin: "TIN #", pagibig: "Pag-IBIG #" };

// Digits allowed per number, and how it is written with dashes.
const SHAPE: Record<GovKind, { lengths: number[]; groups: Record<number, number[]> }> = {
  sss: { lengths: [10], groups: { 10: [2, 7, 1] } }, // 34-1234567-8
  philhealth: { lengths: [12], groups: { 12: [2, 9, 1] } }, // 12-345678901-2
  tin: { lengths: [9, 12], groups: { 9: [3, 3, 3], 12: [3, 3, 3, 3] } }, // 123-456-789 or 123-456-789-000
  pagibig: { lengths: [12], groups: { 12: [4, 4, 4] } }, // 1234-5678-9012
};

const digitsOf = (s: string) => s.replace(/\D/g, "");

function dashed(kind: GovKind, digits: string): string {
  let i = 0;
  return SHAPE[kind].groups[digits.length].map((n) => digits.slice(i, (i += n))).join("-");
}

// Reads what a person typed. Empty clears the number. Spaces and dashes are ignored; anything else must be a digit.
export function parseGovId(kind: GovKind, raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };
  if (/[^\d\s-]/.test(text)) return { ok: false, error: `${GOV_LABEL[kind]} may contain only numbers and dashes.` };
  const d = digitsOf(text);
  if (!SHAPE[kind].lengths.includes(d.length)) return { ok: false, error: `${GOV_LABEL[kind]} needs ${SHAPE[kind].lengths.join(" or ")} digits (you typed ${d.length}).` };
  return { ok: true, value: dashed(kind, d) };
}

// Shows all but the last three digits as dots, keeping the dashes: "34-1234567-8" -> "••-••••567-8" style, never the whole number.
export function maskGovId(value: string | null | undefined): string | null {
  if (!value) return null;
  const total = digitsOf(value).length;
  let seen = 0;
  return value.replace(/\d/g, (c) => (++seen > total - 3 ? c : "•"));
}
