// Money is always whole centavos in the database and in calculations. Only the screen shows pesos.

export const DEFAULT_CURRENCY = "PHP";

export function formatMoney(cents: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
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
