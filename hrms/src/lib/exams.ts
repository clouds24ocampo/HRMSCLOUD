// Applicant exams. Pure scoring lives here so the portal, the HR view and the tests use one definition.
// A question is { text, trait?, options: [{ text, points }] }. Knowledge exams give 1 point to the right option;
// psychological exams give every option its own points. Score = sum of the points of the chosen options.
import { z } from "zod";

export const OptionsSchema = z.array(z.object({ text: z.string().min(1), textTl: z.string().optional(), points: z.number().int().min(0).max(10) })).min(2);
export type ExamOption = z.infer<typeof OptionsSchema>[number];
export type Question = { id: string; trait: string | null; options: ExamOption[] };
export type Answers = Record<string, number>;
export type Breakdown = Record<string, { score: number; max: number }>;

export type Lang = "en" | "tl";
export const LANGS: { key: Lang; label: string }[] = [{ key: "en", label: "English" }, { key: "tl", label: "Tagalog" }];
export const asLang = (v: unknown): Lang => (v === "tl" ? "tl" : "en");
// Text for the chosen language; falls back to English when no Tagalog was written.
export const pick = (en: string, tl: string | null | undefined, lang: Lang) => (lang === "tl" && tl?.trim() ? tl : en);

// The few words around the questions. Questions themselves are written by HR.
export const UI = {
  en: { questions: "Question", answered: "answered", submit: "Submit exam" },
  tl: { questions: "Tanong", answered: "nasagot", submit: "Isumite ang exam" },
} as const;

// Same seed, same order: an applicant's shuffle stays the same when the page reloads, but differs between applicants.
export function shuffleSeeded<T>(items: readonly T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length; // xmur3 string hash -> mulberry32 generator
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  const rand = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export const KIND_LABEL = { KNOWLEDGE: "Position knowledge", PSYCHOLOGICAL: "Psychological", COMMITMENT: "Commitment to the corporation" } as const;
export type ExamKindKey = keyof typeof KIND_LABEL;
// The order an applicant takes the exams: corporate commitment first, then psychological, then position knowledge.
export const EXAM_ORDER: Record<ExamKindKey, number> = { COMMITMENT: 0, PSYCHOLOGICAL: 1, KNOWLEDGE: 2 };

// Shown before the commitment exam. The applicant must tick the box; the time of the tick is saved with the attempt.
export const OATH = {
  en: {
    title: "My commitment and oath to the corporation",
    text: "I declare that every answer I give in this examination is true and given in good faith. I make these answers as my commitment and oath to the corporation: to protect its interests, property, confidential information and good name, and to help it grow. I understand that an answer found to be false or dishonest may disqualify my application or, if I am hired, lead to action under company policy and the law.",
    check: "I have read this and I swear that all my answers in this examination are my commitment and oath to the corporation.",
    need: "Tick the box to take the oath before you start.",
  },
  tl: {
    title: "Ang aking pangako at panunumpa sa korporasyon",
    text: "Ipinapahayag ko na ang bawat sagot ko sa pagsusulit na ito ay totoo at ibinibigay ko nang may mabuting loob. Ibinibigay ko ang mga sagot na ito bilang aking pangako at panunumpa sa korporasyon: ang pangalagaan ang interes, ari-arian, kumpidensyal na impormasyon at magandang pangalan nito, at tumulong sa paglago nito. Nauunawaan ko na ang sagot na mapatunayang hindi totoo o hindi tapat ay maaaring magdiskuwalipika sa aking aplikasyon o, kung ako ay matanggap, magresulta sa aksyon ayon sa patakaran ng kumpanya at ng batas.",
    check: "Nabasa ko ito at sumusumpa ako na ang lahat ng sagot ko sa pagsusulit na ito ay aking pangako at panunumpa sa korporasyon.",
    need: "Lagyan ng tsek ang kahon para manumpa bago magsimula.",
  },
} as const;

export const parseOptions = (raw: unknown): ExamOption[] => {
  const r = OptionsSchema.safeParse(raw);
  return r.success ? r.data : [];
};

export function scoreExam(questions: Question[], answers: Answers) {
  let score = 0;
  let max = 0;
  const breakdown: Breakdown = {};
  for (const q of questions) {
    const top = Math.max(0, ...q.options.map((o) => o.points));
    const picked = q.options[answers[q.id]]?.points ?? 0; // unanswered or out-of-range counts as 0
    score += picked;
    max += top;
    if (q.trait) {
      const b = (breakdown[q.trait] ??= { score: 0, max: 0 });
      b.score += picked;
      b.max += top;
    }
  }
  return { score, max, pct: max > 0 ? Math.round((score / max) * 100) : 0, breakdown };
}

export const passed = (pct: number, passingPct: number | null) => passingPct == null || pct >= passingPct;

// Seconds left on a started attempt; <= 0 means time is up. Small grace for network lag.
export const GRACE_SECONDS = 30;
export const secondsLeft = (startedAt: Date, limitMin: number, now = new Date()) =>
  Math.round((startedAt.getTime() + limitMin * 60_000 - now.getTime()) / 1000);
export const timeIsUp = (startedAt: Date, limitMin: number, now = new Date()) => secondsLeft(startedAt, limitMin, now) < -GRACE_SECONDS;

// The positions HR starts with. "Add starter positions" skips any title that already exists.
export const STARTER_POSITIONS = [
  "Software Engineer: Front End",
  "Software Engineer: Back End",
  "Software Engineer: Full Stack",
  "Software Engineer: DevOps",
  "Safety Officer",
  "Office Staff",
  "Marketing Staff",
  "Human Resources Staff",
  "Field Helper",
  "Field Network Engineer",
  "Field Line Man",
  "Quality Officer",
  "Admin Staff",
  // Information technology company
  "Mobile App Developer",
  "QA Engineer (Software Tester)",
  "UI/UX Designer",
  "Data Analyst",
  "Database Administrator",
  "Cybersecurity Analyst",
  "IT Support Specialist",
  "Systems Administrator",
  "Cloud Engineer",
  "Business Analyst (IT)",
  "IT Project Manager",
  "Network Administrator",
] as const;
