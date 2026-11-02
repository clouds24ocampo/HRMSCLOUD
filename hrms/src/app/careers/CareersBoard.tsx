"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RoleArt } from "@/components/RoleArt";
import { RoleInfo } from "@/components/RoleInfo";

export type CareerJob = {
  id: string; title: string; department: string | null; openings: number;
  description: string | null; descriptionTl: string | null; duties: string | null; dutiesTl: string | null;
};

// Search, department filter, and one card per open position with its picture. Open a card to read the role in English or Tagalog.
export function CareersBoard({ jobs, signedInApplicant }: { jobs: CareerJob[]; signedInApplicant: boolean }) {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("All");
  const [open, setOpen] = useState<string | null>(null);

  const departments = useMemo(() => {
    const n = new Map<string, number>();
    for (const j of jobs) n.set(j.department ?? "Other", (n.get(j.department ?? "Other") ?? 0) + 1);
    return [...n.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [jobs]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter((j) => (dept === "All" || (j.department ?? "Other") === dept) && (!needle || `${j.title} ${j.department ?? ""} ${j.description ?? ""}`.toLowerCase().includes(needle)));
  }, [jobs, q, dept]);

  const chip = (active: boolean) => `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${active ? "border-brand bg-brand text-brand-ink shadow-sm" : "border-line bg-white text-slate-600 hover:border-brand/50 hover:text-brand"}`;

  return (
    <section id="positions" className="scroll-mt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Open positions</h2>
          <p className="mt-1 text-slate-500" aria-live="polite">{shown.length} {shown.length === 1 ? "position" : "positions"}{dept !== "All" || q ? " match" : " open now"}</p>
        </div>
        <label className="relative block w-full sm:w-80">
          <span className="sr-only">Search positions</span>
          <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search by title or department" className="w-full rounded-full border border-line bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand" />
        </label>
      </div>

      <div role="group" aria-label="Filter by department" className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-2">
        <button type="button" aria-pressed={dept === "All"} onClick={() => setDept("All")} className={chip(dept === "All")}>All <span className="opacity-70">{jobs.length}</span></button>
        {departments.map(([name, n]) => <button key={name} type="button" aria-pressed={dept === name} onClick={() => setDept(name)} className={chip(dept === name)}>{name} <span className="opacity-70">{n}</span></button>)}
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line bg-slate-50 p-12 text-center">
          <p className="font-semibold">{jobs.length === 0 ? "No open positions right now." : "No position matches your search."}</p>
          <p className="mt-1 text-sm text-slate-500">{jobs.length === 0 ? "Please check back soon." : "Try a different word or choose All."}</p>
          {jobs.length > 0 && <button type="button" onClick={() => { setQ(""); setDept("All"); }} className="mt-4 rounded-full border border-brand px-4 py-1.5 text-sm font-semibold text-brand hover:bg-brand/5">Clear search</button>}
        </div>
      ) : (
        <ul className="mt-6 grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {shown.map((j) => {
              const expanded = open === j.id;
              const hasInfo = !!(j.description || j.duties);
              return (
                <motion.li key={j.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25 }}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-sm transition-shadow hover:shadow-xl">
                  <div className="overflow-hidden"><div className="transition-transform duration-500 group-hover:scale-105"><RoleArt title={j.title} className="h-40" /></div></div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      {j.department && <span className="rounded-full bg-brand/10 px-2.5 py-1 text-brand">{j.department}</span>}
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{j.openings} {j.openings === 1 ? "opening" : "openings"}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold leading-snug">{j.title}</h3>
                    {j.description && <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{j.description}</p>}
                    {hasInfo && (
                      <>
                        <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : j.id)} className="mt-3 flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                          {expanded ? "Hide details" : "What you will do"} <span aria-hidden className={`transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span> <span className="font-normal text-slate-400">· Ano ang gagawin mo</span>
                        </button>
                        <AnimatePresence initial={false}>
                          {expanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                              <div className="mt-3 rounded-2xl bg-slate-50 p-4"><RoleInfo description={j.description} descriptionTl={j.descriptionTl} duties={j.duties} dutiesTl={j.dutiesTl} /></div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                    <div className="mt-auto pt-5">
                      <Link href={signedInApplicant ? "/apply" : `/careers/register?job=${j.id}`} className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink shadow-md shadow-brand/25 transition hover:brightness-110 active:scale-[0.98]">
                        {signedInApplicant ? "Go to my application" : "Apply for this position"} <span aria-hidden>→</span>
                      </Link>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
