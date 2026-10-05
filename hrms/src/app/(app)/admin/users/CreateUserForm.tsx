"use client";

import { useState } from "react";
import { createUser } from "./actions";
import type { FormState } from "@/app/login/actions";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";

export function CreateUserForm({ roles }: { roles: { id: string; name: string }[] }) {
  // Controlled so a failed submit keeps what was typed; cleared only on success.
  const [v, setV] = useState({ name: "", email: "", roleId: "" });
  const { state, pending, formProps } = useKeptForm(async (prev: FormState, fd: FormData) => {
    const r = await createUser(prev, fd);
    if (r?.ok) setV({ name: "", email: "", roleId: "" });
    return r;
  });
  const bind = (k: keyof typeof v) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });

  return (
    <form {...formProps} className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Add a user</h2>
      <Field label="Full name" id="name" required {...bind("name")} />
      <Field label="Email" id="email" type="email" required {...bind("email")} />
      <label htmlFor="roleId" className="block text-sm font-medium">
        Role
        <select
          id="roleId"
          name="roleId"
          required
          value={v.roleId}
          onChange={(e) => setV({ ...v, roleId: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base shadow-sm"
        >
          <option value="" disabled>Choose a role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>
      <Field label="Temporary password" id="password" type="password" autoComplete="new-password" required minLength={10} />
      <p className="-mt-2 text-xs text-muted">They must choose their own password the first time they sign in.</p>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending}>Add user</SubmitButton>
    </form>
  );
}
