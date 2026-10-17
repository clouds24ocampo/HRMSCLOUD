"use client";

import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui";

// Changing the cut-off opens it right away: no Apply button.
export function CutoffPicker({ options, value, employee }: { options: { start: string; label: string }[]; value: string; employee?: string }) {
  const router = useRouter();
  return (
    <label className="block text-sm font-medium">
      Cut-off
      <select
        value={value}
        onChange={(e) => router.push(`/payslips?${new URLSearchParams({ cutoff: e.target.value, ...(employee ? { employee } : {}) })}`)}
        className={inputClass}
      >
        {options.map((o) => <option key={o.start} value={o.start}>{o.label}</option>)}
      </select>
    </label>
  );
}
