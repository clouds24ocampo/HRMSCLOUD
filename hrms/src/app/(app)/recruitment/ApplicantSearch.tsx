"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Person = { id: string; name: string; no: string | null; jobs: string[]; stage: string };

// The search bar at the top of every Recruitment page. Type two letters of a name, email or applicant number and the matches
// appear under the box; pick one to open the person's profile, or press Enter to see the whole list for what you typed.
export function ApplicantSearch() {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return; // nothing to look up; the list below is only shown for two or more letters
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/recruitment/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        const body = r.ok ? ((await r.json()) as { people: Person[] }) : { people: [] };
        setPeople(body.people);
        setActive(-1);
      } catch { /* aborted by a newer keystroke, or offline: keep the last list */ }
      finally { if (!ctl.signal.aborted) setBusy(false); }
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const go = (p: Person) => { setOpen(false); router.push(`/recruitment/applicants/${p.id}`); };
  const list = () => { setOpen(false); router.push(`/recruitment/applicants?q=${encodeURIComponent(q.trim())}&hired=1`); };
  const term = q.trim();

  return (
    <div ref={box} className="relative w-full sm:w-80">
      <label className="sr-only" htmlFor={`${listId}-in`}>Search applicants by name</label>
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        id={`${listId}-in`} type="search" value={q} placeholder="Search applicant name" autoComplete="off"
        role="combobox" aria-expanded={open && term.length >= 2} aria-controls={listId} aria-autocomplete="list"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(people.length - 1, i + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(-1, i - 1)); }
          else if (e.key === "Escape") setOpen(false);
          else if (e.key === "Enter") { e.preventDefault(); if (active >= 0 && people[active]) go(people[active]); else if (term) list(); }
        }}
        className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-muted focus:border-brand"
      />
      {open && term.length >= 2 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-96 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
          {people.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(p)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${i === active ? "bg-brand/10" : "hover:bg-bg"}`}>
                <span className="block font-medium">{p.name}{p.no && <span className="ml-2 font-mono text-xs font-normal text-muted">{p.no}</span>}</span>
                <span className="block truncate text-xs text-muted">{p.jobs.join(", ")} · {p.stage}</span>
              </button>
            </li>
          ))}
          {people.length === 0 && <li className="px-3 py-3 text-sm text-muted" role="status">{busy ? "Searching…" : `No applicant matches “${term}”.`}</li>}
          {people.length > 0 && (
            <li><button type="button" onClick={list} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-brand hover:bg-bg">See all results for “{term}” →</button></li>
          )}
        </ul>
      )}
    </div>
  );
}
