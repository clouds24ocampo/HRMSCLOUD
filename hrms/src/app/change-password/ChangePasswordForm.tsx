"use client";

import { useActionState } from "react";
import Link from "next/link";
import { changePassword } from "./actions";
import { Alert, Field, SubmitButton } from "@/components/Fields";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label={forced ? "Temporary password" : "Current password"} id="current" type="password" autoComplete="current-password" required autoFocus />
      <Field label="New password (10+ characters)" id="next" type="password" autoComplete="new-password" minLength={10} required />
      <Field label="Confirm new password" id="confirm" type="password" autoComplete="new-password" minLength={10} required />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton pending={pending}>Save password</SubmitButton>
      {!forced && (
        <Link href="/dashboard" className="block text-center text-sm font-medium text-muted hover:text-ink">
          Cancel
        </Link>
      )}
    </form>
  );
}
