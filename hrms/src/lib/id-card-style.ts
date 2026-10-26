// Small pure helpers for drawing the ID card, kept apart so they can be tested.

const HEX = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

// WCAG relative luminance of a #rrggbb color (0 = black, 1 = white).
function luminance(hex: string): number {
  const m = HEX.exec(hex);
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or near-black text, whichever reads better on the given background. */
export function readableOn(hex: string): "#ffffff" | "#0f172a" {
  return luminance(hex) > 0.4 ? "#0f172a" : "#ffffff";
}

/** Up to two capital letters for a logo placeholder: "Quantum Cloud Corporation" -> "QC". */
export function initialsOf(name: string): string {
  const letters = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).map((w) => w[0].toUpperCase());
  return (letters.length > 1 ? letters[0] + letters[1] : letters[0] ?? "").slice(0, 2) || "?";
}

/** The card header: the chosen color, deepening toward one corner. */
export const headerGradient = (accent: string) => `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 62%, black))`;
