"use client";

import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { addCourse, cancelEnrollment, completeEnrollment, enroll } from "./actions";

const Msg = ({ s }: { s: FormState }) => (
  <>
    {s?.error && <Alert kind="error">{s.error}</Alert>}
    {s?.ok && <Alert kind="success">{s.ok}</Alert>}
  </>
);

export function AddCourseForm() {
  const f = useKeptForm(addCourse);
  return (
    <form {...f.formProps} className="space-y-3">
      <Field label="Course" id="title" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hours (optional)" id="hours" type="number" min={1} />
        <Field label="Certificate valid for (months, optional)" id="validityMonths" type="number" min={1} />
      </div>
      <label className="block text-sm font-medium">
        Description (optional)
        <textarea name="description" rows={2} className={inputClass} />
      </label>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Add course</SubmitButton>
    </form>
  );
}

export function EnrollForm({ courseId, people }: { courseId: string; people: { id: string; label: string }[] }) {
  const f = useKeptForm(enroll.bind(null, courseId));
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <form {...f.formProps} className="mt-2 space-y-2">
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
        {people.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-bg">
            <input type="checkbox" name="people" value={p.id} checked={picked.includes(p.id)} onChange={() => setPicked((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id]))} className="h-4 w-4 accent-[var(--brand)]" />
            {p.label}
          </label>
        ))}
      </div>
      <Msg s={f.state} />
      <button disabled={f.pending || picked.length === 0} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition active:scale-95 disabled:opacity-60">Enroll {picked.length || ""} {picked.length === 1 ? "person" : "people"}</button>
    </form>
  );
}

export function CompleteForm({ id, today }: { id: string; today: string }) {
  const f = useKeptForm(completeEnrollment.bind(null, id));
  return (
    <form {...f.formProps} className="mt-2 flex flex-wrap items-end gap-2">
      <label className="text-xs font-medium">
        Completed on
        <input type="date" name="completedOn" defaultValue={today} max={today} required aria-label="Completed on" className="mt-1 block rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" />
      </label>
      <button disabled={f.pending} className="rounded-lg bg-success px-3 py-1.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60">Mark complete</button>
      {f.state?.error && <p role="alert" className="w-full text-xs text-danger">{f.state.error}</p>}
    </form>
  );
}

export function CancelEnrollmentButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => cancelEnrollment(id))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      Cancel enrollment
    </button>
  );
}
