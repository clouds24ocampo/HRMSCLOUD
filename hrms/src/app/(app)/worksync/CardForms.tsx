"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert } from "@/components/Fields";
import { buttonClass, ghostClass, inputClass } from "@/components/ui";
import { LABEL_COLORS, PRIORITY_LABEL, ROLE_LABEL, WS_THEMES, labelColor, themeGradient } from "@/lib/worksync";
import { addCheck, addComment, addMember, createLabel, moveCardForm, setCardStatus, updateCard, updateProject } from "./actions";

const small = "rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition active:scale-95 disabled:opacity-60";

// Once an action succeeds the card is done with: close it so the board is visible again.
function useCloseOnOk(ok: string | undefined, closeHref: string) {
  const router = useRouter();
  useEffect(() => { if (ok) router.push(closeHref, { scroll: false }); }, [ok, closeHref, router]);
}

export function EditCardForm({ cardId, closeHref, card }: { cardId: string; closeHref: string; card: { title: string; description: string; priority: keyof typeof PRIORITY_LABEL; startDay: string; dueDay: string } }) {
  const f = useKeptForm(updateCard.bind(null, cardId));
  useCloseOnOk(f.state?.ok, closeHref);
  return (
    <form {...f.formProps} className="space-y-3">
      <label className="block text-sm font-medium">Title<input name="title" required maxLength={200} defaultValue={card.title} className={inputClass} /></label>
      <label className="block text-sm font-medium">Description<textarea name="description" rows={5} maxLength={50000} defaultValue={card.description} className={inputClass} placeholder="What needs doing, links, test documentation, reproduction steps, notes" /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm font-medium">Priority
          <select name="priority" defaultValue={card.priority} className={inputClass}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="block text-sm font-medium">Start<input type="date" name="startDate" defaultValue={card.startDay} className={inputClass} /></label>
        <label className="block text-sm font-medium">Due<input type="date" name="dueDate" defaultValue={card.dueDay} className={inputClass} /></label>
      </div>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <button disabled={f.pending} className={buttonClass}>{f.pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}

const STATUS_BUTTONS = [
  { category: "BLOCKED", label: "Mark blocked", className: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100" },
  { category: "DONE", label: "Mark done", className: "border-green-300 bg-green-50 text-green-700 hover:bg-green-100" },
  { category: "TODO", label: "Reopen", className: "border-line text-ink hover:bg-bg" },
] as const;

export function QuickStatus({ cardId, current, closeHref }: { cardId: string; current: string; closeHref: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; ok?: string }>();
  useCloseOnOk(result?.ok, closeHref);
  const shown = STATUS_BUTTONS.filter((b) => (b.category === "TODO" ? current === "BLOCKED" || current === "DONE" : b.category !== current));
  return (
    <div className="space-y-1.5">
      {shown.map((b) => (
        <button key={b.category} type="button" disabled={pending} onClick={() => start(async () => setResult(await setCardStatus(cardId, b.category)))} className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition active:scale-95 disabled:opacity-60 ${b.className}`}>
          {b.label}
        </button>
      ))}
      {result?.error && <p role="alert" className="text-xs text-danger">{result.error}</p>}
    </div>
  );
}

export function MoveForm({ cardId, listId, closeHref, lists }: { cardId: string; listId: string; closeHref: string; lists: { id: string; name: string }[] }) {
  const f = useKeptForm(moveCardForm.bind(null, cardId));
  useCloseOnOk(f.state?.ok, closeHref);
  return (
    <form {...f.formProps} className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-sm font-medium">Move to<select name="listId" defaultValue={listId} className={inputClass}>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <button disabled={f.pending} className={ghostClass}>{f.pending ? "Moving…" : "Move"}</button>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <p className="w-full text-sm text-success">{f.state.ok}</p>}
    </form>
  );
}

export function CheckForm({ cardId }: { cardId: string }) {
  const f = useKeptForm(addCheck.bind(null, cardId));
  return (
    <form {...f.formProps} className="flex gap-2">
      <label className="flex-1"><span className="sr-only">New checklist step</span><input name="text" required maxLength={200} placeholder="Add a step" className={`${inputClass} mt-0`} /></label>
      <button disabled={f.pending} className={ghostClass}>Add</button>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
    </form>
  );
}

export function CommentForm({ cardId }: { cardId: string }) {
  const f = useKeptForm(addComment.bind(null, cardId));
  return (
    <form {...f.formProps} className="space-y-2">
      <label className="block">
        <span className="sr-only">Comment</span>
        <textarea
          name="body"
          rows={3}
          required
          maxLength={50000}
          placeholder="Write an update, question, bug report, or QA revision notes…"
          className={`${inputClass} mt-0 font-sans`}
        />
      </label>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <button disabled={f.pending} className={small}>{f.pending ? "Sending…" : "Post Comment / Update"}</button>
    </form>
  );
}

export function AddMemberForm({ projectId, people }: { projectId: string; people: { id: string; name: string }[] }) {
  const f = useKeptForm(addMember.bind(null, projectId));
  if (people.length === 0) return <p className="text-sm text-muted">Everyone you can add is already on this project.</p>;
  return (
    <form {...f.formProps} className="space-y-2">
      <label className="block text-sm font-medium">Add a person
        <select name="employeeId" required defaultValue="" className={inputClass}><option value="" disabled>Choose…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </label>
      <label className="block text-sm font-medium">Role
        <select name="role" defaultValue="MEMBER" className={inputClass}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}{k === "LEAD" ? " (manages the project)" : k === "VIEWER" ? " (read only)" : " (works the cards)"}</option>)}</select>
      </label>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <button disabled={f.pending} className={small}>{f.pending ? "Adding…" : "Add to project"}</button>
    </form>
  );
}

export function NewLabelForm({ projectId }: { projectId: string }) {
  const f = useKeptForm(createLabel.bind(null, projectId));
  return (
    <form {...f.formProps} className="space-y-2">
      <div className="flex gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">Label name</span><input name="name" required maxLength={30} placeholder="New label" className={`${inputClass} mt-0`} /></label>
        <label><span className="sr-only">Color</span>
          <select name="color" defaultValue="blue" className={`${inputClass} mt-0 w-28`}>{Object.keys(LABEL_COLORS).map((k) => <option key={k} value={k} style={{ color: labelColor(k) }}>● {k}</option>)}</select>
        </label>
      </div>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <button disabled={f.pending} className={ghostClass}>Add label</button>
    </form>
  );
}

export function ProjectSettingsForm({ projectId, project }: { projectId: string; project: { name: string; description: string; dueDay: string; color: string } }) {
  const f = useKeptForm(updateProject.bind(null, projectId));
  return (
    <form {...f.formProps} className="space-y-3">
      <label className="block text-sm font-medium">Project name<input name="name" required maxLength={120} defaultValue={project.name} className={inputClass} /></label>
      <label className="block text-sm font-medium">Description<textarea name="description" rows={3} maxLength={2000} defaultValue={project.description} className={inputClass} /></label>
      <label className="block text-sm font-medium">Target date<input type="date" name="dueDate" defaultValue={project.dueDay} className={inputClass} /></label>
      <fieldset>
        <legend className="text-sm font-medium">Board color</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.keys(WS_THEMES).map((k) => (
            <label key={k} title={k} className="cursor-pointer">
              <input type="radio" name="color" value={k} defaultChecked={project.color === k} className="peer sr-only" />
              <span className="block h-8 w-12 rounded-lg ring-offset-2 peer-checked:ring-2 peer-checked:ring-brand peer-focus-visible:ring-2" style={{ backgroundImage: themeGradient(k) }} />
              <span className="sr-only">{k}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <button disabled={f.pending} className={buttonClass}>{f.pending ? "Saving…" : "Save project"}</button>
    </form>
  );
}
