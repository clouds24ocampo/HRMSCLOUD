"use client";

import { useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert } from "@/components/Fields";
import { buttonClass, ghostClass, inputClass } from "@/components/ui";
import { acknowledgeHandbookAction, createHandbookSectionAction, updateHandbookSectionAction } from "./actions";

export function AcknowledgeHandbookForm() {
  const [agreed, setAgreed] = useState(false);
  const f = useKeptForm(acknowledgeHandbookAction);

  return (
    <form {...f.formProps} className="rounded-2xl border-2 border-brand/40 bg-linear-to-r from-brand/10 via-surface to-surface p-5 space-y-4">
      <div>
        <h3 className="font-bold text-lg text-ink flex items-center gap-2">
          <span>📖</span> Handbook Receipt & Agreement
        </h3>
        <p className="text-sm text-muted">
          All employees are required to acknowledge and adhere to company policies, disciplinary standards, and operational guidelines.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          required
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded accent-brand"
        />
        <span className="text-ink">
          I confirm that I have read, understood, and will abide by all provisions of the Company Employee Handbook and Code of Discipline.
        </span>
      </label>

      <label className="block text-xs font-medium text-muted">
        Optional Employee Note
        <input
          name="note"
          maxLength={200}
          placeholder="e.g. Read and acknowledged with thanks."
          className={inputClass}
        />
      </label>

      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}

      <button
        disabled={!agreed || f.pending}
        className={`${buttonClass} disabled:opacity-50`}
      >
        {f.pending ? "Submitting…" : "Acknowledge Handbook ✓"}
      </button>
    </form>
  );
}

export function EditHandbookSectionForm({
  section,
  onClose,
}: {
  section: { id: string; title: string; content: string };
  onClose: () => void;
}) {
  const f = useKeptForm(async (prev, fd) => {
    const res = await updateHandbookSectionAction(section.id, prev, fd);
    if (res?.ok) onClose();
    return res;
  });

  return (
    <form {...f.formProps} className="rounded-xl border border-line bg-surface p-4 space-y-3">
      <label className="block text-sm font-medium">
        Chapter Title
        <input
          name="title"
          required
          defaultValue={section.title}
          className={inputClass}
        />
      </label>

      <label className="block text-sm font-medium">
        Content
        <textarea
          name="content"
          required
          rows={10}
          defaultValue={section.content}
          className={`${inputClass} font-mono text-xs`}
        />
      </label>

      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostClass}>
          Cancel
        </button>
        <button disabled={f.pending} className={buttonClass}>
          {f.pending ? "Saving…" : "Save Section"}
        </button>
      </div>
    </form>
  );
}

export function AddHandbookSectionForm({ onDone }: { onDone?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const f = useKeptForm(async (prev, fd) => {
    const res = await createHandbookSectionAction(prev, fd);
    if (res?.ok) {
      setOpen(false);
      onDone?.();
    }
    return res;
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-dashed border-line p-4 text-center text-sm font-semibold text-brand hover:border-brand w-full"
      >
        + Add New Chapter to Handbook
      </button>
    );
  }

  return (
    <form {...f.formProps} className="rounded-2xl border border-line bg-surface p-5 space-y-4">
      <h3 className="font-bold text-ink">Add New Handbook Chapter</h3>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium">
            Chapter Title
            <input name="title" required placeholder="e.g. 9. Remote Work & Hybrid Schedule Guidelines" className={inputClass} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium">
            Slug (lowercase, hyphens)
            <input name="slug" required placeholder="remote-work-guidelines" className={inputClass} />
          </label>
        </div>
      </div>

      <label className="block text-xs font-medium">
        Content
        <textarea name="content" required rows={8} placeholder="Draft the guidelines and rules for this chapter..." className={`${inputClass} font-mono text-xs`} />
      </label>

      <label className="block text-xs font-medium">
        Sort Order Position
        <input name="sortOrder" type="number" defaultValue={9} min={1} max={999} className={inputClass} />
      </label>

      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={ghostClass}>
          Cancel
        </button>
        <button disabled={f.pending} className={buttonClass}>
          {f.pending ? "Adding…" : "Add Chapter"}
        </button>
      </div>
    </form>
  );
}
