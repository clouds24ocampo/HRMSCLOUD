"use client";

import { useActionState, useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { cancelLeave, decideLeave, requestLeave } from "./actions";

export function RequestLeaveForm({ types, today }: { types: { id: string; label: string }[]; today: string }) {
  const [reason, setReason] = useState("");
  const { state, pending, formProps } = useKeptForm(async (prev: FormState, fd: FormData) => {
    const r = await requestLeave(prev, fd);
    if (r?.ok) setReason("");
    return r;
  });
  return (
    <form {...formProps} className="space-y-3">
      <label className="block text-sm font-medium">
        Leave type
        <select name="leaveTypeId" required defaultValue="" className={inputClass}>
          <option value="" disabled>Choose…</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">From<input type="date" name="from" defaultValue={today} required className={inputClass} /></label>
        <label className="block text-sm font-medium">To<input type="date" name="to" defaultValue={today} required className={inputClass} /></label>
      </div>
      <label className="block text-sm font-medium">
        Reason
        <input name="reason" required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
      </label>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending}>Send request</SubmitButton>
    </form>
  );
}

export function CancelButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => cancelLeave(id))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      {pending ? "Cancelling…" : "Cancel request"}
    </button>
  );
}

export function DecideForm({ id }: { id: string }) {
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [state, action, pending] = useActionState((p: FormState, fd: FormData) => decideLeave(id, decision, p, fd), undefined);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-start gap-2">
      <input name="note" placeholder="Note (required to reject)" aria-label="Note" maxLength={300} className="min-w-0 flex-1 basis-48 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
      <button disabled={pending} onClick={() => setDecision("APPROVED")} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60">Approve</button>
      <button disabled={pending} onClick={() => setDecision("REJECTED")} className="rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 active:scale-95 disabled:opacity-60">Reject</button>
      {state?.error && <p role="alert" className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
