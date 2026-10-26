"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { addAdjustment, approve, calculate, createPeriod, deletePeriod, finalize, removeAdjustment, setSkipped } from "./actions";

export function CreatePeriodForm({ defaults, ph = false, incentives = [] }: { defaults: { start: string; end: string; pay: string; name: string }; ph?: boolean; incentives?: { code: string; name: string }[] }) {
  const f = useKeptForm(createPeriod);
  const [kind, setKind] = useState("REGULAR");
  return (
    <form {...f.formProps} className="space-y-3">
      <Field label="Name" id="name" required defaultValue={defaults.name} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Starts" id="startDate" type="date" required defaultValue={defaults.start} />
        <Field label="Ends" id="endDate" type="date" required defaultValue={defaults.end} />
        <Field label="Pay day" id="payDate" type="date" required defaultValue={defaults.pay} />
      </div>
      <label className="block text-sm font-medium">
        How often do you pay?
        <select name="periodsPerMonth" defaultValue="2" className={inputClass}>
          <option value="1">Once a month</option>
          <option value="2">Twice a month</option>
          <option value="4">Weekly</option>
        </select>
      </label>
      {ph && (
        <>
          <label className="block text-sm font-medium">
            What does this payroll pay?
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
              <option value="REGULAR">Regular pay for the days in the period</option>
              <option value="THIRTEENTH_MONTH">13th month pay (one twelfth of the year&apos;s basic pay)</option>
              <option value="GOV_INCENTIVE">Government bonus or incentive</option>
            </select>
          </label>
          {kind === "GOV_INCENTIVE" && (incentives.length > 0 ? (
            <label className="block text-sm font-medium">
              Which one
              <select name="incentiveCode" defaultValue="" required className={inputClass}>
                <option value="" disabled>Choose…</option>
                {incentives.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}
              </select>
            </label>
          ) : (
            <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              No government bonus rules are installed yet, so there is nothing to choose. <Link href="/payroll/rules" className="font-semibold text-brand hover:underline">Install the Government rules</Link> first, then come back.
            </p>
          ))}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="yearEnd" className="mt-0.5 h-4 w-4 accent-[var(--brand)]" /><span>Year-end tax adjustment: true up this year&apos;s withholding tax on this payroll (use it on the last payroll of the year, or when someone leaves)</span></label>
        </>
      )}
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      <SubmitButton pending={f.pending} disabled={kind === "GOV_INCENTIVE" && incentives.length === 0}>Create pay period</SubmitButton>
    </form>
  );
}

type Status = "DRAFT" | "CALCULATED" | "APPROVED" | "FINALIZED";

// One button per step. Calculating again is always allowed until the payroll is finalized.
export function PeriodActions({ id, status, hasSlips }: { id: string; status: Status; hasSlips: boolean }) {
  const [msg, setMsg] = useState<FormState>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<FormState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMsg(undefined);
    start(async () => setMsg(await fn()));
  };
  const btn = "rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-60";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status !== "FINALIZED" && (
          <button disabled={pending} onClick={() => run(() => calculate(id))} className={`${btn} ${status === "DRAFT" ? "bg-brand text-brand-ink" : "border border-line"}`}>
            {pending ? "Working…" : status === "DRAFT" ? "Calculate payroll" : "Calculate again"}
          </button>
        )}
        {status === "CALCULATED" && <button disabled={pending} onClick={() => run(() => approve(id))} className={`${btn} bg-success text-white`}>Approve</button>}
        {status === "APPROVED" && (
          <button disabled={pending} onClick={() => run(() => finalize(id), "Finalize this payroll? The numbers are locked and employees can see their payslips. This cannot be undone.")} className={`${btn} bg-ink text-bg`}>
            Finalize and lock
          </button>
        )}
        {status !== "FINALIZED" && (
          <button disabled={pending} onClick={() => { if (window.confirm("Delete this pay period and its payslips?")) start(() => deletePeriod(id)); }} className={`${btn} border border-danger text-danger hover:bg-danger/10`}>
            Delete period
          </button>
        )}
        {hasSlips && <a href={`/payroll/${id}/export`} className={`${btn} border border-line`}>Download CSV</a>}
      </div>
      <div className="mt-3 min-h-6" aria-live="polite">
        {msg?.error && <Alert kind="error">{msg.error}</Alert>}
        {msg?.ok && <Alert kind="success">{msg.ok}</Alert>}
      </div>
    </div>
  );
}

export function SkipForm({ periodId, people, skipped }: { periodId: string; people: { id: string; label: string }[]; skipped: string[] }) {
  const f = useKeptForm(setSkipped.bind(null, periodId));
  return (
    <form {...f.formProps} className="space-y-3">
      <ul className="grid gap-1 sm:grid-cols-2">
        {people.map((p) => (
          <li key={p.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="skip" value={p.id} defaultChecked={skipped.includes(p.id)} className="h-4 w-4 accent-[var(--brand)]" /> {p.label}</label></li>
        ))}
      </ul>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Save the list</SubmitButton>
    </form>
  );
}

export function AdjustmentForm({ periodId, people }: { periodId: string; people: { id: string; label: string }[] }) {
  const f = useKeptForm(addAdjustment.bind(null, periodId));
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Employee
          <select name="employeeId" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Type
          <select name="kind" defaultValue="EARNING" className={inputClass}>
            <option value="EARNING">Adds to pay</option>
            <option value="DEDUCTION">Takes from pay</option>
          </select>
        </label>
        <Field label="Name on the payslip" id="label" required />
        <Field label="Amount (pesos)" id="amount" inputMode="decimal" required placeholder="250.00" />
      </div>
      <Field label="Reason (kept on record)" id="reason" required />
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Add adjustment</SubmitButton>
    </form>
  );
}

export function RemoveAdjustmentButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => removeAdjustment(id))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      Remove
    </button>
  );
}
