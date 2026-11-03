"use client";

import { useEffect, useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, SubmitButton } from "@/components/Fields";
import { LANGS, UI, pick, type Lang } from "@/lib/exams";
import type { ExamRun } from "@/lib/exam-run";
import { submitExam } from "../../../actions";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function ExamRunner({ applicantId, examId, title, run, onSending }: { applicantId: string; examId: string; title: string; run: ExamRun; onSending: () => void }) {
  const { questions, secondsLeft, lang: startLang } = run;
  const f = useKeptForm(submitExam.bind(null, applicantId, examId, run.token));
  const [left, setLeft] = useState(secondsLeft);
  const [answered, setAnswered] = useState(0);
  const [lang, setLang] = useState<Lang>(startLang as Lang); // can be switched while answering; answers do not change
  const t = UI[lang];

  // Count down from the server's remaining time. At zero the exam is sent as it stands.
  const submit = f.formProps.ref;
  useEffect(() => {
    const end = Date.now() + secondsLeft * 1000;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(t);
        submit.current?.requestSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft, submit]);

  return (
    <form {...f.formProps} onSubmit={(e) => { onSending(); f.formProps.onSubmit(e); }} onChange={(e) => setAnswered(new Set(Array.from(new FormData(e.currentTarget).keys())).size)} className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <h1 className="truncate font-semibold">{title}</h1>
        <p className="shrink-0 text-sm" aria-live="off">
          <span className="text-muted">{answered}/{questions.length} {t.answered} · </span>
          <span className={`font-mono font-bold ${left <= 60 ? "text-danger" : ""}`}>{clock(left)}</span>
        </p>
      </div>
      {(
        <div role="group" aria-label="Language" className="flex gap-1 rounded-xl bg-line/50 p-1">
          {LANGS.map((l) => (
            <button key={l.key} type="button" aria-pressed={lang === l.key} onClick={() => setLang(l.key)} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${lang === l.key ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"}`}>{l.label}</button>
          ))}
        </div>
      )}
      {questions.map((q, n) => (
        <fieldset key={q.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-muted">{t.questions} {n + 1}</legend>
          <p className="font-medium">{pick(q.text, q.textTl, lang)}</p>
          <div className="mt-3 space-y-2">
            {q.options.map((o) => (
              <label key={o.i} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm transition has-[:checked]:border-brand has-[:checked]:bg-brand/10">
                <input type="radio" name={`q_${q.id}`} value={o.i} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
                <span>{pick(o.text, o.textTl, lang)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      <SubmitButton pending={f.pending}>{t.submit}</SubmitButton>
    </form>
  );
}
