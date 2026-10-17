"use client";

import { useActionState, useState } from "react";
import { motion } from "motion/react";
import { login } from "./actions";
import { Alert, Field, SubmitButton } from "@/components/Fields";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState(""); // React clears uncontrolled fields after a failed submit
  return (
    <motion.form
      action={action}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-4"
    >
      <Field label="Email or username" id="email" type="text" autoCapitalize="none" spellCheck={false} autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label="Password" id="password" type="password" autoComplete="current-password" required />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </motion.form>
  );
}
