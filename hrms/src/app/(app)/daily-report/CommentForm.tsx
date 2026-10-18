"use client";

import { useKeptForm } from "@/components/useKeptForm";
import { Alert } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { addReportComment } from "./actions";

// A comment box under a report, or a reply box under a comment. The text clears itself once it is sent.
export function CommentForm({ reportId, parentId, label = "Add a comment", button = "Send" }: { reportId: string; parentId?: string; label?: string; button?: string }) {
  const f = useKeptForm(addReportComment.bind(null, reportId, parentId ?? null));
  return (
    <form {...f.formProps} className="space-y-2">
      <label className="block text-sm font-medium">
        <span className="sr-only">{label}</span>
        <textarea name="body" rows={2} required maxLength={2000} placeholder={label} className={`${inputClass} mt-0`} />
      </label>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <button disabled={f.pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition active:scale-95 disabled:opacity-60">{f.pending ? "Sending…" : button}</button>
    </form>
  );
}
