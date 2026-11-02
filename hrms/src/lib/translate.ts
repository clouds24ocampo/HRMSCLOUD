// Automatic English -> Tagalog for exam questions. HR writes English only; the system translates and keeps the result
// on the question, so each text is translated once. If a translation fails the applicant simply sees the English text.
//
// Provider: Claude when ANTHROPIC_API_KEY is set (best wording, keeps technical terms as they are);
// otherwise the free Google Translate web endpoint, which needs no key.
// ponytail: the free endpoint is unofficial and may rate-limit. Set ANTHROPIC_API_KEY to move off it.
import { prisma } from "@/lib/prisma";
import { parseOptions } from "@/lib/exams";

const TIMEOUT_MS = 12_000;

// Google answers [[[translated, original, ...], [translated, original, ...]], ...]: one entry per sentence.
export function parseGoogle(json: unknown): string | null {
  const parts = Array.isArray(json) && Array.isArray(json[0]) ? json[0] : null;
  if (!parts) return null;
  const out = parts.map((p: unknown) => (Array.isArray(p) && typeof p[0] === "string" ? p[0] : "")).join("").trim();
  return out || null;
}

async function viaGoogle(texts: string[]): Promise<string[] | null> {
  const one = async (t: string) => {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tl&dt=t&q=${encodeURIComponent(t)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? parseGoogle(await res.json()) : null;
  };
  const out = await Promise.all(texts.map(one));
  return out.every((x) => x !== null) ? (out as string[]) : null;
}

async function viaClaude(texts: string[], key: string): Promise<string[] | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 2000,
      system: "Translate job-exam text from English to Tagalog (Filipino). Keep technical terms, code, product names and numbers as written. Reply with only a JSON array of strings, same length and order as the input.",
      messages: [{ role: "user", content: JSON.stringify(texts) }],
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const raw = body.content?.find((c) => c.type === "text")?.text ?? "";
  try {
    const arr: unknown = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
    return Array.isArray(arr) && arr.length === texts.length && arr.every((x) => typeof x === "string" && x.trim()) ? (arr as string[]) : null;
  } catch {
    return null;
  }
}

export async function translateToTagalog(texts: string[]): Promise<string[] | null> {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    return (key && (await viaClaude(texts, key))) || (await viaGoogle(texts));
  } catch {
    return null; // offline or timed out: the English text is used
  }
}

// Translates every question of an exam that has no Tagalog yet. Safe to call any time; already translated ones are skipped.
export async function ensureTagalog(examId: string) {
  const todo = await prisma.examQuestion.findMany({ where: { examId, textTl: null }, select: { id: true, text: true, options: true } });
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(
      todo.slice(i, i + 4).map(async (q) => {
        const opts = parseOptions(q.options);
        const tr = await translateToTagalog([q.text, ...opts.map((o) => o.text)]);
        if (!tr) return;
        await prisma.examQuestion.update({
          where: { id: q.id },
          data: { textTl: tr[0], options: opts.map((o, k) => ({ ...o, textTl: tr[k + 1] })) },
        });
      }),
    );
  }
}
