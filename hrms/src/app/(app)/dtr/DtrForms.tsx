"use client";

import { useActionState, useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { addManualPunch, voidPunch } from "./actions";

export function ManualPunchForm({ employees, today, selected, stamps }: { employees: { id: string; label: string }[]; today: string; selected: string; stamps: { value: string; label: string }[] }) {
  const [reason, setReason] = useState("");
  const { state, pending, formProps } = useKeptForm(async (prev: FormState, fd: FormData) => {
    const r = await addManualPunch(prev, fd);
    if (r?.ok) setReason("");
    return r;
  });
  return (
    <form {...formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="employeeId" className="block text-sm font-medium">
          Employee
          <select id="employeeId" name="employeeId" defaultValue={selected} className={inputClass}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </label>
        <label htmlFor="stamp" className="block text-sm font-medium">
          Time stamp
          <select id="stamp" name="stamp" defaultValue={stamps[0]?.value} className={inputClass}>
            {stamps.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <Field label="Date" id="date" type="date" defaultValue={today} max={today} required />
        <Field label="Time (HH:MM or HH:MM:SS)" id="time" type="time" step="1" required />
      </div>

      <Field label="Reason (required, kept on record)" id="reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending}>Add missed punch</SubmitButton>
    </form>
  );
}

export function VoidForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(voidPunch.bind(null, eventId), undefined);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-danger hover:underline">
        Void
      </button>
    );
  }
  return (
    <form action={action} className="mt-2 flex flex-wrap items-start gap-2">
      <input name="reason" required minLength={5} placeholder="Reason for voiding" aria-label="Reason for voiding" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" />
      <button disabled={pending} className="rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Void punch</button>
      <button type="button" onClick={() => setOpen(false)} className="px-2 py-1.5 text-sm text-muted">Cancel</button>
      {state?.error && <p role="alert" className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}
