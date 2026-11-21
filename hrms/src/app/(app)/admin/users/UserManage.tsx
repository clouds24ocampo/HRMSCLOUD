"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { changeUserRole, resetUserPassword, setUserActive } from "./actions";

type U = { id: string; name: string; active: boolean; roleId: string };

// Reset password, change role, deactivate. Hidden for your own row (those would lock you out).
export function UserManage({ user, roles, extras, removed }: { user: U; roles: { id: string; name: string }[]; extras: number; removed: number }) {
  const [msg, setMsg] = useState<FormState>();
  const [pending, start] = useTransition();
  const reset = useKeptForm(resetUserPassword.bind(null, user.id));
  const role = useKeptForm(changeUserRole.bind(null, user.id));

  return (
    <div className="space-y-4 border-t border-line bg-bg px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-sm">
          <span className="font-semibold">Access.</span>{" "}
          <span className="text-muted">{extras || removed ? `${extras} added, ${removed} removed on top of the role.` : "Exactly what the role gives."}</span>
        </p>
        <Link href={`/admin/users/${user.id}/access`} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition active:scale-95">Edit access</Link>
      </div>
      <form {...reset.formProps} className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1 basis-56 text-sm font-medium">
          New temporary password
          <PasswordInput id="password" autoComplete="new-password" minLength={10} required placeholder="At least 10 characters" className={inputClass} />
        </label>
        <button disabled={reset.pending} className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition hover:bg-bg active:scale-95 disabled:opacity-60">Reset password</button>
      </form>
      {reset.state?.error && <Alert kind="error">{reset.state.error}</Alert>}
      {reset.state?.ok && <Alert kind="success">{reset.state.ok}</Alert>}

      <form {...role.formProps} className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1 basis-56 text-sm font-medium">
          Role
          <select name="roleId" defaultValue={user.roleId} className={inputClass}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <button disabled={role.pending} className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition hover:bg-bg active:scale-95 disabled:opacity-60">Change role</button>
      </form>
      {role.state?.error && <Alert kind="error">{role.state.error}</Alert>}
      {role.state?.ok && <Alert kind="success">{role.state.ok}</Alert>}

      <div>
        <button
          disabled={pending}
          onClick={() => start(async () => setMsg(await setUserActive(user.id, !user.active)))}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-60 ${user.active ? "border border-danger text-danger hover:bg-danger/10" : "bg-success text-white"}`}
        >
          {user.active ? "Deactivate sign-in" : "Activate sign-in"}
        </button>
        {msg?.error && <div className="mt-2"><Alert kind="error">{msg.error}</Alert></div>}
        {msg?.ok && <div className="mt-2"><Alert kind="success">{msg.ok}</Alert></div>}
      </div>
    </div>
  );
}
