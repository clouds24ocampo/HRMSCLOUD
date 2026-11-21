"use client";

import { useState, useTransition } from "react";
import { PermissionPicker } from "@/components/PermissionPicker";
import { Alert } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { saveAccess } from "../../actions";

type Role = { id: string; key: string; name: string; description: string | null; perms: string[]; mine: boolean };

// Pick the role (its permissions fill in), then tick or untick anything for this account only. The list shows what comes from the role,
// what was added and what was taken away.
export function AccessEditor({
  userId, roles, roleId: initialRole, perms: initialPerms, suggestedId, level, entry,
}: {
  userId: string; roles: Role[]; roleId: string; perms: string[]; suggestedId: string | null; level: string | null; entry: boolean;
}) {
  const [roleId, setRoleId] = useState(initialRole);
  const [sel, setSel] = useState<Set<string>>(new Set(initialPerms));
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<FormState>();
  const [pending, start] = useTransition();
  const role = roles.find((r) => r.id === roleId)!;
  const base = new Set(role.perms);
  const fixed = role.key === "SUPER_ADMIN";
  const added = [...sel].filter((p) => !base.has(p)).length;
  const removed = [...base].filter((p) => !sel.has(p)).length;
  const pickRole = (id: string) => {
    setRoleId(id);
    setSel(new Set(roles.find((r) => r.id === id)!.perms)); // the role's own permissions; changes for this account are made after
    setMsg(undefined);
  };
  const suggested = roles.find((r) => r.id === suggestedId);

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold">1. Role</h2>
        {suggested && (
          <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm">
            Suggested for the {level} level: <b>{suggested.name}</b>.{" "}
            {suggested.id === roleId ? "Already chosen." : <button type="button" onClick={() => pickRole(suggested.id)} className="font-semibold text-brand hover:underline">Use it</button>}
          </p>
        )}
        <label className="block text-sm font-medium">
          Role
          <select value={roleId} onChange={(e) => pickRole(e.target.value)} className={inputClass}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}{r.mine ? " (company role)" : ""}</option>)}
          </select>
        </label>
        {role.description && <p className="text-sm text-muted">{role.description}</p>}
        {entry && <p className="text-sm text-warning">This person holds an entry-level position: manager or higher access is not available.</p>}
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold">2. Access for this account</h2>
        <p className="text-sm text-muted">
          {fixed ? "A Super Admin always has everything. Choose another role to itemize access." : `The role gives ${role.perms.length}. Tick to add more, untick to remove, for this account only. ${added} added, ${removed} removed.`}
        </p>
        {!fixed && (
          <button type="button" onClick={() => setSel(new Set(role.perms))} className="text-sm font-medium text-brand hover:underline">Reset to what the role gives</button>
        )}
        <PermissionPicker selected={sel} onChange={setSel} base={base} blockElevated={entry} readOnly={fixed} />
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <label className="block text-sm font-medium">
          Reason (kept in the audit log)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="For example: covers payroll while Ana is away" className={inputClass} />
        </label>
        {msg?.error && <Alert kind="error">{msg.error}</Alert>}
        {msg?.ok && <Alert kind="success">{msg.ok}</Alert>}
        <button
          disabled={pending}
          onClick={() => start(async () => setMsg(await saveAccess(userId, roleId, [...sel], note)))}
          className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Saving…" : "Save access"}
        </button>
        <p className="text-xs text-muted">The person is signed out and gets the new access when they sign in again.</p>
      </section>
    </div>
  );
}
