"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/Fields";
import { Card, buttonClass } from "@/components/ui";
import { OATH } from "@/lib/exams";
import type { ExamRun } from "@/lib/exam-run";
import { leaveExam, startExam } from "../../../actions";
import { ExamRunner } from "./ExamRunner";

export type PlayerInfo = {
  applicantId: string; examId: string; title: string; kindLabel: string; jobTitle: string;
  questionCount: number; timeLimitMin: number; instructions: string | null;
  psychological: boolean; commitment: boolean;
  // Set once the person has started before: the clock keeps running from the first start.
  resumed: { lang: "en" | "tl"; minutesLeft: number; leaves: number } | null;
};

// The exam screen. The questions are not in the page: they arrive only when the person presses Start, and are held in this
// window's memory. Leaving the screen (hiding the tab, minimizing, switching window) or reloading ends the run: the page
// comes back to this start screen, and the next start shows the questions in a new random order. The clock does not reset.
export function ExamPlayer({ info }: { info: PlayerInfo }) {
  const [run, setRun] = useState<ExamRun | null>(null);
  const [left, setLeft] = useState(false); // the person left: nothing is shown while the page reloads
  const [lang, setLang] = useState<"en" | "tl">(info.resumed?.lang ?? "en");
  const [sworn, setSworn] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startT] = useTransition();
  const leaving = useRef(false);
  const submitting = useRef(false);
  const oath = OATH[lang];

  useEffect(() => {
    if (!run) return;
    const leave = (reason: string) => {
      if (leaving.current || submitting.current) return;
      leaving.current = true;
      setLeft(true); // hide the questions at once
      void leaveExam(info.applicantId, info.examId, run.token, reason).catch(() => null).finally(() => location.reload());
    };
    const onVisibility = () => { if (document.hidden) leave("hidden"); };
    const onBlur = () => leave("blur");
    const onPageHide = () => leave("pagehide");
    const onBack = () => { if (leaving.current) location.reload(); }; // came back before the reload finished
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("focus", onBack);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onBack);
    };
  }, [run, info.applicantId, info.examId]);

  const begin = () => startT(async () => {
    setError(undefined);
    const r = await startExam(info.applicantId, info.examId, lang, !info.resumed && info.commitment && sworn);
    if ("run" in r) setRun(r.run);
    else if ("done" in r) location.href = "/apply";
    else setError(r.error);
  });

  if (left) return <p className="py-20 text-center text-muted" role="status">The exam screen was left. Returning to the start…</p>;

  if (run) {
    return (
      // No copying or dragging of the questions out of the exam.
      <div className="select-none" onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
        <ExamRunner applicantId={info.applicantId} examId={info.examId} title={info.title} run={run} onSending={() => { submitting.current = true; }} />
      </div>
    );
  }

  const r = info.resumed;
  return (
    <>
      <Link href="/apply" className="text-sm font-medium text-muted hover:text-ink">← Back to my application</Link>
      <Card>
        <p className="text-sm text-muted">{info.jobTitle} · {info.kindLabel}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{info.title}</h1>
        {r && r.leaves > 0 && (
          <div className="mt-4"><Alert kind="error">You left the exam screen {r.leaves === 1 ? "once" : `${r.leaves} times`} (changed tab, minimized, switched window or reloaded). The exam was reset and the questions are mixed again. Your time keeps running: {r.minutesLeft} minute{r.minutesLeft === 1 ? "" : "s"} left. HR can see how many times this happened.</Alert></div>
        )}
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
          <li>{info.questionCount} questions, one answer each.</li>
          <li>You have {info.timeLimitMin} minutes. The timer starts the first time you press Start and cannot be paused.</li>
          <li>You can take this exam only once. It is sent when you press Submit, or when time is up.</li>
          <li><strong>Stay on this screen.</strong> If you change tab, minimize the window, switch to another window or reload the page, the exam goes back to this start screen and the questions are mixed again. The timer does not reset.</li>
          {info.psychological && <li>There are no right or wrong answers. Answer honestly.</li>}
          {info.commitment && <li>This exam is bonded to the corporation. Before you start you take an oath that your answers are your commitment to it.</li>}
        </ul>
        {info.instructions && <p className="mt-4 whitespace-pre-line text-sm text-muted">{info.instructions}</p>}
        <div className="mt-6 space-y-4">
          {!r && (
            <fieldset>
              <legend className="text-sm font-medium">Language / Wika</legend>
              <div className="mt-2 flex gap-2">
                {([["en", "English"], ["tl", "Tagalog"]] as const).map(([k, l]) => (
                  <label key={k} className="cursor-pointer">
                    <input type="radio" name="lang" value={k} checked={lang === k} onChange={() => setLang(k)} className="peer sr-only" />
                    <span className="inline-block rounded-lg border border-line px-4 py-2 text-sm font-semibold peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand peer-focus-visible:outline-2">{l}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {info.commitment && !r && (
            <fieldset className="rounded-xl border-2 border-brand/40 bg-brand/5 p-4">
              <legend className="px-2 text-sm font-bold text-brand">{oath.title}</legend>
              <p className="text-sm leading-relaxed">{oath.text}</p>
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm font-semibold">
                <input type="checkbox" checked={sworn} onChange={(e) => setSworn(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" />
                <span>{oath.check}</span>
              </label>
              {!sworn && <p className="mt-2 text-xs text-muted">{oath.need}</p>}
            </fieldset>
          )}
          {(!info.commitment || r || sworn) && (
            <div>
              <button type="button" disabled={pending} onClick={begin} className={buttonClass}>{pending ? "Please wait…" : r ? (lang === "tl" ? "Magsimulang muli" : "Start again") : lang === "tl" ? "Simulan ang exam" : "Start the exam"}</button>
              {error && <div className="mt-2"><Alert kind="error">{error}</Alert></div>}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
