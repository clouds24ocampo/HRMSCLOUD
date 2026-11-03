"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ApplicantSearch } from "./ApplicantSearch";

const TABS = [
  ["/recruitment/dashboard", "Dashboard"],
  ["/recruitment", "Positions"],
  ["/recruitment/applicants", "All applicants"],
  ["/recruitment/results", "Exam results"],
  ["/recruitment/commitment", "Corporate commitment"],
  ["/recruitment/exams", "Exams"],
] as const;

// The Recruitment section's own navigation. "Positions" is the section's home and also owns the job pages under it.
export function RecruitmentTabs() {
  const path = usePathname();
  const under = (href: string) => path === href || path.startsWith(href + "/");
  const others = TABS.filter(([h]) => h !== "/recruitment");
  const active = (href: string) => (href === "/recruitment" ? !others.some(([h]) => under(h)) : under(href));
  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <nav aria-label="Recruitment" className="flex min-w-0 gap-1 overflow-x-auto rounded-xl bg-line/50 p-1">
        {TABS.map(([href, label]) => (
          <Link
            key={href} href={href} aria-current={active(href) ? "page" : undefined}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${active(href) ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <ApplicantSearch />
    </div>
  );
}
