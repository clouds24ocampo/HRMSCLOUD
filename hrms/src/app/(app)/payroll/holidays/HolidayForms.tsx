"use client";

import { useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { addHoliday, addStandardHolidays, removeHoliday } from "./actions";

export function AddHolidayForm() {
  const f = useKeptForm(addHoliday);
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date" id="date" type="date" required />
        <Field label="Name" id="name" required placeholder="Eid'l Fitr" />
        <label className="block text-sm font-medium">
          Kind
          <select name="type" defaultValue="" required className={inputClass}>
            <option value="" disabled>Choose…</option>
            <option value="REGULAR">Regular holiday</option>
            <option value="SPECIAL_NON_WORKING">Special non-working day</option>
            <option value="SPECIAL_WORKING">Special working day</option>
          </select>
        </label>
      </div>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Add holiday</SubmitButton>
    </form>
  );
}

export function StandardHolidaysForm({ year }: { year: number }) {
  const f = useKeptForm(addStandardHolidays);
  return (
    <form {...f.formProps} className="space-y-3">
      <Field label="Year" id="year" type="number" min={2020} max={2100} defaultValue={year} required />
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Add the holidays fixed by law</SubmitButton>
    </form>
  );
}

export function RemoveHolidayButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} aria-label={`Remove ${label}`} onClick={() => start(() => removeHoliday(id))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">Remove</button>;
}
