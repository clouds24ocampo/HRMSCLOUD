"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRole, deleteRole, saveRole } from "./actions";
import { PermissionPicker } from "@/components/PermissionPicker";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";

export function CreateRoleForm({ roles, templates }: { roles: { id: string; name: string }[]; templates: { name: string; description: string }[] }) {
  const router = useRouter();
  const { state, pending, formProps } = useKeptForm(async (prev: FormState, fd: FormData) => {
    const r = await createRole(prev, fd);
    if (r?.ok && r.id) router.push(`/admin/roles/${r.id}`);
    return r;
  });
  return (
    <form {...formProps} className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold">New company role</h2>
      <Field label="Role name" id="name" required maxLength={60} placeholder="For example: Payroll Officer" />
      <Field label="What it is for (optional)" id="description" maxLength={300} />
      <label className="block text-sm font-medium">
        Start from
        <select name="from" defaultValue="" className={inputClass}>
          <option value="">Nothing: I will choose every permission</option>
          {templates.length > 0 && (
            <optgroup label="Ready-made">
              {templates.map((t) => <option key={t.name} value={`template:${t.name}`}>{t.name}: {t.description}</option>)}
            </optgroup>
          )}
          <optgroup label="Copy an existing role">
            {roles.map((r) => <option key={r.id} value={`role:${r.id}`}>{r.name}</option>)}
          </optgroup>
        </select>
      </label>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton pending={pending}>Create role</SubmitButton>
    </form>
  );
}

export function RoleEditor({
  id, name: n0, description: d0, perms: p0, editable, people,
}: { id: string; name: string; description: string; perms: string[]; editable: boolean; people: number }) {
  const router = useRouter();
  const [name, setName] = useState(n0);
  const [description, setDescription] = useState(d0);
  const [sel, setSel] = useState<Set<string>>(new Set(p0));
  const [msg, setMsg] = useState<FormState>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <label className="block text-sm font-medium">Name<input value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} maxLength={60} className={inputClass} /></label>
        <label className="block text-sm font-medium">What it is for<input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!editable} maxLength={300} className={inputClass} /></label>
        {!editable && <p className="text-sm text-muted">Built-in roles are fixed. To change one, create a company role copied from it.</p>}
      </section>
      <PermissionPicker selected={sel} onChange={setSel} readOnly={!editable} />
      {editable && (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
          {msg?.error && <Alert kind="error">{msg.error}</Alert>}
          {msg?.ok && <Alert kind="success">{msg.ok}</Alert>}
          <div className="flex flex-wrap gap-3">
            <button disabled={pending} onClick={() => start(async () => setMsg(await saveRole(id, name, description, [...sel])))} className="rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-60">
              {pending ? "Saving…" : "Save role"}
            </button>
            <button
              disabled={pending}
              onClick={() => {
                if (!confirm(`Delete the role “${name}”? This cannot be undone.`)) return;
                start(async () => { const r = await deleteRole(id); if (r?.ok) router.push("/admin/roles"); else setMsg(r); });
              }}
              className="rounded-lg border border-danger px-4 py-2.5 font-semibold text-danger transition hover:bg-danger/10 active:scale-[0.98] disabled:opacity-60"
            >
              Delete role
            </button>
          </div>
          <p className="text-xs text-muted">{people ? `${people} ${people === 1 ? "person holds" : "people hold"} this role. They get changes when they sign in again.` : "Nobody holds this role yet."}</p>
        </section>
      )}
    </div>
  );
}
