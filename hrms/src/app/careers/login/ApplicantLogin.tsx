"use client";

import { useActionState, useState } from "react";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { loginApplicant } from "./actions";

export function ApplicantLogin() {
  const [state, action, pending] = useActionState(loginApplicant, undefined);
  const [email, setEmail] = useState(""); // React clears uncontrolled fields after a failed submit
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label="Password" id="password" type="password" autoComplete="current-password" required />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </form>
  );
}
