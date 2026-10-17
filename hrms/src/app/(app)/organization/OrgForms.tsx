"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { addDepartment, addPosition, addSuggestedDepartments, addSuggestedPositions } from "./actions";

type Opt = { id: string; name: string };

export function AddDepartmentForm({ departments }: { departments: Opt[] }) {
  const [name, setName] = useState("");
  const { state, pending, formProps } = useKeptForm(async (p: FormState, fd: FormData) => {
    const r = await addDepartment(p, fd);
    if (r?.ok) setName("");
    return r;
  });
  return (
    <form {...formProps} className="space-y-3">
      <Field label="Department name" id="name" required value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
      <label htmlFor="parentId" className="block text-sm font-medium">
        Part of (optional)
        <select id="parentId" name="parentId" className={inputClass} defaultValue="">
          <option value="">Top level</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending}>Add department</SubmitButton>
    </form>
  );
}

export function AddPositionForm({ departments, levels }: { departments: Opt[]; levels: { value: string; label: string }[] }) {
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("ENTRY");
  const head = level === "DEPT_HEAD" || level === "ASSISTANT_HEAD";
  const { state, pending, formProps } = useKeptForm(async (p: FormState, fd: FormData) => {
    const r = await addPosition(p, fd);
    if (r?.ok) {
      setTitle("");
      setLevel("ENTRY");
    }
    return r;
  });
  return (
    <form {...formProps} className="space-y-3">
      <Field label="Position title" id="title" required value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="level" className="block text-sm font-medium">
          Level in the chain
          <select id="level" name="level" className={inputClass} value={level} onChange={(e) => setLevel(e.target.value)}>
            {levels.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </label>
        <label htmlFor="departmentId" className="block text-sm font-medium">
          {level === "DEPT_HEAD" ? "Head of which department?" : level === "ASSISTANT_HEAD" ? "Assistant head of which department?" : "Department (optional)"}
          <select key={head ? "head" : "any"} id="departmentId" name="departmentId" required={head} className={inputClass} defaultValue="">
            <option value="" disabled={head}>{head ? "Choose the department" : "Any department"}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
      </div>
      {head && departments.length === 0 && <p className="text-sm text-warning">Add the department first, then its head.</p>}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending}>Add position</SubmitButton>
    </form>
  );
}

// One click adds every suggestion for the industry. Existing names are skipped.
export function SuggestionButton({ kind, departments, positions }: { kind: "departments" | "positions"; departments?: string[]; positions?: { title: string; level: string; department?: string }[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>();
  const list = kind === "departments" ? departments ?? [] : (positions ?? []).map((p) => p.title);
  // Once everything is added the list is empty; keep the confirmation on screen instead of vanishing.
  if (list.length === 0) return msg?.ok ? <p role="status" className="text-sm text-success">{msg.ok}</p> : null;
  return (
    <div className="rounded-xl border border-dashed border-line p-3">
      <p className="text-sm font-medium">Suggested for your industry</p>
      <p className="mt-1 text-sm text-muted">{list.join(", ")}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setMsg(kind === "departments" ? await addSuggestedDepartments(departments ?? []) : await addSuggestedPositions(positions ?? [])))}
        className="mt-3 rounded-lg border border-brand px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand/10 active:scale-95 disabled:opacity-60"
      >
        {pending ? "Adding…" : `Add all ${list.length}`}
      </button>
      {msg?.ok && <p role="status" className="mt-2 text-sm text-success">{msg.ok}</p>}
      {msg?.error && <p role="alert" className="mt-2 text-sm text-danger">{msg.error}</p>}
    </div>
  );
}
