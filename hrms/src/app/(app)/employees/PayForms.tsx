"use client";

import { useTransition } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { assignComponent, removeComponent, setCompensation } from "./pay-actions";

export function CompensationForm({ employeeId, today }: { employeeId: string; today: string }) {
  const f = useKeptForm(setCompensation.bind(null, employeeId));
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          Paid
          <select name="payType" defaultValue="MONTHLY" className={inputClass}>
            <option value="MONTHLY">Monthly salary</option>
            <option value="DAILY">Per day</option>
            <option value="HOURLY">Per hour</option>
          </select>
        </label>
        <MoneyInput label="Rate (pesos)" id="rate" required placeholder="22,000.00" />
        <Field label="Starts on" id="effectiveFrom" type="date" required defaultValue={today} />
      </div>
      <Field label="Note (optional)" id="note" />
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Save pay rate</SubmitButton>
    </form>
  );
}

export function AssignComponentForm({ employeeId, items }: { employeeId: string; items: { id: string; label: string }[] }) {
  const f = useKeptForm(assignComponent.bind(null, employeeId));
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Pay item
          <select name="componentId" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
        </label>
        <Field label="Different amount for this person (optional)" id="override" inputMode="decimal" placeholder="uses the standard amount" />
      </div>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Assign</SubmitButton>
    </form>
  );
}

export function RemoveComponentButton({ employeeId, componentId, name }: { employeeId: string; componentId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} aria-label={`Remove ${name}`} onClick={() => start(() => removeComponent(employeeId, componentId))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      Remove
    </button>
  );
}
