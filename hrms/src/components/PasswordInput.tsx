"use client";

import { useState, type ComponentProps } from "react";

// A password box with an eye button to show what was typed. The button sits outside the label, so the field keeps
// its plain name ("Password") for screen readers and tests.
export function PasswordInput({ label, id, className, ...props }: { label?: string } & ComponentProps<"input">) {
  const [show, setShow] = useState(false);
  const input = (
    <input
      name={id}
      {...props}
      type={show ? "text" : "password"}
      className={`${className ?? "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink shadow-sm placeholder:text-muted focus:border-brand"} pr-11`}
    />
  );
  return (
    <div className="relative">
      {label ? <label className="block text-sm font-medium text-ink">{label}{input}</label> : input}
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-pressed={show}
        aria-label={show ? "Hide" : "Show"}
        title={show ? "Hide password" : "Show password"}
        className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:bg-bg hover:text-ink"
      >
        {show ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10 10 0 0112 5c5 0 9 4.5 10 7a13 13 0 01-3.2 4.2M6.6 6.6A13 13 0 002 12c1 2.5 5 7 10 7a9.8 9.8 0 005.4-1.6" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
        )}
      </button>
    </div>
  );
}
