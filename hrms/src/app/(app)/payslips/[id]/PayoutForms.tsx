"use client";

import { useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { MoneyInput } from "@/components/MoneyInput";
import { inputClass } from "@/components/ui";
import { PAYOUT_METHODS } from "@/lib/payout";
import type { FormState } from "@/app/login/actions";
import { answerPayout, recordPayout } from "../actions";

export function RecordPayoutForm({ payslipId, net, today }: { payslipId: string; net: string; today: string }) {
  const f = useKeptForm(recordPayout.bind(null, payslipId));
  return (
    <form {...f.formProps} encType="multipart/form-data" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyInput label="Amount actually paid (pesos)" id="amount" required defaultValue={net} />
        <label className="block text-sm font-medium">
          Paid by
          <select name="method" required defaultValue="Bank transfer" className={inputClass}>
            {PAYOUT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <Field label="Reference no. (optional)" id="reference" maxLength={120} placeholder="Transaction or check number" />
        <Field label="Paid on" id="paidOn" type="date" required defaultValue={today} />
      </div>
      <label className="block text-sm font-medium">
        Proof of payment (PDF, PNG or JPEG)
        <input type="file" name="proof" accept="application/pdf,image/png,image/jpeg" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand`} />
      </label>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Record payment</SubmitButton>
    </form>
  );
}

export function AnswerPayoutForm({ payoutId, amount }: { payoutId: string; amount: string }) {
  const [answer, setAnswer] = useState<"CONFIRMED" | "DISPUTED">("CONFIRMED");
  const f = useKeptForm((p: FormState, fd: FormData) => answerPayout(payoutId, answer, p, fd));
  return (
    <form {...f.formProps} className="space-y-2">
      <input name="note" maxLength={500} placeholder="If something is wrong, tell HR what (required to report)" aria-label="Note to HR" className={`${inputClass} mt-0`} />
      <div className="flex flex-wrap gap-2">
        <button disabled={f.pending} onClick={() => setAnswer("CONFIRMED")} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60">I received {amount}</button>
        <button disabled={f.pending} onClick={() => setAnswer("DISPUTED")} className="rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 active:scale-95 disabled:opacity-60">Report a problem</button>
      </div>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
    </form>
  );
}
