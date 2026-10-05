"use client";

import { useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { createRequest, respondRequest } from "./actions";

export function NewRequestForm({ categories }: { categories: readonly string[] }) {
  const f = useKeptForm(createRequest);
  return (
    <form {...f.formProps} className="space-y-3">
      <label className="block text-sm font-medium">
        What is it about?
        <select name="category" required defaultValue="" className={inputClass}>
          <option value="" disabled>Choose…</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <Field label="Subject" id="subject" required />
      <label className="block text-sm font-medium">
        Message
        <textarea name="message" rows={4} required className={inputClass} />
      </label>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Send to HR</SubmitButton>
    </form>
  );
}

export function RespondForm({ id, current }: { id: string; current?: string | null }) {
  const [status, setStatus] = useState<"IN_PROGRESS" | "RESOLVED">("RESOLVED");
  const f = useKeptForm((p, fd) => respondRequest(id, p, fd));
  return (
    <form {...f.formProps} className="mt-3 space-y-2">
      <input type="hidden" name="status" value={status} />
      <label className="block text-sm font-medium">
        Answer
        <textarea name="response" rows={3} defaultValue={current ?? ""} className={inputClass} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button disabled={f.pending} onClick={() => setStatus("RESOLVED")} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60">Send answer and resolve</button>
        <button disabled={f.pending} onClick={() => setStatus("IN_PROGRESS")} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold transition hover:bg-bg active:scale-95 disabled:opacity-60">Mark as in progress</button>
      </div>
      {f.state?.error && <p role="alert" className="text-sm text-danger">{f.state.error}</p>}
      {f.state?.ok && <p role="status" className="text-sm text-success">{f.state.ok}</p>}
    </form>
  );
}
