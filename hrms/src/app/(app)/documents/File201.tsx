"use client";

import { useKeptForm } from "@/components/useKeptForm";
import { Badge } from "@/components/ui";
import { upload201 } from "./actions";

export type Item201 = { title: string; required: boolean; hint: string; doc: { id: string; version: number; uploadedOn: string } | null };

function Row({ employeeId, item, required }: { employeeId: string; item: Item201; required: boolean }) {
  const f = useKeptForm(upload201.bind(null, employeeId, item.title));
  const id = `f201-${item.title.replace(/\W+/g, "-")}`;
  return (
    <li className="px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {item.title}{" "}
            {item.doc ? <Badge tone="success">Uploaded</Badge> : required ? <Badge tone="danger">Required</Badge> : <Badge>If applicable</Badge>}
          </p>
          <p className="text-xs text-muted">{item.hint}{item.doc ? ` · version ${item.doc.version}, ${item.doc.uploadedOn}` : ""}</p>
        </div>
        {item.doc && <a href={`/documents/${item.doc.id}/file`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg">Open</a>}
      </div>
      <form {...f.formProps} encType="multipart/form-data" className="mt-2 flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="sr-only">File for {item.title}</label>
        <input id={id} type="file" name="file" required accept="application/pdf,image/png,image/jpeg" className="min-w-0 flex-1 basis-56 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand" />
        <button disabled={f.pending} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-ink transition active:scale-95 disabled:opacity-60">{f.pending ? "Uploading…" : item.doc ? "Replace" : "Upload"}</button>
        {f.state?.error && <p role="alert" className="w-full text-sm text-danger">{f.state.error}</p>}
        {f.state?.ok && <p role="status" className="w-full text-sm text-success">{f.state.ok}</p>}
      </form>
    </li>
  );
}

// The 201 file checklist with one upload per requirement. `mandatory` = the employee's own view, where required items must be done.
export function File201({ employeeId, items, mandatory }: { employeeId: string; items: Item201[]; mandatory: boolean }) {
  const missing = items.filter((i) => i.required && !i.doc).length;
  return (
    <div className="space-y-3">
      <p className={`text-sm ${missing && mandatory ? "font-semibold text-danger" : "text-muted"}`}>
        {missing === 0 ? "All required documents are uploaded." : mandatory ? `${missing} required document${missing === 1 ? "" : "s"} still missing. Upload them all to complete your 201 file.` : `${missing} required document${missing === 1 ? "" : "s"} not uploaded yet. Optional for HR: the employee is asked to upload them.`}
      </p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {items.map((i) => <Row key={i.title} employeeId={employeeId} item={i} required={i.required} />)}
      </ul>
      <p className="text-xs text-muted">PDF, PNG or JPEG, up to 5 MB each. Replacing a file keeps the older version.</p>
    </div>
  );
}
