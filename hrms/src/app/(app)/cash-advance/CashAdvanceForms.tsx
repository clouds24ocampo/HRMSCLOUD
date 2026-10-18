"use client";

import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, SubmitButton } from "@/components/Fields";
import { MoneyInput } from "@/components/MoneyInput";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { cancelCashAdvance, decideCashAdvance, requestCashAdvance, setCashAdvanceDeduction } from "./actions";

export function RequestCashAdvanceForm() {
  const f = useKeptForm(requestCashAdvance);
  return (
    <form {...f.formProps} className="space-y-3">
      <MoneyInput label="Amount (pesos)" id="amount" required placeholder="5,000.00" />
      <label className="block text-sm font-medium">
        Reason
        <textarea name="reason" rows={2} required minLength={5} maxLength={500} className={inputClass} />
      </label>
      <p className="text-xs text-muted">This is your request: once confirmed by HR, it will be deducted on your payslip.</p>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Request cash advance</SubmitButton>
    </form>
  );
}

export function DecideCashAdvanceForm({ id }: { id: string }) {
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const f = useKeptForm((p: FormState, fd: FormData) => decideCashAdvance(id, decision, p, fd));
  return (
    <form {...f.formProps} className="mt-3 flex flex-wrap items-center gap-2">
      <input name="note" placeholder="Note (required to reject)" aria-label="Note" maxLength={300} className="min-w-0 flex-1 basis-48 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
      <button disabled={f.pending} onClick={() => setDecision("APPROVED")} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60">Approve</button>
      <button disabled={f.pending} onClick={() => setDecision("REJECTED")} className="rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 active:scale-95 disabled:opacity-60">Reject</button>
      {f.state?.error && <p role="alert" className="w-full text-sm text-danger">{f.state.error}</p>}
    </form>
  );
}

export function CancelCashAdvanceButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => cancelCashAdvance(id))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg disabled:opacity-60">
      Cancel request
    </button>
  );
}


// HR: on which payslip the whole amount comes off, or not yet.
export function DeductCashAdvanceForm({ id, cutoffs, current }: { id: string; cutoffs: { start: string; label: string }[]; current: string }) {
  const f = useKeptForm(setCashAdvanceDeduction.bind(null, id));
  return (
    <form {...f.formProps} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="block min-w-0 flex-1 basis-56 text-sm font-medium">
        Deduct on payslip
        <select name="firstCutoff" defaultValue={current} className={inputClass}>
          <option value="">Not yet (do not deduct)</option>
          {cutoffs.map((c) => <option key={c.start} value={c.start}>{c.label}</option>)}
        </select>
      </label>
      <button disabled={f.pending} className="rounded-lg border border-brand px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-60">Save</button>
      {f.state?.error && <p role="alert" className="w-full text-sm text-danger">{f.state.error}</p>}
      {f.state?.ok && <p role="status" className="w-full text-sm text-success">{f.state.ok}</p>}
    </form>
  );
}
