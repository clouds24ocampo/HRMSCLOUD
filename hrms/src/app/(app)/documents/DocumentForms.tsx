"use client";

import { useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { archiveDocument, uploadDocument } from "./actions";

export function UploadForm({ employeeId, categories }: { employeeId: string; categories: readonly string[] }) {
  const f = useKeptForm(uploadDocument);
  return (
    <form {...f.formProps} className="space-y-3" encType="multipart/form-data">
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Category
          <select name="category" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose…</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <Field label="Title" id="title" required placeholder="Employment contract" />
        <Field label="Expires on (optional)" id="expiresOn" type="date" />
        <label className="block text-sm font-medium">
          File (PDF, PNG or JPEG)
          <input type="file" name="file" required accept="application/pdf,image/png,image/jpeg" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand`} />
        </label>
      </div>
      <p className="text-xs text-muted">Uploading a file with the same title adds a new version. Older versions are kept.</p>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Upload</SubmitButton>
    </form>
  );
}

export function ArchiveDocButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} aria-label={`Archive ${title}`} onClick={() => { if (window.confirm("Archive this document? The file is kept.")) start(() => archiveDocument(id)); }} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      Archive
    </button>
  );
}
