"use client";

import { GRANTABLE, PERMISSIONS, PERMISSION_GROUPS } from "@/lib/permissions";

// One checkbox per permission, grouped, each with a plain explanation. With `base` (what the role gives) every row also says
// whether it comes from the role, was added for this account, or was taken away from it.
export function PermissionPicker({
  selected, onChange, base, blockElevated = false, readOnly = false,
}: {
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  base?: ReadonlySet<string>;
  blockElevated?: boolean; // entry-level position: manager or higher access cannot be ticked
  readOnly?: boolean;
}) {
  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k); else next.add(k);
    onChange(next);
  };
  const setGroup = (group: string, on: boolean) => {
    const next = new Set(selected);
    for (const p of PERMISSIONS.filter((x) => x.group === group && GRANTABLE.includes(x.key))) {
      if (on && blockElevated && (p as { elevated?: boolean }).elevated) continue;
      if (on) next.add(p.key); else next.delete(p.key);
    }
    onChange(next);
  };

  return (
    <div className="space-y-5">
      {PERMISSION_GROUPS.map((group) => {
        const items = PERMISSIONS.filter((p) => p.group === group);
        const count = items.filter((p) => selected.has(p.key)).length;
        return (
          <fieldset key={group} className="rounded-xl border border-line">
            <legend className="sr-only">{group}</legend>
            <div className="flex items-center justify-between gap-2 border-b border-line bg-bg px-4 py-2">
              <p className="text-sm font-semibold">{group} <span className="font-normal text-muted">· {count} of {items.length}</span></p>
              {!readOnly && (
                <span className="flex gap-3 text-xs">
                  <button type="button" onClick={() => setGroup(group, true)} className="font-medium text-brand hover:underline">Select all</button>
                  <button type="button" onClick={() => setGroup(group, false)} className="font-medium text-muted hover:underline">Clear</button>
                </span>
              )}
            </div>
            <ul className="divide-y divide-line">
              {items.map((p) => {
                const locked = !GRANTABLE.includes(p.key);
                const elevated = !!(p as { elevated?: boolean }).elevated;
                const on = selected.has(p.key);
                const fromRole = base?.has(p.key);
                const tag = !base ? null : on && !fromRole ? "Added for this account" : !on && fromRole ? "Removed for this account" : on ? "From role" : null;
                const blocked = blockElevated && elevated && !on;
                const disabled = readOnly || locked || blocked;
                return (
                  <li key={p.key}>
                    <label className={`flex items-start gap-3 px-4 py-3 ${disabled ? "opacity-60" : "cursor-pointer hover:bg-bg"}`}>
                      <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(p.key)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand,#2563eb)]" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{p.label}</span>
                          {elevated && <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-warning">Manager level</span>}
                          {locked && <span className="rounded bg-bg px-1.5 py-0.5 text-[11px] font-semibold text-muted">Super Admin only</span>}
                          {tag && (
                            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tag.startsWith("Added") ? "bg-success/15 text-success" : tag.startsWith("Removed") ? "bg-danger/15 text-danger" : "bg-bg text-muted"}`}>{tag}</span>
                          )}
                        </span>
                        <span className="block text-sm text-muted">{p.help}</span>
                        {blocked && <span className="block text-xs text-warning">Not available: this person holds an entry-level position.</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}
