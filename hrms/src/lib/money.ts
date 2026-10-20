// Money is always whole centavos in the database and in calculations. Only the screen shows pesos.
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/lib/locale";

export { DEFAULT_CURRENCY };

export function formatMoney(cents: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

// "1,234.50" -> 123450. Returns null for anything that is not a plain amount with at most 2 decimals.
export function parsePesos(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const s = input.trim().replace(/[,\s₱]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return Number.isSafeInteger(cents) && cents <= 2_000_000_000 ? cents : null; // under 20 million pesos per amount
}

export const pesoInput = (cents: number) => (cents / 100).toFixed(2);

// Basis points: 100 = 1%. "12.5" -> 1250
export function parsePercent(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const s = input.trim().replace(/%/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const bp = Math.round(Number(s) * 100);
  return bp >= 0 && bp <= 100_000 ? bp : null;
}

export const formatPercent = (bp: number) => `${(bp / 100).toFixed(2).replace(/\.?0+$/, "")}%`;

// Pay rates carry more precision than centavos. Shown to 4 decimals, cut rather than rounded, so they match a hand
// calculation: ₱10,000 a month × 12 ÷ 313 = 383.3865 a day; ÷ 8 = 47.9233 an hour. The amount actually paid is rounded once, to the centavo.
export const formatRate = (cents: number) =>
  `₱${(Math.floor(cents * 100 + 1e-6) / 10000).toLocaleString(DEFAULT_LOCALE, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

// Pay for logged minutes of a monthly salary, in one step so no rounding happens on the way: monthly × 12 × minutes ÷ (days a year × hours a day × 60).
export const payForMinutes = (monthlyCents: number, minutes: number, daysPerYear: number, hoursPerDay: number) =>
  Math.round((monthlyCents * 12 * minutes) / (daysPerYear * hoursPerDay * 60));

// Typing aid for peso fields: 25000 -> "25,000"; with finish, "25,000.00". parsePesos() reads either back.
export function groupPesos(raw: string, finish = false): string {
  const clean = raw.replace(/[^\d.]/g, "");
  if (!clean) return "";
  const [whole, ...rest] = clean.split(".");
  const frac = rest.join("").slice(0, 2);
  const grouped = (whole.replace(/^0+(?=\d)/, "") || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (finish) return `${grouped}.${frac.padEnd(2, "0")}`;
  return clean.includes(".") ? `${grouped}.${frac}` : grouped;
}

