"use client";

import { useState, type ComponentProps } from "react";
import { groupPesos } from "@/lib/money";

// Pesos with thousands separators as you type: 25000 -> 25,000, and 25,000.00 when you leave the field.
// The server reads it with parsePesos(), which ignores the commas.
export function MoneyInput({ label, id, value, defaultValue, onValue, ...props }: { label: string; onValue?: (v: string) => void } & Omit<ComponentProps<"input">, "onChange">) {
  const [own, setOwn] = useState(groupPesos(String(defaultValue ?? "")));
  const v = value !== undefined ? String(value) : own;
  const set = (x: string) => (onValue ? onValue(x) : setOwn(x));
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <input
        name={id}
        inputMode="decimal"
        autoComplete="off"
        {...props}
        value={v}
        onChange={(e) => set(groupPesos(e.target.value))}
        onBlur={() => v && set(groupPesos(v, true))}
        className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base tabular-nums text-ink shadow-sm placeholder:text-muted focus:border-brand"
      />
    </label>
  );
}
