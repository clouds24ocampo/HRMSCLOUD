"use client";

import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { cancelOvertime, decideOvertime, requestOvertime } from "./actions";

export function RequestOvertimeForm({ day, label }: { day: string; label: string }) {
  const f = useKeptForm(requestOvertime.bind(null, day));
  return (
    <form {...f.formProps} className="mt-2 flex flex-wrap items-start gap-2">
      <input name="reason" required minLength={3} maxLength={300} placeholder="Why was the extra time needed?" aria-label="Reason for overtime" className={`${inputClass} mt-0 min-w-0 flex-1 basis-56`} />
      <button disabled={f.pending} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition active:scale-95 disabled:opacity-60">{label}</button>
      {f.state?.error && <p role="alert" className="w-full text-sm text-danger">{f.state.error}</p>}
      {f.state?.ok && <p role="status" className="w-full text-sm text-success">{f.state.ok}</p>}
    </form>
  );
}

export function CancelOvertimeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => cancelOvertime(id))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      Cancel request
    </button>
  );
}

export function DecideOvertimeForm({ id }: { id: string }) {
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const f = useKeptForm((p: FormState, fd: FormData) => decideOvertime(id, decision, p, fd));
  return (
    <form {...f.formProps} className="mt-3 flex flex-wrap items-start gap-2">
      <input name="note" placeholder="Note (required to reject)" aria-label="Note" maxLength={300} className="min-w-0 flex-1 basis-48 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
      <button disabled={f.pending} onClick={() => setDecision("APPROVED")} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60">Approve</button>
      <button disabled={f.pending} onClick={() => setDecision("REJECTED")} className="rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 active:scale-95 disabled:opacity-60">Reject</button>
      {f.state?.error && <p role="alert" className="w-full text-sm text-danger">{f.state.error}</p>}
    </form>
  );
}
