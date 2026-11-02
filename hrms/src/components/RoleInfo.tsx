"use client";

import { useState } from "react";

type Lang = "en" | "tl";
const lines = (s: string | null | undefined) => (s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

// The role in plain words: a one-line summary and what the person will do, with an English / Tagalog switch.
// Tagalog falls back to English for any part that has no translation yet.
export function RoleInfo({ description, descriptionTl, duties, dutiesTl, defaultLang = "en" }: { description: string | null; descriptionTl: string | null; duties: string | null; dutiesTl: string | null; defaultLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(defaultLang);
  const summary = lang === "tl" && descriptionTl ? descriptionTl : description;
  const en = lines(duties), tl = lines(dutiesTl);
  const list = lang === "tl" && tl.length === en.length && tl.length > 0 ? tl : en;
  if (!summary && list.length === 0) return null;
  return (
    <div className="space-y-3 text-sm">
      <div role="group" aria-label="Language" className="inline-flex gap-1 rounded-lg bg-line/50 p-0.5">
        {([["en", "English"], ["tl", "Tagalog"]] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={lang === k} onClick={() => setLang(k)} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${lang === k ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      {summary && <p>{summary}</p>}
      {list.length > 0 && (
        <div>
          <p className="font-semibold">{lang === "tl" ? "Ano ang gagawin mo" : "What you will do"}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{list.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
