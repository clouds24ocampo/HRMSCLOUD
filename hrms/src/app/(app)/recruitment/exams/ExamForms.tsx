"use client";

import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import type { ExamKindKey } from "@/lib/exams";
import { addQuestion, createExam, deleteExam, deleteQuestion, setExamActive } from "../exam-actions";

const Msg = ({ s }: { s: FormState }) => (
  <>
    {s?.error && <Alert kind="error">{s.error}</Alert>}
    {s?.ok && <Alert kind="success">{s.ok}</Alert>}
  </>
);

export function CreateExamForm({ jobs }: { jobs: { id: string; label: string }[] }) {
  const f = useKeptForm(createExam);
  const [kind, setKind] = useState("KNOWLEDGE");
  return (
    <form {...f.formProps} className="space-y-3">
      <Field label="Exam title" id="title" placeholder="Back End Developer exam" required />
      <label className="block text-sm font-medium">
        Type
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
          <option value="KNOWLEDGE">Position knowledge (right and wrong answers)</option>
          <option value="PSYCHOLOGICAL">Psychological (no wrong answers)</option>
          <option value="COMMITMENT">Commitment to the corporation (oath before starting)</option>
        </select>
      </label>
      <label className="block text-sm font-medium">
        For which position
        <select name="jobId" defaultValue="" className={inputClass}>
          <option value="">Every position</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Time limit (minutes)" id="timeLimitMin" type="number" min={1} max={300} defaultValue={60} required />
        {kind === "KNOWLEDGE" && <Field label="Passing score (%)" id="passingPct" type="number" min={1} max={100} defaultValue={60} />}
      </div>
      <label className="block text-sm font-medium">
        Instructions (optional)
        <textarea name="instructions" rows={3} className={inputClass} />
      </label>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Create the exam</SubmitButton>
    </form>
  );
}

export function QuestionForm({ examId, kind }: { examId: string; kind: ExamKindKey }) {
  const f = useKeptForm(addQuestion.bind(null, examId));
  const knowledge = kind === "KNOWLEDGE";
  return (
    <form {...f.formProps} className="space-y-3">
      <label className="block text-sm font-medium">
        Question
        <textarea name="text" rows={2} required maxLength={1000} className={inputClass} />
      </label>
      {!knowledge && <Field label="Trait measured (optional)" id="trait" placeholder="Teamwork, Discipline, Stress handling…" maxLength={40} />}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Answer choices {knowledge ? "(select the correct one)" : "(points from 0 to 10; higher means a better fit)"}</legend>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {knowledge && <input type="radio" name="correct" value={i} defaultChecked={i === 0} aria-label={`Choice ${i + 1} is correct`} className="h-4 w-4 shrink-0 accent-[var(--brand)]" />}
            <input name={`opt${i}`} placeholder={`Choice ${i + 1}${i > 1 ? " (optional)" : ""}`} maxLength={300} required={i < 2} className={`${inputClass} !mt-0 min-w-0 flex-1 basis-40`} />
            {!knowledge && <input name={`pts${i}`} type="number" min={0} max={10} defaultValue={0} aria-label={`Points for choice ${i + 1}`} className={`${inputClass} !mt-0 !w-20 shrink-0`} />}
          </div>
        ))}
      </fieldset>
      <Msg s={f.state} />
      <p className="text-xs text-muted">Write in English. Applicants who choose Tagalog get an automatic translation.</p>
      <SubmitButton pending={f.pending}>Add the question</SubmitButton>
    </form>
  );
}

const small = "rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60";

export function ExamControls({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <button disabled={pending} onClick={() => start(() => setExamActive(id, !active))} className={small}>{active ? "Turn off" : "Turn on"}</button>
      <button
        disabled={pending}
        onClick={() => { if (confirm("Delete this exam, its questions and every applicant's result for it?")) start(() => deleteExam(id)); }}
        className={`${small} !border-danger text-danger`}
      >
        Delete
      </button>
    </div>
  );
}

export function DeleteQuestionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(() => deleteQuestion(id))} className="text-sm font-medium text-danger hover:underline disabled:opacity-60">Remove</button>;
}
