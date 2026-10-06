import Link from "next/link";

const TABS = [["/schedule", "Schedule"], ["/schedule/live", "Live Personnel"], ["/schedule/analytics", "Analytics"]] as const;

export function ScheduleTabs({ active, leader }: { active: string; leader: boolean }) {
  if (!leader) return null;
  return (
    <nav aria-label="Schedule sections" className="mb-5 flex gap-1 rounded-xl border border-line bg-surface p-1 text-sm font-semibold">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={`rounded-lg px-4 py-2 transition ${active === href ? "bg-brand text-brand-ink" : "text-muted hover:bg-bg hover:text-ink"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
