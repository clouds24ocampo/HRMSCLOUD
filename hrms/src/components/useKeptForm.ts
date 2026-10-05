"use client";

import { useActionState, useRef, useTransition, type FormEvent } from "react";
import type { FormState } from "@/app/login/actions";

// React 19 empties every uncontrolled field after a form action finishes, even when it failed.
// This submits through onSubmit instead: values stay on error, and the form is reset only on success.
export function useKeptForm(fn: (prev: FormState, fd: FormData) => Promise<FormState>) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, dispatch] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await fn(prev, fd);
    if (r?.ok) ref.current?.reset();
    return r;
  }, undefined);
  const [pending, start] = useTransition();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(() => dispatch(fd));
  };
  return { state, pending, formProps: { ref, onSubmit } };
}
