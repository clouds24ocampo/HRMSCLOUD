import type { ComponentProps, ReactNode } from "react";
import { PasswordInput } from "@/components/PasswordInput";

export function Field({ label, id, ...props }: { label: string } & ComponentProps<"input">) {
  if (props.type === "password") return <PasswordInput label={label} id={id} {...props} />; // with the show/hide eye
  return (
    // The input sits inside its label, so no id is needed. Two forms on one page can reuse a field name safely.
    <label className="block text-sm font-medium text-ink">
      {label}
      <input
        name={id}
        {...props}
        className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink shadow-sm placeholder:text-muted focus:border-brand"
      />
    </label>
  );
}

export function SubmitButton({ pending, disabled = false, children }: { pending: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-brand-ink shadow-md shadow-brand/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const c =
    kind === "error"
      ? "border-danger/30 bg-danger/10 text-danger"
      : "border-success/30 bg-success/10 text-success";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${c}`}>
      {children}
    </p>
  );
}
