// How to read a Corporate Commitment result. Pure, so the page and the tests share one definition.
// The bands are a reading guide for HR, not a pass mark: the exam has no wrong answers, it shows what the person puts first.
export type Band = { key: "strong" | "committed" | "follow" | "low"; label: string; tone: "success" | "brand" | "warning" | "danger"; hint: string };

export const COMMITMENT_BANDS: Band[] = [
  { key: "strong", label: "Strongly committed", tone: "success", hint: "80% and above: puts the corporation first, even at a cost to themselves." },
  { key: "committed", label: "Committed", tone: "brand", hint: "65% to 79%: usually puts the corporation first." },
  { key: "follow", label: "Needs follow-up", tone: "warning", hint: "50% to 64%: mixed. Ask about it at the interview." },
  { key: "low", label: "Low commitment", tone: "danger", hint: "Below 50%: often puts their own interest first." },
];

export function commitmentBand(pct: number): Band {
  if (pct >= 80) return COMMITMENT_BANDS[0];
  if (pct >= 65) return COMMITMENT_BANDS[1];
  if (pct >= 50) return COMMITMENT_BANDS[2];
  return COMMITMENT_BANDS[3];
}

export type Breakdown = Record<string, { score: number; max: number }>;
const pctOf = (v: { score: number; max: number }) => (v.max ? Math.round((v.score / v.max) * 100) : 0);

// The strongest and the weakest area, for the one-line summary in the table. Ties keep the order the areas were asked.
export function traitExtremes(breakdown: Breakdown | null | undefined) {
  const rows = Object.entries(breakdown ?? {}).map(([name, v]) => ({ name, pct: pctOf(v) }));
  if (rows.length === 0) return null;
  let best = rows[0], worst = rows[0];
  for (const r of rows) { if (r.pct > best.pct) best = r; if (r.pct < worst.pct) worst = r; }
  return { best, worst };
}
