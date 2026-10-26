"use client";

import { useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { archiveAnnouncement, restoreAnnouncement, postAnnouncement } from "./actions";

export function AnnouncementForm() {
  const f = useKeptForm(postAnnouncement);
  return (
    <form {...f.formProps} className="space-y-3">
      <Field label="Title" id="title" required />
      <label className="block text-sm font-medium">
        Message
        <textarea name="body" rows={5} required className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="pinned" className="h-4 w-4 accent-[var(--brand)]" /> Keep it at the top</label>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Post to everyone</SubmitButton>
    </form>
  );
}

export function ArchiveAnnouncementButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} aria-label={`Archive ${title}`} onClick={() => start(() => archiveAnnouncement(id))} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      Archive
    </button>
  );
}

export function RestoreAnnouncementButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} aria-label={`Restore ${title}`} onClick={() => start(() => restoreAnnouncement(id))} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      Restore
    </button>
  );
}
