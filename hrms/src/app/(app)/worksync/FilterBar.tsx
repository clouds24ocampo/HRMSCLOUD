"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PRIORITY_LABEL } from "@/lib/worksync";

type Opt = { id: string; name: string };

// Search and filters, the same on every view. They live in the URL, so a filtered view can be bookmarked or shared.
export function FilterBar({ people, labels }: { people: Opt[]; labels: Opt[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const active = ["q", "who", "label", "pri"].some((k) => params.get(k));
  const sel = "rounded-lg border border-white/25 bg-white/15 px-2.5 py-1.5 text-sm text-white backdrop-blur [&>option]:text-ink";

  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter cards">
      <label className="relative">
        <span className="sr-only">Search cards</span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); clearTimeout(timer.current); const v = e.target.value; timer.current = setTimeout(() => set({ q: v }), 350); }}
          placeholder="Search cards"
          className="w-44 rounded-lg border border-white/25 bg-white/15 px-3 py-1.5 text-sm text-white placeholder:text-white/70 backdrop-blur focus:bg-white/25"
        />
      </label>
      <label><span className="sr-only">Person</span>
        <select value={params.get("who") ?? ""} onChange={(e) => set({ who: e.target.value })} className={sel}>
          <option value="">Everyone</option><option value="me">Only mine</option><option value="none">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label><span className="sr-only">Label</span>
        <select value={params.get("label") ?? ""} onChange={(e) => set({ label: e.target.value })} className={sel}>
          <option value="">Any label</option>{labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <label><span className="sr-only">Priority</span>
        <select value={params.get("pri") ?? ""} onChange={(e) => set({ pri: e.target.value })} className={sel}>
          <option value="">Any priority</option>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {active && <button type="button" onClick={() => { setQ(""); set({ q: "", who: "", label: "", pri: "" }); }} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-white underline-offset-2 hover:underline">Clear filters</button>}
    </div>
  );
}
