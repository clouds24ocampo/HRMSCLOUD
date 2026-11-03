"use client";

import { useState, useTransition, type FormEvent } from "react";
import { prepareUpload } from "@/lib/shrink-upload";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, SubmitButton } from "@/components/Fields";
import { Badge, buttonClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { applyToJobs, uploadDocuments, uploadRequirement } from "./actions";
import { RoleInfo } from "@/components/RoleInfo";
import { RoleArt } from "@/components/RoleArt";

// One button that runs a server action and shows its error, if any.
function ActionButton({ run, children }: { run: () => Promise<FormState>; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>();
  return (
    <div>
      <button disabled={pending} onClick={() => start(async () => setMsg(await run()))} className={buttonClass}>{pending ? "Please wait…" : children}</button>
      {msg?.error && <div className="mt-2"><Alert kind="error">{msg.error}</Alert></div>}
    </div>
  );
}


// Tick any number of positions, then one Apply button.
export function ApplyPicker({ jobs }: { jobs: { id: string; title: string; meta: string; description: string | null; descriptionTl: string | null; duties: string | null; dutiesTl: string | null }[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {jobs.map((j) => (
          <li key={j.id} className={`overflow-hidden rounded-2xl border shadow-sm transition ${picked.includes(j.id) ? "border-brand bg-brand/5" : "border-line bg-surface"}`}>
            <RoleArt title={j.title} className="h-24" />
            <div className="p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={picked.includes(j.id)} onChange={() => toggle(j.id)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]" />
              <span><span className="block font-semibold">{j.title}</span><span className="block text-sm text-muted">{j.meta}</span></span>
            </label>
            {(j.description || j.duties) && <details className="mt-2 pl-7 text-sm"><summary className="cursor-pointer font-medium text-brand">About this role · Tungkol sa trabaho</summary><div className="mt-3"><RoleInfo description={j.description} descriptionTl={j.descriptionTl} duties={j.duties} dutiesTl={j.dutiesTl} /></div></details>}
          </div>
          </li>
        ))}
      </ul>
      <div className="sticky bottom-3">
        <ActionButton run={async () => { const r = await applyToJobs(picked); if (r?.ok) setPicked([]); return r; }}>
          {picked.length === 0 ? "Choose positions to apply" : `Apply for ${picked.length} position${picked.length === 1 ? "" : "s"}`}
        </ActionButton>
      </div>
    </div>
  );
}
export function UploadForm({ hasResume, hasId, maxMb }: { hasResume: boolean; hasId: boolean; maxMb: number }) {
  const { state, pending, submit, formProps } = useKeptForm(uploadDocuments);
  const [localError, setLocalError] = useState<string>();
  const [preparing, setPreparing] = useState(false);
  // Shrinks big photos and refuses oversized files here, so the request stays small and the message is clear.
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPreparing(true);
    try {
      for (const name of ["resume", "validId"]) {
        const file = fd.get(name);
        if (!(file instanceof File) || file.size === 0) continue;
        const r = await prepareUpload(file, maxMb);
        if ("error" in r) return setLocalError(r.error);
        fd.set(name, r.file);
      }
      setLocalError(undefined);
      submit(fd);
    } finally {
      setPreparing(false);
    }
  };
  return (
    <form {...formProps} onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        Resume {hasResume && <span className="font-normal text-success">· received, choose a file to replace it</span>}
        <input type="file" name="resume" accept="application/pdf,image/png,image/jpeg" className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-semibold file:text-brand" />
      </label>
      <label className="block text-sm font-medium">
        Valid ID (government-issued) {hasId && <span className="font-normal text-success">· received, choose a file to replace it</span>}
        <input type="file" name="validId" accept="application/pdf,image/png,image/jpeg" className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-semibold file:text-brand" />
      </label>
      <p className="text-xs text-muted">PDF, PNG or JPEG. Up to {maxMb} MB each. Large photos are made smaller automatically.</p>
      {(localError || state?.error) && <Alert kind="error">{localError ?? state?.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending || preparing}>Upload</SubmitButton>
    </form>
  );
}

// One line of the 201 file checklist: the file picker and its own Upload button. Big photos are shrunk first.
export function RequirementRow({ title, hint, required, fileName, version, auto, maxMb, docId, locked = false }: { title: string; hint: string; required: boolean; fileName: string | null; version: number | null; auto: boolean; maxMb: number; docId: string | null; locked?: boolean }) {
  const { state, pending, submit, formProps } = useKeptForm(uploadRequirement.bind(null, title));
  const [localError, setLocalError] = useState<string>();
  const [preparing, setPreparing] = useState(false);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return setLocalError("Choose a file first.");
    setPreparing(true);
    try {
      const r = await prepareUpload(file, maxMb);
      if ("error" in r) return setLocalError(r.error);
      fd.set("file", r.file);
      setLocalError(undefined);
      submit(fd);
    } finally {
      setPreparing(false);
    }
  };
  const have = !!fileName || auto;
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{title} {required ? <span className="text-xs font-normal text-muted">· required</span> : <span className="text-xs font-normal text-muted">· if it applies</span>}</p>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        <div className="flex items-center gap-3">
          {have && <a href={docId ? `/apply/file/doc/${docId}` : "/apply/file/resume"} target="_blank" className="text-sm font-semibold text-brand hover:underline">View</a>}
          {have ? <Badge tone="success">{auto ? "Sent at sign-up" : `Received${version && version > 1 ? ` (version ${version})` : ""}`}</Badge> : <Badge tone={required ? "warning" : "neutral"}>{required ? "Needed" : "Optional"}</Badge>}
        </div>
      </div>
      {!locked && <form {...formProps} onSubmit={onSubmit} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="file" name="file" accept="application/pdf,image/png,image/jpeg" aria-label={`File for ${title}`} className="min-w-0 flex-1 basis-48 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:font-semibold file:text-brand" />
        <button disabled={pending || preparing} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold transition hover:bg-bg active:scale-95 disabled:opacity-60">{pending || preparing ? "Please wait…" : have ? "Replace" : "Upload"}</button>
      </form>}
      {(localError || state?.error) && <div className="mt-2"><Alert kind="error">{localError ?? state?.error}</Alert></div>}
      {state?.ok && <div className="mt-2"><Alert kind="success">{state.ok}</Alert></div>}
    </li>
  );
}
