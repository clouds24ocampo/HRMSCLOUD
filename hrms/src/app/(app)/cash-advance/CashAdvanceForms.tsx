"use client";

import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, SubmitButton } from "@/components/Fields";
import { MoneyInput } from "@/components/MoneyInput";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { cancelCashAdvance, decideCashAdvance, requestCashAdvance, rescheduleCashAdvance } from "./actions";

export function RequestCashAdvanceForm({ max }: { max: number }) {
  const f = useKeptForm(requestCashAdvance);
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyInput label="Amount (pesos)" id="amount" required placeholder="5,000.00" />
        <label className="block text-sm font-medium">
          Repay over
          <select name="installments" defaultValue="1" className={inputClass}>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} cut-off{n === 1 ? "" : "s"}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">
        Reason
        <textarea name="reason" rows={2} required minLength={5} maxLength={500} className={inputClass} />
      </label>
      <p className="text-xs text-muted">This is your request: HR decides the final schedule, whole in one cut-off or split, and it shows on your payslip.</p>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Request cash advance</SubmitButton>
    </form>
  );
}

type CutoffOpt = { start: string; label: string };

// When it comes off pay: the cut-off it starts in, and whole (1) or split over several.
function ScheduleFields({ cutoffs, start, installments, max }: { cutoffs: CutoffOpt[]; start: string; installments: number; max: number }) {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium">
        Start deducting in
        <select name="firstCutoff" defaultValue={start} className={inputClass}>
          {cutoffs.map((c) => <option key={c.start} value={c.start}>{c.label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Deduct
        <select name="installments" defaultValue={String(installments)} className={inputClass}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "Whole amount in that cut-off" : `Split over ${n} cut-offs`}</option>)}
        </select>
      </label>
    </div>
  );
}

export function DecideCashAdvanceForm({ id, cutoffs, start, installments, max }: { id: string; cutoffs: CutoffOpt[]; start: string; installments: number; max: number }) {
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const f = useKeptForm((p: FormState, fd: FormData) => decideCashAdvance(id, decision, p, fd));
  return (
    <form {...f.formProps} className="mt-3 flex flex-wrap items-start gap-2">
      <ScheduleFields cutoffs={cutoffs} start={start} installments={installments} max={max} />
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

export function RescheduleCashAdvanceForm({ id, cutoffs, start, installments, max }: { id: string; cutoffs: CutoffOpt[]; start: string; installments: number; max: number }) {
  const f = useKeptForm(rescheduleCashAdvance.bind(null, id));
  return (
    <form {...f.formProps} className="mt-2 space-y-2">
      <ScheduleFields cutoffs={cutoffs} start={start} installments={installments} max={max} />
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <button disabled={f.pending} className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-60">Save schedule</button>
    </form>
  );
}
