"use client";

import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { goalOutcome, type GoalStatus } from "@/lib/goals";
import { acknowledgeReview, addGoal, closeCycle, createCycle, finalizeReview, submitManager, submitSelf, updateGoal } from "./actions";

export const RATING_LABEL = ["", "Needs improvement", "Below expectations", "Meets expectations", "Exceeds expectations", "Outstanding"];

const Msg = ({ s }: { s: FormState }) => (
  <>
    {s?.error && <Alert kind="error">{s.error}</Alert>}
    {s?.ok && <Alert kind="success">{s.ok}</Alert>}
  </>
);

export function GoalForm({ people }: { people?: { id: string; label: string }[] }) {
  const f = useKeptForm(addGoal);
  return (
    <form {...f.formProps} className="space-y-3">
      {people && (
        <label className="block text-sm font-medium">
          For
          <select name="employeeId" defaultValue="" className={inputClass}>
            <option value="">Me</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      )}
      <Field label="Goal" id="title" required />
      <Field label="Target date (optional)" id="targetDate" type="date" />
      <label className="block text-sm font-medium">
        Details (optional)
        <textarea name="description" rows={2} className={inputClass} />
      </label>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Add goal</SubmitButton>
    </form>
  );
}

export function GoalProgress({ id, progress, status, locked }: { id: string; progress: number; status: string; locked?: boolean }) {
  const f = useKeptForm(updateGoal.bind(null, id));
  const [value, setValue] = useState({ progress, status: status as GoalStatus });
  // The same rule as the server: reaching 100% marks the goal achieved, and lowering it again reopens it.
  const setProgress = (n: number) => setValue((v) => goalOutcome(n, v.status === "ACHIEVED" && n < 100 ? "ACTIVE" : v.status));
  return (
    <form {...f.formProps} className="mt-2 flex flex-wrap items-end gap-2">
      <label className="text-xs font-medium">
        Progress %
        <input name="progress" type="number" min={0} max={100} value={value.progress} onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} disabled={locked} aria-label="Progress percent" className="mt-1 block w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" />
      </label>
      <label className="text-xs font-medium">
        Status
        <select name="status" value={value.status} onChange={(e) => setValue((v) => goalOutcome(v.progress, e.target.value as GoalStatus))} disabled={locked} aria-label="Goal status" className="mt-1 block rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
          <option value="ACTIVE">In progress</option>
          <option value="ACHIEVED">Achieved</option>
          <option value="DROPPED">Dropped</option>
        </select>
      </label>
      {!locked && <button disabled={f.pending} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95">Save</button>}
      {f.state?.error && <p role="alert" className="w-full text-xs text-danger">{f.state.error}</p>}
      {f.state?.ok && <p role="status" className="w-full text-xs text-success">{f.state.ok}</p>}
    </form>
  );
}

export function CreateCycleForm() {
  const f = useKeptForm(createCycle);
  return (
    <form {...f.formProps} className="space-y-3">
      <Field label="Name" id="name" required placeholder="Annual review 2026" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Covers from" id="startDate" type="date" required />
        <Field label="Covers to" id="endDate" type="date" required />
      </div>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Start the cycle</SubmitButton>
    </form>
  );
}

export function CloseCycleButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => { if (window.confirm("Close this cycle? Nothing more can be submitted.")) start(() => closeCycle(id)); }} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      Close cycle
    </button>
  );
}

type Step = "self" | "manager" | "final";
const ACTIONS = { self: submitSelf, manager: submitManager, final: finalizeReview } as const;

// One form for all three steps: a 1-5 rating and a comment.
export function RatingForm({ reviewId, step, defaultRating, defaultComment, button }: { reviewId: string; step: Step; defaultRating?: number; defaultComment?: string; button: string }) {
  const f = useKeptForm(ACTIONS[step].bind(null, reviewId));
  return (
    <form {...f.formProps} className="space-y-3">
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Rating</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} defaultChecked={defaultRating === n} className="peer sr-only" required />
              <span className="inline-block rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand peer-focus-visible:outline-2">{n} · {RATING_LABEL[n]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">
        Comment
        <textarea name="comment" rows={3} required defaultValue={defaultComment} className={inputClass} />
      </label>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>{button}</SubmitButton>
    </form>
  );
}

export function AcknowledgeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => acknowledgeReview(id))} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition active:scale-95 disabled:opacity-60">
      I have read my review
    </button>
  );
}
